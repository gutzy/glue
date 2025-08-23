import * as THREE from 'three';
import { Curtain } from './Curtain.js';

export class TSLCurtain extends Curtain {
  constructor(x, y, z, config = {}) {
    super(x, y, z, config);
    
    // TSL-specific properties
    this.enableTSL = config.enableTSL !== false;
    this.dualColor = config.dualColor !== false;
    this.colorMixFactor = config.colorMixFactor || 0.5;
    this.animateColorMix = config.animateColorMix || false;
    this.userOverrideSize = false; // Track if user manually changed size
    
    // TSL uniforms (will be created if WebGPU is available)
    this.colorUniform = null;
    this.color2Uniform = null;
    this.emissiveUniform = null;
    this.metalnessUniform = null;
    this.roughnessUniform = null;
    this.foldsUniform = null;
    this.depthUniform = null;
    this.noiseUniform = null;
    this.timeUniform = null;
    this.mixFactorUniform = null;
    this.widthUniform = null;
    this.heightUniform = null;
    this.shapeTypeUniform = null;
    
    // Try to initialize TSL if available
    this.initializeTSL();
  }
  
  async initializeTSL() {
    // Prevent double initialization
    if (this.material?.isNodeMaterial && this.colorUniform) {
      this.updateTSLUniforms();
      return;
    }
    
    // Clean up existing TSL resources
    if (this.material?.isNodeMaterial) {
      this.cleanupTSLResources();
    }
    
    // Check if WebGPU and TSL are available
    try {
      // Import THREE and TSL from three/webgpu 
      const THREE_WEBGPU = await import('three/webgpu');
      const { TSL } = THREE_WEBGPU;
      
      // MeshStandardNodeMaterial is on THREE_WEBGPU, not TSL
      const { MeshStandardNodeMaterial } = THREE_WEBGPU;
      
      if (!TSL || !MeshStandardNodeMaterial) {
        console.warn('TSL or MeshStandardNodeMaterial not available in three/webgpu');
        this.enableTSL = false;
        super.updateCurtainMaterial();
        return;
      }
      
      // Destructure all required TSL functions
      const {
        float, vec2, vec3, vec4, color,
        uniform, attribute, varying, storage,
        positionLocal, normalLocal, uv, time,
        sin, cos, pow, mix, smoothstep, clamp, abs, max, add, sub, mul, div,
        Fn, If, normalize, dot,
        normalWorld, normalView
      } = TSL;
      
      if (this.enableTSL) {
        this.initializeTSLMaterial({
          uniform, color, float, vec3, MeshStandardNodeMaterial,
          positionLocal, normalLocal, uv, time,
          sin, cos, pow, abs, mix, smoothstep, Fn, normalize,
          add, sub, mul, div,
          THREE_WEBGPU // Pass the entire module for THREE access
        });
      }
    } catch (error) {
      console.warn('TSL not available, falling back to standard material:', error);
      this.enableTSL = false;
      // Force fallback to standard material
      super.updateCurtainMaterial();
    }
  }
  
  initializeTSLMaterial(tsl) {
    try {
      const { 
        uniform, color, float, vec3, MeshStandardNodeMaterial, 
        positionLocal, normalLocal, uv, time,
        sin, cos, pow, abs, mix, smoothstep, Fn, normalize,
        add, sub, mul, div,
        THREE_WEBGPU
      } = tsl;
      
      // Use THREE from the WebGPU module
      const THREE = THREE_WEBGPU;
      
      // Verify required functions exist
      if (!uniform || !color || !float || !vec3 || !MeshStandardNodeMaterial || !positionLocal || !Fn || !time) {
        this.enableTSL = false;
        super.updateCurtainMaterial();
        return;
      }
      
      // For TSL mode, replace geometry with flat high-resolution plane
      // All deformation will happen in the shader, not in geometry
      if (this.geometry) {
        this.geometry.dispose();
      }
      // Create flat plane geometry with high resolution for TSL deformation
      this.geometry = new THREE.PlaneGeometry(
        this.width || 16,
        this.height || 10,
        200, // High resolution for smooth deformation
        150
      );
      
      // Create TSL uniforms with proper color handling
      
      // Create colors with fallback defaults
      const color1 = new THREE.Color(this.curtainColor || 0x8B0000);
      const color2 = new THREE.Color(this.curtainColor2 || 0x000080);
      
      // Create color uniforms - store the raw uniform for updates
      this.colorUniform = uniform(color(color1));
      this.color2Uniform = uniform(color(color2));
      this.emissiveUniform = uniform(color(color1.clone().multiplyScalar(0.2))); // Add emissive glow
      // Ensure all numeric values are properly converted to numbers
      this.metalnessUniform = uniform(float(Number(this.metalness) || 0.1));
      this.roughnessUniform = uniform(float(Number(this.roughness) || 0.8));
      this.foldsUniform = uniform(float(Number(this.folds) || 12));
      this.depthUniform = uniform(float(Number(this.foldDepth) || 1.5));
      this.noiseUniform = uniform(float(Number(this.noiseAmount) || 0.3));
      this.timeUniform = uniform(float(0));
      this.mixFactorUniform = uniform(float(Number(this.colorMixFactor) || 0.5));
      this.widthUniform = uniform(float(Number(this.width) || 16));
      this.heightUniform = uniform(float(Number(this.height) || 10));
      // Convert curtain type to numeric value
      const shapeMap = { theatre: 0, wave: 1, drape: 2, flat: 3 };
      this.shapeTypeUniform = uniform(float(shapeMap[this.curtainType] || 0));
      
    // Create TSL material
    const material = new THREE.MeshStandardNodeMaterial({
      side: THREE.DoubleSide,
      transparent: false,
      depthWrite: true,
      depthTest: true
    });
    
    // Enhanced color with gradient and fabric noise (matching HTML example)
    const gradientFactor = uv().y;
    const baseColorMix = mix(this.colorUniform, this.color2Uniform, gradientFactor);
    
    // Add fabric noise for texture variation
    const fabricNoise = Fn(() => {
      const uvScaled = uv().mul(20); // Scale for fabric detail
      const noise1 = sin(uvScaled.x.mul(3.14)).mul(cos(uvScaled.y.mul(2.71)));
      const noise2 = sin(uvScaled.x.mul(1.73)).mul(cos(uvScaled.y.mul(4.12)));
      const combined = noise1.mul(0.3).add(noise2.mul(0.2));
      return combined.mul(0.1).add(1); // Subtle variation
    });
    
    // Apply color based on dualColor setting
    const finalColor = this.dualColor 
      ? baseColorMix.mul(fabricNoise())
      : this.colorUniform.mul(fabricNoise());
    
    material.colorNode = finalColor;
    
    material.metalnessNode = this.metalnessUniform;
    material.roughnessNode = this.roughnessUniform;
    material.emissiveNode = this.emissiveUniform.mul(0.02); // Slight emissive for better visibility
    
    // TSL function for curtain deformation matching HTML example exactly
    const curtainDeformation = Fn(() => {
      const pos = positionLocal;
      const xCoord = pos.x;
      const yCoord = pos.y;
      const xFreq = xCoord.mul(this.foldsUniform).mul(0.5);
      
      // Theatre shape: vertical folds with scalloped bottom
      const theatreWave = sin(xFreq).mul(this.depthUniform);
      const bottomFactor = smoothstep(float(-0.3), float(0.5), yCoord.div(this.heightUniform));
      const theatreShape = theatreWave.mul(bottomFactor.add(0.5));
      
      // Wave shape: multiple frequencies
      const wave1 = sin(xFreq.mul(0.6)).mul(this.depthUniform);
      const wave2 = sin(xFreq.mul(1.2)).mul(this.depthUniform.mul(0.5));
      const wave3 = cos(xFreq.mul(2.0)).mul(this.depthUniform.mul(0.3));
      const waveShape = wave1.add(wave2).add(wave3);
      
      // Drape shape: curtains fold towards center (stage)
      const xNorm = xCoord.div(this.widthUniform.mul(0.5));
      const drapeAmount = pow(abs(xNorm), float(1.8)); // Gentler curve
      const yNorm = yCoord.div(this.heightUniform);
      // Negative Z to fold towards stage (viewer), with gravity effect
      const drapeShape = drapeAmount.mul(this.depthUniform).mul(-2.5).mul(yNorm.add(1));
      
      // Flat shape
      const flatShape = float(0);
      
      // Blend between shapes based on shapeType uniform
      const shapeType = this.shapeTypeUniform;
      let finalShape = theatreShape;
      
      // Use mix for smooth blending instead of If statements
      const isWave = smoothstep(float(0.5), float(1.5), shapeType);
      const isDrape = smoothstep(float(1.5), float(2.5), shapeType);
      const isFlat = smoothstep(float(2.5), float(3.5), shapeType);
      
      finalShape = mix(finalShape, waveShape, isWave);
      finalShape = mix(finalShape, drapeShape, isDrape);
      finalShape = mix(finalShape, flatShape, isFlat);
      
      // Add time-based animation
      const animatedWave = sin(time.mul(this.noiseUniform).add(xFreq)).mul(this.noiseUniform.mul(0.3));
      const zOffset = finalShape.add(animatedWave);
      
      return vec3(pos.x, pos.y, pos.z.add(zOffset));
    });
    
    // Apply position transformation
    material.positionNode = curtainDeformation();
    
    // Add subtle normal variation for fabric texture (matching HTML example)
    const fabricNormal = Fn(() => {
      const uvScaled = uv().mul(15);
      const n1 = sin(uvScaled.x.mul(6.28)).mul(0.02);
      const n2 = cos(uvScaled.y.mul(6.28)).mul(0.02);
      return normalize(vec3(n1, n2, float(1)));
    });
    
    material.normalNode = normalize(normalLocal.add(fabricNormal()));
    
    // Replace the standard material
    if (this.material && this.material.dispose) {
      this.material.dispose();
    }
    this.material = material;
    
    // TSL material successfully created and applied
    
    } catch (error) {
      console.warn('TSL initialization failed:', error);
      this.enableTSL = false;
      if (this.material?.isNodeMaterial) {
        this.cleanupTSLResources();
      }
      super.updateCurtainMaterial();
    }
  }
  
  // Override material update for TSL
  updateCurtainMaterial() {
    if (this.enableTSL) {
      // Check if we need to initialize TSL
      if (!this.material || !this.material.isNodeMaterial || !this.colorUniform) {
        // Initializing TSL material
        this.initializeTSL();
      } else if (this.colorUniform && this.color2Uniform) {
        // TSL is already initialized, just update uniforms
        this.updateTSLUniforms();
      }
    } else {
      // Clean up TSL resources if switching away from TSL
      if (this.material && this.material.isNodeMaterial) {
        this.cleanupTSLResources();
      }
      super.updateCurtainMaterial();
    }
  }
  
  // Update TSL uniform values
  updateTSLUniforms() {
    if (!this.enableTSL || !this.material?.isNodeMaterial) return;
    
    // Update color uniforms
    if (this.colorUniform?.value !== undefined) {
      this.colorUniform.value = new THREE.Color(this.curtainColor);
    }
    if (this.color2Uniform?.value !== undefined) {
      this.color2Uniform.value = new THREE.Color(this.curtainColor2);
    }
    
    // Update material uniforms
    if (this.emissiveUniform?.value !== undefined) {
      this.emissiveUniform.value = new THREE.Color(this.curtainColor).multiplyScalar(0.1);
    }
    if (this.metalnessUniform?.value !== undefined) {
      this.metalnessUniform.value = this.metalness || 0.1;
    }
    if (this.roughnessUniform?.value !== undefined) {
      this.roughnessUniform.value = this.roughness || 0.8;
    }
    if (this.depthUniform?.value !== undefined) {
      this.depthUniform.value = this.foldDepth || 1.5;
    }
    if (this.foldsUniform?.value !== undefined) {
      this.foldsUniform.value = this.folds || 12;
    }
    if (this.noiseUniform?.value !== undefined) {
      this.noiseUniform.value = this.noiseAmount || 0.05;
    }
    if (this.widthUniform?.value !== undefined) {
      this.widthUniform.value = this.width || 16;
    }
    if (this.heightUniform?.value !== undefined) {
      this.heightUniform.value = this.height || 10;
    }
    
    // Update mix factor uniform
    if (this.mixFactorUniform?.value !== undefined) {
      this.mixFactorUniform.value = this.colorMixFactor;
    }
    
    // Update shape type
    if (this.shapeTypeUniform) {
      const shapeMap = { theatre: 0, wave: 1, drape: 2, flat: 3 };
      this.shapeTypeUniform.value = shapeMap[this.curtainType] || 0;
    }
  }
  
  // Clean up TSL resources
  cleanupTSLResources() {
    
    // First, clear all TSL uniforms to prevent references during disposal
    this.colorUniform = null;
    this.color2Uniform = null;
    this.emissiveUniform = null;
    this.metalnessUniform = null;
    this.roughnessUniform = null;
    this.depthUniform = null;
    this.foldsUniform = null;
    this.widthUniform = null;
    this.heightUniform = null;
    this.noiseAmountUniform = null;
    this.mixFactorUniform = null;
    this.shapeTypeUniform = null;
    this.noiseUniform = null;
    this.timeUniform = null;
    
    // Dispose TSL material
    if (this.material?.isNodeMaterial) {
      // Replace with temporary material to avoid render errors
      const tempMaterial = new THREE.MeshBasicMaterial({ 
        visible: false,
        side: THREE.DoubleSide 
      });
      
      this.traverse((child) => {
        if (child.isMesh && child.material === this.material) {
          child.material = tempMaterial;
        }
      });
      
      // Dispose materials after render cycle
      setTimeout(() => {
        this.material?.dispose?.();
        tempMaterial.dispose();
      }, 0);
      
      this.material = null;
    }
    
    // When disabling TSL, restore the deformed geometry
    if (this.geometry) {
      this.geometry.dispose();
    }
    // Recreate the deformed geometry from parent class
    this.updateCurtainGeometry();
  }
  
  // TSL-specific methods
  setDualColor(enabled) {
    this.dualColor = enabled;
    
    if (this.enableTSL && this.material?.isNodeMaterial) {
      this.updateMaterialColorNode();
    } else if (this.enableTSL) {
      this.initializeTSL();
    }
  }
  
  // Update the material's color node without recreating everything
  updateMaterialColorNode() {
    if (!this.material || !this.material.isNodeMaterial) return;
    if (!this.colorUniform || !this.color2Uniform) return;
    
    try {
      // Import TSL functions
      const { TSL } = THREE;
      if (!TSL) return;
      
      const { uv, mix, sin, cos, mul, Fn } = TSL;
      
      // Recreate fabric noise function
      const fabricNoise = Fn(() => {
        const uvScaled = uv().mul(20);
        const noise1 = sin(uvScaled.x.mul(3.14)).mul(cos(uvScaled.y.mul(2.71)));
        const noise2 = sin(uvScaled.x.mul(1.73)).mul(cos(uvScaled.y.mul(4.12)));
        const combined = noise1.mul(0.3).add(noise2.mul(0.2));
        return combined.mul(0.1).add(1);
      });
      
      // Update color node based on dualColor setting
      if (this.dualColor) {
        const gradientFactor = uv().y;
        const baseColorMix = mix(this.colorUniform, this.color2Uniform, gradientFactor);
        const finalColor = baseColorMix.mul(fabricNoise());
        this.material.colorNode = finalColor;
        // Updated material to use dual color gradient
      } else {
        this.material.colorNode = this.colorUniform.mul(fabricNoise());
        // Updated material to use single color
      }
      
      // Force material update
      this.material.needsUpdate = true;
    } catch (error) {
      console.error('Error updating material color node:', error);
      // Fall back to reinitializing
      this.initializeTSL();
    }
  }
  
  setColor2(color) {
    this.curtainColor2 = color;
    
    if (this.enableTSL && this.color2Uniform) {
      this.color2Uniform.value = new THREE.Color(color);
      
      if (this.dualColor && this.emissiveUniform) {
        const color1 = new THREE.Color(this.curtainColor);
        const blendedColor = color1.clone().lerp(new THREE.Color(color), 0.5);
        this.emissiveUniform.value = blendedColor.multiplyScalar(0.1);
      }
      
      if (this.dualColor && this.material?.isNodeMaterial) {
        this.updateMaterialColorNode();
        this.updateLogoPosition();
      }
    } else if (this.enableTSL && !this.color2Uniform) {
      this.initializeTSL();
    } else {
      this.updateCurtainMaterial();
    }
  }
  
  setColorMixFactor(factor) {
    this.colorMixFactor = factor;
    if (this.mixFactorUniform) {
      this.mixFactorUniform.value = factor;
    }
  }
  
  setAnimateColorMix(enabled) {
    this.animateColorMix = enabled;
  }
  
  // Animation update for TSL effects
  updateAnimation(deltaTime) {
    if (this.enableTSL && this.timeUniform) {
      this.timeUniform.value += deltaTime;
      
      // Animate color mixing if enabled
      if (this.animateColorMix && this.mixFactorUniform) {
        const factor = Math.sin(this.timeUniform.value * 0.5) * 0.5 + 0.5;
        this.mixFactorUniform.value = factor;
      }
    }
  }
  
  // Presets for quick setup
  applyPreset(presetName) {
    const presets = {
      'tsl_theatre_red_blue': {
        enableTSL: true,
        curtainType: 'theatre',
        curtainColor: 0x8B0000,
        curtainColor2: 0x000080,
        dualColor: true,
        colorMixFactor: 0.3,
        metalness: 0.1,
        roughness: 0.8,
        folds: 14,
        foldDepth: 0.1
      },
      'standard_theatre_velvet': {
        curtainType: 'theatre',
        curtainColor: 0x8B0000,
        dualColor: false,
        metalness: 0.1,
        roughness: 0.8,
        folds: 14,
        foldDepth: 0.1
      },
      'standard_wave_silk': {
        curtainType: 'wave',
        curtainColor: 0x4169E1,
        dualColor: false,
        metalness: 0.3,
        roughness: 0.4,
        folds: 14,
        foldDepth: 0.2,
        noiseAmount: 0.05
      }
    };
    
    const preset = presets[presetName];
    if (preset) {
      // Use applyConfig to properly handle TSL state changes
      this.applyConfig(preset);
    }
  }
  
  // Enhanced config with TSL properties
  getConfig() {
    const baseConfig = super.getConfig();
    return {
      ...baseConfig,
      enableTSL: this.enableTSL,
      dualColor: this.dualColor,
      color2: this.curtainColor2,
      colorMixFactor: this.colorMixFactor,
      animateColorMix: this.animateColorMix
    };
  }
  
  applyConfig(config) {
    const wasUsingTSL = this.enableTSL && this.material?.isNodeMaterial;
    
    // Apply base properties
    if (config.width !== undefined) {
      this.width = config.width;
      // Mark as user override if this is a manual size change (not from stage sync)
      if (config.userManualChange) {
        this.userOverrideSize = true;
      }
    }
    if (config.height !== undefined) this.height = config.height;
    if (config.curtainType !== undefined) this.curtainType = config.curtainType;
    if (config.folds !== undefined) this.folds = config.folds;
    if (config.foldDepth !== undefined) this.foldDepth = config.foldDepth;
    if (config.noiseAmount !== undefined) this.noiseAmount = config.noiseAmount;
    if (config.curtainColor !== undefined) this.curtainColor = config.curtainColor;
    if (config.color !== undefined) this.curtainColor = config.color;
    if (config.metalness !== undefined) this.metalness = config.metalness;
    if (config.roughness !== undefined) this.roughness = config.roughness;
    
    // Apply TSL-specific properties
    if (config.enableTSL !== undefined) this.enableTSL = config.enableTSL;
    if (config.dualColor !== undefined) this.dualColor = config.dualColor;
    if (config.curtainColor2 !== undefined) this.curtainColor2 = config.curtainColor2;
    if (config.color2 !== undefined) this.curtainColor2 = config.color2;
    if (config.colorMixFactor !== undefined) this.colorMixFactor = config.colorMixFactor;
    if (config.animateColorMix !== undefined) this.animateColorMix = config.animateColorMix;
    
    // Handle material updates based on TSL state
    if (this.enableTSL) {
      if (wasUsingTSL) {
        setTimeout(() => {
          if (this.enableTSL && this.material?.isNodeMaterial) {
            this.updateTSLUniforms();
            this.updateMaterialColorNode();
          }
        }, 10);
      } else {
        this.initializeTSL();
      }
    } else {
      if (wasUsingTSL) {
        this.cleanupTSLResources();
      }
      this.updateCurtainGeometry();
      this.updateCurtainMaterial();
    }
  }

  // Override setColor for TSL curtains
  setColor(color) {
    super.setColor(color);
    
    if (this.enableTSL && this.colorUniform && this.emissiveUniform) {
      const newColor = new THREE.Color(color);
      this.colorUniform.value = newColor;
      this.emissiveUniform.value = new THREE.Color(color).multiplyScalar(0.1);
      
      if (this.dualColor && this.material?.isNodeMaterial) {
        this.updateMaterialColorNode();
        this.updateLogoPosition();
      }
    }
  }
}