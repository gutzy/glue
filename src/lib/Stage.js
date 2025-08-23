// Import WebGPU version of Three.js for TSL support
import * as THREE from 'three/webgpu';
import Tween from './utils/Tween.js';
import { SceneManager } from './managers/SceneManager.js';
import { ControlsManager } from './managers/ControlsManager.js';
import {ObjectManager} from "./managers/ObjectManager";
import { CollisionHandler } from './CollisionHandler.js';
import {EventDispatcher, OrthographicCamera, PerspectiveCamera} from "three";
import Config from "./Config";
import {initNavCube, resetNavCameraType, updateNavCubePosition, updateNavCubeRotation} from "./utils/NavigationCube";
// import { GlueTestingBackdoor } from './TestingBackdoor.js';

export class Stage extends EventDispatcher {
  constructor(container, config = {}) {
    super()
    this.glueId = -1
    this.container = container
    this.config = new Config(config)
    this.scene = new THREE.Scene()
    this.camera = null
    this.mouse = new THREE.Vector2()
    this.raycaster = new THREE.Raycaster()
    this.intersectPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0))
    
    // Track initialization state
    this.isInitialized = false
    this.initializationPromise = null
    
    // Track stage width in meters for curtain synchronization
    this.currentStageWidth = null // Will be set when stage size is configured
    this.syncInProgress = false // Prevent concurrent sync operations

    // Initialize renderer with WebGPU support for TSL, fallback to WebGL
    this.initializationPromise = this.initializeRenderer(container).then(() => {
      this.setCamera(config.cameraType || 'perspective')

      this.sceneManager = new SceneManager(this.scene, this.camera, this.container, this.config)
      this.controlsManager = new ControlsManager(this.camera, this.renderer.domElement, this, this.config)
      this.objectManager = new ObjectManager(this, this.scene, this.config)
      this.collisionHandler = new CollisionHandler(this.objectManager)

      this.bindListeners()
      this.animate()

      if (this.config.animateCameraZoom) {
        setTimeout(() => this.controlsManager.animateCameraZoom())
      }
      else {
        this.controlsManager.resetCameraPosition()
      }
      if (this.config.dragItems) {
        this.controlsManager.initDragControls(this.objectManager.getDraggableBoxes(), this.renderer.domElement)
      }

      // if there's a navigation cube in the settings, add it
      setTimeout(() => {
          this.initializeNavigationCube()
          this.resetStageHeight(this.container.clientHeight)
      }, 100)

      // Initialize testing backdoor (always created but only enabled when needed)
      this.testingBackdoor = new GlueTestingBackdoor(this);
      
      // Enable testing backdoor if configured or ?testing=true URL parameter
      if (config.enableTesting || 
          (typeof window !== 'undefined' && window.location.search.includes('testing=true'))) {
        this.testingBackdoor.enable();
        console.log('[GLUE] Testing backdoor enabled');
      }

      // Expose stage globally for testing
      if (typeof window !== 'undefined') {
        window.glueStage = this;
      }
      
      // Mark as initialized and emit ready event
      this.isInitialized = true;
      this.dispatchEvent({ type: 'stage-ready' });
    });
  }
  
  // Method to wait for stage initialization
  async waitForInitialization() {
    if (this.isInitialized) {
      return Promise.resolve();
    }
    return this.initializationPromise;
  }

  async initializeRenderer(container) {
    let rendererInitialized = false;
    
    // First try WebGPU if available
    if (THREE.WebGPURenderer && navigator.gpu) {
      try {
        console.log('[GLUE] Attempting WebGPU renderer initialization...');
        this.renderer = new THREE.WebGPURenderer({ 
          antialias: true, 
          preserveDrawingBuffer: true
        });
        // Initialize WebGPU renderer
        await this.renderer.init();
        console.log('[GLUE] WebGPURenderer initialized successfully');
        rendererInitialized = true;
      } catch (error) {
        console.warn('[GLUE] WebGPURenderer initialization failed:', error.message);
        this.renderer = null;
      }
    }
    
    // Fallback to WebGL if WebGPU failed or isn't available
    if (!rendererInitialized) {
      try {
        console.log('[GLUE] Using WebGLRenderer fallback...');
        // Import regular Three.js for WebGL fallback
        const { WebGLRenderer } = await import('three');
        this.renderer = new WebGLRenderer({ 
          antialias: true, 
          preserveDrawingBuffer: true 
        });
        console.log('[GLUE] WebGLRenderer initialized as fallback');
        rendererInitialized = true;
      } catch (error) {
        console.error('[GLUE] Failed to initialize any renderer:', error);
        throw new Error('Failed to initialize renderer');
      }
    }
    
    if (this.renderer) {
      this.renderer.setSize(container.clientWidth, container.clientHeight);
      // Ensure proper color space for accurate color reproduction
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      container.appendChild(this.renderer.domElement);
    }
  }

  bindListeners() {
    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this), false)
    this.renderer.domElement.addEventListener('mouseup', this.onMouseUp.bind(this), false)
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this), false)
    window.addEventListener('resize', this.onWindowResize.bind(this), false)
  }

  initializeNavigationCube() {
    let width = this.container.clientWidth, height = this.container.clientHeight;
    this.navScene = this.config.navigationCube ? initNavCube(this.config, this.camera, width, height) : null;
  }

  add(item) {
    this.objectManager.add(item)
  }

  remove(item, byType) {
    this.objectManager.remove(item, byType)
  }

  getByUniqueId(uniqueId) {
    return this.objectManager.boxes.find(box => box.uniqueId === uniqueId);
  }

  setCamera(cameraType) {
    const aspect = this.container.clientWidth / this.container.clientHeight;

    if (cameraType === 'orthographic') {
      this.camera = new OrthographicCamera(-50 * aspect, 50 * aspect, 50, -50, 0.1, 1000);
      this.camera.zoom = this.config.cameraInitialZoom
      this.camera.updateProjectionMatrix()
    } else {
      this.camera = new PerspectiveCamera(75, aspect, 0.1, 1000);
    }

    this.camera.position.set(0, this.config.cameraPosY, this.config.cameraPosZ);
    this.camera.lookAt(0, this.config.lookAtY, 0);
    if (this.config.rotation) { this.camera.rotation.z = this.config.rotation * Math.PI / 180; }

    if (this.controlsManager) {
      this.controlsManager.setCamera(this.camera);
      if (this.config.dragItems) {
        this.controlsManager.initDragControls(this.objectManager.getDraggableBoxes(), this.renderer.domElement);
      }
    }

    if (this.navScene) {
      this.navScene.camera = resetNavCameraType(cameraType, this.container.clientWidth, this.container.clientHeight)
    }
  }

  resetStageHeight(height) {
    let width = this.container.clientWidth
    const aspect = width / height;
    this.renderer.setSize(this.container.clientWidth, height)
    if (this.camera.isPerspectiveCamera) {
      this.camera.aspect = aspect;
    } else if (this.camera.isOrthographicCamera) {
      const viewSize = this.camera.top - this.camera.bottom;
      this.camera.left = -viewSize * aspect / 2;
      this.camera.right = viewSize * aspect / 2;
      this.camera.top = viewSize / 2;
      this.camera.bottom = -viewSize / 2;
    }
    this.camera.updateProjectionMatrix();

    if (this.navScene) {
      this.navScene.camera = resetNavCameraType(this.camera.isPerspectiveCamera ? 'perspective' : 'orthographic', width, height)
    }
    
    // Sync curtain width with stage width (unless user has overridden)
    this.syncCurtainWidthToStage(width);
  }

  syncCurtainWidthToStage(stageWidth) {
    // Only sync if stage is initialized and has curtains
    if (!this.isInitialized || !this.objectManager || !this.objectManager.curtains) {
      return;
    }
    
    // Convert container width to stage units (assuming 1 pixel ≈ 0.1 stage units)
    const curtainWidth = Math.max(stageWidth * 0.1, 5); // Minimum 5 units
    
    // Defer curtain updates to prevent interference with active rendering
    setTimeout(() => {
      // Double-check that curtains still exist after timeout
      if (!this.objectManager || !this.objectManager.curtains) {
        return;
      }
      
      // Update all curtains that haven't been manually overridden
      this.objectManager.curtains.forEach(curtain => {
        // Check if curtain has been manually sized (user override)
        if (!curtain.userOverrideSize) {
          // Use the direct width setting method
          if (curtain.setWidthDirect) {
            curtain.setWidthDirect(curtainWidth);
            console.log(`[GLUE] Synced curtain ${curtain.uniqueId} width to stage: ${curtainWidth} units`);
          } else {
            console.warn(`[GLUE] Curtain ${curtain.uniqueId} doesn't have setWidthDirect method`);
          }
        }
      });
    }, 50); // Small delay to avoid render conflicts
  }

  syncCurtainWidthToStageMeters(stageWidthMeters) {
    // Validate and store stage width
    if (!stageWidthMeters || stageWidthMeters <= 0) return;
    
    this.currentStageWidth = Math.max(stageWidthMeters, 1);
    
    // Only sync if initialized with curtains
    if (!this.isInitialized || !this.objectManager?.curtains?.length) return;
    
    // Defer updates to avoid render conflicts
    setTimeout(() => {
      this.objectManager.curtains?.forEach(curtain => {
        if (curtain.setWidthToStage) {
          curtain.setWidthToStage(this.currentStageWidth);
        }
      });
    }, 50);
  }

  // Sync a single curtain to the current stage width (for newly added curtains)
  syncNewCurtainToStageWidth(curtain) {
    if (curtain?.setWidthToStage && this.currentStageWidth) {
      curtain.setWidthToStage(this.currentStageWidth);
    }
  }

  // Get current stage width (for external access)
  getCurrentStageWidth() {
    return this.currentStageWidth;
  }

  // Set stage width without sync (for initialization)
  setStageWidth(stageWidth) {
    const width = Math.max(stageWidth, 1); // Minimum 1 meter
    this.currentStageWidth = width;
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.cameraType) {
      this.setCamera(newConfig.cameraType);
    }
    
    // Only update controlsManager if stage is initialized
    if (this.isInitialized && this.controlsManager) {
      this.controlsManager.updateConfig(this.config);
    } else {
      console.warn('[Stage] updateConfig called before Stage initialization complete');
    }
  }

  updateRaycaster() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    this.dispatchEvent({type: 'move-intersect', intersects});
  }

  animate() {
    // Guard against undefined renderer
    if (!this.renderer) {
      console.warn('[GLUE] Renderer not initialized, skipping animation frame');
      return;
    }

    requestAnimationFrame((time) => {
      this.dispatchEvent({type: 'before-render', time});
      
      try {
        this.renderer.render(this.scene, this.camera);
      } catch (error) {
        console.error('[GLUE] Render error:', error);
        
        // Check if this is a TSL uniform error and handle it
        if (error.message && error.message.includes('Uniform "null" not declared')) {
          console.warn('[GLUE] TSL uniform error detected, attempting to disable TSL curtains');
          this.handleTSLRenderError();
          
          // Skip this render cycle to allow material replacement
          setTimeout(() => this.animate(), 50);
          return;
        }
        
        // Don't continue animation if render fails
        return;
      }
      
      this.animate()
      Tween.update(time)
      this.dispatchEvent({type: 'after-render', time});
    });

    // if there's a nav scene, render it
    if (this.navScene && this.renderer) {
      updateNavCubePosition()
      updateNavCubeRotation()
      this.renderer.autoClear = false; // Prevent clearing the main scene
      
      // Check if clearDepth method exists (WebGL specific)
      if (typeof this.renderer.clearDepth === 'function') {
        this.renderer.clearDepth(); // Clear depth buffer for the overlay scene
      }
      
      try {
        this.renderer.render(this.navScene.scene, this.navScene.camera);
      } catch (error) {
        console.error('[GLUE] Nav scene render error:', error);
      }
    }
  }

  onWindowResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const aspect = width / height;

    if (this.camera.isPerspectiveCamera) {
      this.camera.aspect = aspect;
    } else if (this.camera.isOrthographicCamera) {
      const viewSize = this.camera.top - this.camera.bottom;
      this.camera.left = -viewSize * aspect / 2;
      this.camera.right = viewSize * aspect / 2;
      this.camera.top = viewSize / 2;
      this.camera.bottom = -viewSize / 2;
    }

    if (this.navScene) {
      this.navScene.camera = resetNavCameraType(this.camera.isPerspectiveCamera ? 'perspective' : 'orthographic', width, height)
    }

    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    
    // Sync curtain width with stage width on resize
    // Use the consistent method that works in meters
    this.syncCurtainWidthToStageMeters(width * 0.1); // Convert pixels to approximate meters
  }


  onMouseDown(event) {
    const rect = event.target.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    let intersects = this.raycaster.intersectObjects(this.scene.children, true);
    let parent
    let something = false

    intersects = intersects.filter(intersect => intersect.object.visible)

    for (let i = 0; i < intersects.length; i++) {
      parent = intersects[i].object.parent || null;

      if (intersects[i].object.type === 'Mesh' &&
          intersects[i].object.name !== 'ground' &&
          intersects[i].object.name !== 'XYZ'
      ) {
        let skipGizmo = false
        if (intersects[i].object.parent) {
          let p = intersects[i].object.parent
          while (p && p.parent) {
            if (p.type === "TransformControlsGizmo") {
              skipGizmo = true
            }
            p = p.parent
          }
        }
        if (!skipGizmo) { something = true }
      }

      if (intersects[i].object.type === 'model') {
        break;
      }

      if (intersects[i].object.name === 'ground' && !something) {
        this.dispatchEvent({type:'ground-clicked'})
        break;
      }
    }

    this.dispatchEvent({type:'mouse-clicked'})
  }

  onMouseMove(event) {
    const rect = event.target.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.updateRaycaster(); // Update raycaster on mouse move

    // for dispatching the stage coordinates, get them:
    let stageCoordinates = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.intersectPlane, stageCoordinates);
    event.stageCoords = stageCoordinates;

    this.dispatchEvent({type: 'mouse-move', event});
  }

  onMouseUp(event) {
    this.dispatchEvent({type: 'mouse-up', event});
  }

  handleTSLRenderError() {
    // Prevent handling multiple errors in quick succession
    if (this._handlingTSLError) {
      return;
    }
    this._handlingTSLError = true;
    
    // Find all TSL curtains and convert them to standard curtains
    if (this.objectManager && this.objectManager.curtains) {
      console.log('[GLUE] Converting TSL curtains to standard curtains due to render error');
      
      const curtainsToRestore = [];
      
      this.objectManager.curtains.forEach(curtain => {
        if (curtain.enableTSL) {
          console.log('[GLUE] Disabling TSL for curtain:', curtain.uniqueId);
          curtain.enableTSL = false;
          
          // Store parent reference before removing
          const parentRef = curtain.parent;
          
          // Temporarily remove from scene during material switch
          if (parentRef) {
            parentRef.remove(curtain);
            curtainsToRestore.push({curtain, parent: parentRef});
          }
          
          // Force fallback to standard material
          if (curtain.updateCurtainMaterial) {
            curtain.updateCurtainMaterial();
          }
        }
      });
      
      // Restore curtains to scene after material switch
      setTimeout(() => {
        curtainsToRestore.forEach(({curtain, parent}) => {
          if (parent && curtain && !curtain.parent) {
            parent.add(curtain);
            console.log('[GLUE] Restored curtain to scene with standard material:', curtain.uniqueId);
          } else if (!parent || !curtain) {
            console.warn('[GLUE] Cannot restore curtain - parent or curtain is null');
          }
        });
        
        // Reset the flag after restoration
        this._handlingTSLError = false;
      }, 100);
      
      // Emit event to notify UI that TSL is disabled
      this.dispatchEvent({type: 'tsl-disabled', reason: 'render-error'});
    } else {
      this._handlingTSLError = false;
    }
  }


}


