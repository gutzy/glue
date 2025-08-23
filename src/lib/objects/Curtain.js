import * as THREE from 'three';
import { Box } from './Box.js';

export class Curtain extends Box {
  constructor(x, y, z, config = {}) {
    // Initialize with basic dimensions
    const width = config.width || 16;
    const height = config.height || 3.0; // Even lower - reduced from 4.2 to 3.0
    const depth = 0.5; // Minimal depth for collision detection
    
    super(x, y, z, width, height, depth, config.rotation || 0, false, false);
    
    // Store dimensions explicitly for curtain geometry
    this.width = width;
    this.height = height;
    
    // Curtain-specific properties
    this.type = 'curtain';
    this.curtainType = config.curtainType || 'theatre'; // theatre, wave, drape
    this.folds = config.folds || 12;
    this.foldDepth = config.foldDepth || 1.5;
    this.noiseAmount = config.noiseAmount || 0.3;
    this.curtainColor = config.color || 0x8B0000;
    this.curtainColor2 = config.color2 || 0x000080; // For dual color TSL
    this.metalness = config.metalness || 0.1;
    this.roughness = config.roughness || 0.8;
    this.logoTexture = null;
    this.logoSize = config.logoSize || 3;
    this.followFolds = config.followFolds !== false;
    this.noiseSeed = Math.random() * 1000;
    
    // Replace the basic box geometry with curtain geometry
    this.updateCurtainGeometry();
    this.updateCurtainMaterial();
    
    // Add logo immediately if logoUrl is provided in config
    if (config.logoUrl) {
      this.addLogo(config.logoUrl, { size: this.logoSize });
    }
    
    // Ground-based positioning - curtain extends upward from floor
    this.position.y = y + height / 2;
    
    // Ensure curtain is visible
    this.visible = true;
    this.castShadow = true;
    this.receiveShadow = true;
  }
  
  updateCurtainGeometry() {
    // Dispose old geometry
    if (this.geometry) {
      this.geometry.dispose();
    }
    
    // Ensure valid dimensions
    this.width = this.width > 0 ? this.width : 16;
    this.height = this.height > 0 ? this.height : 3.0;
    
    const segments = Math.max(120, this.folds * 12);
    const geometry = new THREE.PlaneGeometry(this.width, this.height, segments, segments);
    
    const positions = geometry.attributes.position;
    const count = positions.count;
    
    for (let i = 0; i < count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      let z = 0;
      
      if (this.curtainType === 'theatre') {
        // Vertical folds with scalloped top
        z = Math.sin(x * this.folds * 0.5) * this.foldDepth;
        
        // Add scalloped top where curtain hangs from
        const topFactor = (y + this.height/2) / this.height;
        if (topFactor > 0.6) {
          z *= 1 + Math.sin(x * this.folds) * 0.3 * topFactor;
        }
      } else if (this.curtainType === 'wave') {
        // Complex wave with multiple frequencies and static noise
        const baseWave = Math.sin(x * this.folds * 0.3) * this.foldDepth;
        const secondaryWave = Math.sin(x * this.folds * 0.7) * this.foldDepth * 0.5;
        const tertiaryWave = Math.cos(x * this.folds * 1.3) * this.foldDepth * 0.25;
        
        // Static simplex noise approximation
        const noise1 = Math.sin(x * 2.3 + this.noiseSeed) * Math.cos(y * 1.7 + this.noiseSeed * 0.3);
        const noise2 = Math.sin(x * 5.7 + this.noiseSeed * 1.7) * Math.cos(y * 3.1 + this.noiseSeed * 0.8);
        const noise3 = Math.cos(x * 9.1 + this.noiseSeed * 2.1) * Math.sin(y * 7.3 + this.noiseSeed * 1.3);
        
        const combinedNoise = (noise1 + noise2 * 0.5 + noise3 * 0.25) * this.noiseAmount;
        
        z = baseWave + secondaryWave + tertiaryWave + combinedNoise * this.foldDepth;
        
        // Add vertical variation
        const verticalVariation = Math.sin(y * 2) * 0.2;
        z *= (1 + verticalVariation);
      } else if (this.curtainType === 'drape') {
        // Heavy draping with gravity effect
        const drapeAmount = Math.pow(Math.abs(x) / (this.width/2), 2);
        z = drapeAmount * this.foldDepth * 2;
        
        // Add vertical weight
        const gravityFactor = (y + this.height/2) / this.height;
        z *= (1 + gravityFactor * 0.5);
      }
      
      // Ensure valid z value
      z = isFinite(z) ? z : 0;
      
      positions.setZ(i, z);
    }
    
    geometry.computeVertexNormals();
    this.geometry = geometry;
    
    // Update logo position if it exists
    this.updateLogoPosition();
  }
  
  updateCurtainMaterial() {
    // Dispose old material
    if (this.material?.dispose) {
      this.material.dispose();
    }
    
    const curtainColor = new THREE.Color(this.curtainColor);
    
    const material = new THREE.MeshStandardMaterial({
      color: curtainColor,
      emissive: curtainColor.clone().multiplyScalar(0.15), // Add some emissive glow
      metalness: this.metalness,
      roughness: this.roughness,
      side: THREE.DoubleSide,
      shadowSide: THREE.DoubleSide
    });
    
    // Create fabric texture for enhanced realism
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Create fabric weave pattern
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 512, 512);
    
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1;
    
    // Vertical lines
    for (let i = 0; i < 512; i += 3) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
    }
    
    // Horizontal lines
    for (let i = 0; i < 512; i += 3) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.repeat.set(8, 8);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    
    material.map = texture;
    material.bumpMap = texture;
    material.bumpScale = 0.05;
    
    this.material = material;
    
    // Update logo position if it exists
    this.updateLogoPosition();
  }
  
  // Override setColor to update curtain color and emissive
  setColor(color) {
    this.curtainColor = color;
    if (this.material) {
      const newColor = new THREE.Color(color);
      this.material.color.copy(newColor);
      this.material.emissive.copy(newColor.clone().multiplyScalar(0.15));
      this.material.needsUpdate = true;
    }
  }
  
  // Curtain-specific methods
  setCurtainType(type) {
    this.curtainType = type;
    this.updateCurtainGeometry();
  }
  
  setFolds(folds) {
    this.folds = folds;
    this.updateCurtainGeometry();
  }
  
  setFoldDepth(depth) {
    this.foldDepth = depth;
    this.updateCurtainGeometry();
  }
  
  setNoiseAmount(amount) {
    this.noiseAmount = amount;
    this.noiseSeed = Math.random() * 1000; // New pattern
    this.updateCurtainGeometry();
  }
  
  setMaterialProps(metalness, roughness) {
    this.metalness = metalness;
    this.roughness = roughness;
    if (this.material) {
      this.material.metalness = metalness;
      this.material.roughness = roughness;
    }
  }
  
  addDefaultLogo() {
    // Create a simple canvas texture as default logo
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // Create a simple geometric pattern
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 256);
    
    // Add a simple star or diamond pattern
    ctx.fillStyle = '#888888';
    ctx.beginPath();
    ctx.moveTo(128, 50);
    ctx.lineTo(160, 120);
    ctx.lineTo(206, 120);
    ctx.lineTo(170, 160);
    ctx.lineTo(180, 206);
    ctx.lineTo(128, 180);
    ctx.lineTo(76, 206);
    ctx.lineTo(86, 160);
    ctx.lineTo(50, 120);
    ctx.lineTo(96, 120);
    ctx.closePath();
    ctx.fill();
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
      this.removeLogo();
    
    this.logoTexture = texture;
    
    const segments = 8;
    const logoGeometry = new THREE.PlaneGeometry(this.logoSize, this.logoSize, segments, segments);
    const logoMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      alphaTest: 0.1
    });
    
    this.logoMesh = new THREE.Mesh(logoGeometry, logoMaterial);
    
    // Position and deform logo
    if (this.followFolds && (this.curtainType === 'theatre' || this.curtainType === 'wave')) {
      this.createCurvedLogoGeometry(logoGeometry);
      // Calculate bounding box to get centerZ
      this.geometry.computeBoundingBox();
      const centerZ = this.geometry.boundingBox.max.z;
      const offset = this.logoOffset || 0.15;
      this.logoMesh.position.set(0, 0, centerZ + offset);
    } else {
      const offset = this.logoOffset || 0.12;
      this.logoMesh.position.set(0, 0, offset);
    }
    
    this.add(this.logoMesh);
  }

  addLogo(imageUrl, options = {}) {
    this.removeLogo();
    
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(imageUrl, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = true;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      
      this.logoTexture = texture;
      this.logoSize = options.size || 3;
      
      // Create logo geometry with more subdivisions for better curve following
      const segments = this.followFolds ? 16 : 4; // More detail when following folds
      const logoGeometry = new THREE.PlaneGeometry(this.logoSize, this.logoSize, segments, segments);
      const logoMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        alphaTest: 0.1
      });
      
      this.logoMesh = new THREE.Mesh(logoGeometry, logoMaterial);
      
      // Position and deform logo to follow curtain geometry
      if (this.followFolds && this.curtainType !== 'flat') {
        // Create a deformed geometry that follows the curtain surface
        this.createCurvedLogoGeometry(logoGeometry);
        
        // Position at curtain center with configurable offset
        const centerZ = this.sampleCurtainDepthAtPosition(0, 0);
        const offset = this.logoOffset || 0.15;
        this.logoMesh.position.set(0, 0, centerZ + offset);
      } else {
        // For flat curtains or when not following folds
        const offset = this.logoOffset || 0.12;
        this.logoMesh.position.set(0, 0, offset);
      }
      
      this.add(this.logoMesh);
    });
  }
  
  // Create curved logo geometry that follows curtain surface
  createCurvedLogoGeometry(logoGeometry) {
    const positions = logoGeometry.attributes.position;
    const logoSize = this.logoSize || 3;
    
    // Get the bounds of the logo relative to curtain size
    const logoWidthRatio = logoSize / this.width;
    const logoHeightRatio = logoSize / this.height;
    
    // Sample curtain surface across the logo area and deform logo vertices
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      
      // Convert logo local coordinates to curtain coordinates
      const curtainX = x * logoWidthRatio * this.width;
      const curtainY = y * logoHeightRatio * this.height;
      
      // Sample the curtain depth at this position
      const surfaceZ = this.sampleCurtainDepthAtPosition(curtainX, curtainY);
      
      // Apply the surface curvature to the logo vertex
      // Scale the effect based on distance from center for natural curvature
      const distanceFromCenter = Math.sqrt(x*x + y*y) / (logoSize/2);
      const baseCurvatureStrength = this.logoCurveSensitivity || 0.8; // Configurable sensitivity
      const curvatureStrength = baseCurvatureStrength * (1 - distanceFromCenter * 0.2); // Reduce at edges
      
      positions.setZ(i, surfaceZ * curvatureStrength);
    }
    
    // Update the geometry
    logoGeometry.computeVertexNormals();
    logoGeometry.attributes.position.needsUpdate = true;
  }

  // Sample curtain depth at a specific position to match logo positioning
  sampleCurtainDepthAtPosition(x, y) {
    let z = 0;
    
    if (this.curtainType === 'theatre') {
      // Vertical folds with scalloped top
      z = Math.sin(x * this.folds * 0.5) * this.foldDepth;
      
      // Add scalloped top where curtain hangs from
      const topFactor = (y + this.height/2) / this.height;
      if (topFactor > 0.6) {
        z *= 1 + Math.sin(x * this.folds) * 0.3 * topFactor;
      }
    } else if (this.curtainType === 'wave') {
      // Complex wave with multiple frequencies
      const baseWave = Math.sin(x * this.folds * 0.3) * this.foldDepth;
      const secondaryWave = Math.sin(x * this.folds * 0.7) * this.foldDepth * 0.5;
      const tertiaryWave = Math.cos(x * this.folds * 1.3) * this.foldDepth * 0.25;
      
      z = baseWave + secondaryWave + tertiaryWave;
      
      // Add vertical variation
      const verticalVariation = Math.sin(y * 2) * 0.2;
      z *= (1 + verticalVariation);
    } else if (this.curtainType === 'drape') {
      // Heavy draping with gravity effect
      const drapeAmount = Math.pow(Math.abs(x) / (this.width/2), 2);
      z = drapeAmount * this.foldDepth * 2;
      
      // Add vertical weight
      const gravityFactor = (y + this.height/2) / this.height;
      z *= (1 + gravityFactor * 0.5);
    }
    
    // Ensure valid z value
    z = isFinite(z) ? z : 0;
    
    return z;
  }

  // Update logo position to match curtain geometry
  updateLogoPosition() {
    if (this.logoMesh) {
      if (this.followFolds && this.curtainType !== 'flat') {
        // Regenerate curved geometry to match current curtain state
        this.createCurvedLogoGeometry(this.logoMesh.geometry);
        
        // Update position with configurable offset
        const centerZ = this.sampleCurtainDepthAtPosition(0, 0);
        const offset = this.logoOffset || 0.15;
        this.logoMesh.position.set(0, 0, centerZ + offset);
      } else {
        // Reset to flat geometry for flat curtains
        const logoSize = this.logoSize || 3;
        const segments = this.followFolds ? 16 : 4;
        const flatGeometry = new THREE.PlaneGeometry(logoSize, logoSize, segments, segments);
        this.logoMesh.geometry.dispose();
        this.logoMesh.geometry = flatGeometry;
        const offset = this.logoOffset || 0.12;
        this.logoMesh.position.set(0, 0, offset);
      }
    }
  }

  // Control logo curve sensitivity and positioning
  setLogoCurveSensitivity(sensitivity = 0.8) {
    this.logoCurveSensitivity = sensitivity;
    if (this.logoMesh && this.followFolds) {
      this.updateLogoPosition();
    }
  }
  
  setLogoOffset(offset = 0.15) {
    this.logoOffset = offset;
    if (this.logoMesh) {
      this.updateLogoPosition();
    }
  }
  
  setLogoSize(size) {
    this.logoSize = size;
    if (this.logoMesh) {
      // Recreate logo geometry with new size
      const segments = this.followFolds ? 16 : 4;
      const newGeometry = new THREE.PlaneGeometry(this.logoSize, this.logoSize, segments, segments);
      
      // Apply curve following if needed
      if (this.followFolds && this.curtainType !== 'flat') {
        this.createCurvedLogoGeometry(newGeometry);
      }
      
      // Replace the geometry
      this.logoMesh.geometry.dispose();
      this.logoMesh.geometry = newGeometry;
      
      // Update position
      this.updateLogoPosition();
    }
  }

  removeLogo() {
    if (this.logoMesh) {
      this.remove(this.logoMesh);
      this.logoMesh.geometry.dispose();
      this.logoMesh.material.dispose();
      this.logoMesh = null;
      this.logoTexture = null;
    }
  }
  
  // Scale curtain to stage width
  scaleToStageWidth(stageWidth, userManualChange = false) {
    this.width = stageWidth;
    if (userManualChange) {
      this.userOverrideSize = true;
    }
    this.updateCurtainGeometry();
  }

  // Set curtain width to match stage width
  setWidthToStage(stageWidth) {
    this.width = stageWidth;
    this.updateCurtainGeometry();
    this.updateCurtainMaterial();
  }
  
  // Get configuration for saving/loading
  getConfig() {
    return {
      type: this.type,
      curtainType: this.curtainType,
      width: this.width,
      height: this.height,
      folds: this.folds,
      foldDepth: this.foldDepth,
      noiseAmount: this.noiseAmount,
      color: this.curtainColor,
      color2: this.curtainColor2,
      metalness: this.metalness,
      roughness: this.roughness,
      logoSize: this.logoSize,
      followFolds: this.followFolds,
      position: {
        x: this.position.x,
        y: this.position.y,
        z: this.position.z
      },
      rotation: this.rotation.y
    };
  }
  
  // Apply configuration
  applyConfig(config) {
    Object.assign(this, config);
    this.updateCurtainGeometry();
    this.updateCurtainMaterial();
    if (config.position) {
      this.position.set(config.position.x, config.position.y, config.position.z);
    }
    if (config.rotation !== undefined) {
      this.rotation.y = config.rotation;
    }
  }


}