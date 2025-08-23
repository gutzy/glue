/**
 * Glue Testing Backdoor
 * 
 * Provides real-time access to Three.js internals for testing
 * Exposes object positions, rotations, scene state, and events
 */

export class GlueTestingBackdoor {
  constructor(stage) {
    this.stage = stage;
    this.enabled = false;
    this.listeners = new Map();
    this.eventLog = [];
    this.stateSnapshot = null;
    
    // Expose to global window for test access
    if (typeof window !== 'undefined') {
      window.__GLUE_TESTING__ = this;
    }
  }

  /**
   * Enable testing mode - starts monitoring and logging
   */
  enable() {
    this.enabled = true;
    this.setupEventMonitoring();
    this.setupStateTracking();
    console.log('[GLUE TESTING] Backdoor enabled - monitoring started');
    
    // Initial state capture
    this.captureState();
  }

  /**
   * Disable testing mode
   */
  disable() {
    this.enabled = false;
    this.clearEventMonitoring();
    console.log('[GLUE TESTING] Backdoor disabled');
  }

  /**
   * Setup comprehensive event monitoring
   */
  setupEventMonitoring() {
    // Monitor drag events
    this.monitorDragEvents();
    
    // Monitor object manager events
    this.monitorObjectManager();
    
    // Monitor scene changes
    this.monitorScene();
    
    // Monitor camera changes
    this.monitorCamera();
  }

  /**
   * Monitor drag and drop events
   */
  monitorDragEvents() {
    if (this.stage.controlsManager && this.stage.controlsManager.dragControls) {
      const dragControls = this.stage.controlsManager.dragControls;
      
      const originalDragStart = dragControls.activate.bind(dragControls);
      const originalDragEnd = dragControls.deactivate.bind(dragControls);
      
      dragControls.activate = () => {
        this.logEvent('DRAG_START', { timestamp: Date.now() });
        return originalDragStart();
      };
      
      dragControls.deactivate = () => {
        this.logEvent('DRAG_END', { timestamp: Date.now() });
        return originalDragEnd();
      };
    }
  }

  /**
   * Monitor object manager operations
   */
  monitorObjectManager() {
    const objectManager = this.stage.objectManager;
    
    // Monitor box additions
    const originalAddBox = objectManager.addBox?.bind(objectManager);
    if (originalAddBox) {
      objectManager.addBox = (...args) => {
        const result = originalAddBox(...args);
        this.logEvent('BOX_ADDED', {
          boxId: result?.uniqueId,
          position: result?.position,
          args: args
        });
        return result;
      };
    }

    // Monitor model loading
    const originalLoadGLTF = objectManager.loadGLTFModel?.bind(objectManager);
    if (originalLoadGLTF) {
      objectManager.loadGLTFModel = async (...args) => {
        this.logEvent('MODEL_LOAD_START', { url: args[0] });
        const result = await originalLoadGLTF(...args);
        this.logEvent('MODEL_LOAD_END', {
          url: args[0],
          boxId: result?.boxId,
          success: !!result
        });
        return result;
      };
    }
  }

  /**
   * Monitor scene changes
   */
  monitorScene() {
    const scene = this.stage.scene;
    
    const originalAdd = scene.add.bind(scene);
    scene.add = (...objects) => {
      this.logEvent('SCENE_ADD', {
        objectCount: objects.length,
        objectTypes: objects.map(obj => obj.type || obj.constructor.name)
      });
      return originalAdd(...objects);
    };

    const originalRemove = scene.remove.bind(scene);
    scene.remove = (...objects) => {
      this.logEvent('SCENE_REMOVE', {
        objectCount: objects.length,
        objectTypes: objects.map(obj => obj.type || obj.constructor.name)
      });
      return originalRemove(...objects);
    };
  }

  /**
   * Monitor camera changes
   */
  monitorCamera() {
    if (this.stage.camera) {
      // Monitor camera position changes
      let lastCameraPosition = this.stage.camera.position.clone();
      const checkCameraChanges = () => {
        if (!this.stage.camera.position.equals(lastCameraPosition)) {
          this.logEvent('CAMERA_MOVED', {
            position: this.stage.camera.position.toArray(),
            previousPosition: lastCameraPosition.toArray()
          });
          lastCameraPosition = this.stage.camera.position.clone();
        }
        if (this.enabled) {
          requestAnimationFrame(checkCameraChanges);
        }
      };
      requestAnimationFrame(checkCameraChanges);
    }
  }

  /**
   * Log an event with timestamp and context
   */
  logEvent(type, data = {}) {
    if (!this.enabled) return;
    
    const event = {
      type,
      timestamp: Date.now(),
      ...data
    };
    
    this.eventLog.push(event);
    console.log(`[GLUE TESTING] ${type}:`, data);
    
    // Trigger listeners
    const listeners = this.listeners.get(type) || [];
    listeners.forEach(callback => callback(event));
    
    // Keep log size manageable
    if (this.eventLog.length > 1000) {
      this.eventLog = this.eventLog.slice(-500);
    }
  }

  /**
   * Add event listener
   */
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(type, callback) {
    const listeners = this.listeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Capture current state snapshot
   */
  captureState() {
    this.stateSnapshot = {
      timestamp: Date.now(),
      objects: this.getObjectsState(),
      camera: this.getCameraState(),
      scene: this.getSceneState()
    };
    
    console.log('[GLUE TESTING] State captured:', this.stateSnapshot);
    return this.stateSnapshot;
  }

  /**
   * Get all objects state (positions, rotations, etc.)
   */
  getObjectsState() {
    const objects = [];
    
    if (this.stage.objectManager) {
      // Get all boxes
      this.stage.objectManager.boxes.forEach(box => {
        objects.push({
          type: 'box',
          uniqueId: box.uniqueId,
          name: box.name,
          position: box.position.toArray(),
          rotation: [box.rotation.x, box.rotation.y, box.rotation.z],
          scale: box.scale.toArray(),
          visible: box.visible,
          meta: box.meta
        });
      });

      // Get all models
      this.stage.objectManager.models.forEach(model => {
        objects.push({
          type: 'model',
          boxId: model.boxId,
          url: model.url,
          position: model.position.toArray(),
          rotation: [model.rotation.x, model.rotation.y, model.rotation.z],
          scale: model.scale.toArray(),
          visible: model.visible
        });
      });
    }

    return objects;
  }

  /**
   * Get camera state
   */
  getCameraState() {
    if (!this.stage.camera) return null;
    
    return {
      type: this.stage.camera.type,
      position: this.stage.camera.position.toArray(),
      rotation: [this.stage.camera.rotation.x, this.stage.camera.rotation.y, this.stage.camera.rotation.z],
      zoom: this.stage.camera.zoom,
      far: this.stage.camera.far,
      near: this.stage.camera.near
    };
  }

  /**
   * Get scene state
   */
  getSceneState() {
    return {
      childrenCount: this.stage.scene.children.length,
      childrenTypes: this.stage.scene.children.map(child => child.type || child.constructor.name)
    };
  }

  /**
   * Find objects by criteria
   */
  findObjects(criteria = {}) {
    const objects = this.getObjectsState();
    return objects.filter(obj => {
      return Object.keys(criteria).every(key => {
        if (key === 'position' && criteria[key]) {
          // Position matching with tolerance
          const tolerance = criteria[key].tolerance || 0.1;
          const target = criteria[key].target || criteria[key];
          return obj.position.every((coord, i) => 
            Math.abs(coord - target[i]) <= tolerance
          );
        }
        return obj[key] === criteria[key];
      });
    });
  }

  /**
   * Get objects at specific position
   */
  getObjectsAtPosition(position, tolerance = 0.1) {
    return this.findObjects({
      position: { target: position, tolerance }
    });
  }

  /**
   * Get event log filtered by type
   */
  getEvents(type = null, since = null) {
    let events = this.eventLog;
    
    if (type) {
      events = events.filter(event => event.type === type);
    }
    
    if (since) {
      events = events.filter(event => event.timestamp >= since);
    }
    
    return events;
  }

  /**
   * Clear event log
   */
  clearEvents() {
    this.eventLog = [];
    console.log('[GLUE TESTING] Event log cleared');
  }

  /**
   * Get testing summary
   */
  getTestingSummary() {
    const state = this.captureState();
    const recentEvents = this.getEvents(null, Date.now() - 10000); // Last 10 seconds
    
    return {
      enabled: this.enabled,
      objectCount: state.objects.length,
      eventCount: this.eventLog.length,
      recentEventCount: recentEvents.length,
      recentEventTypes: [...new Set(recentEvents.map(e => e.type))],
      lastStateCapture: state.timestamp,
      camera: state.camera,
      scene: state.scene
    };
  }

  /**
   * Setup state tracking with periodic updates
   */
  setupStateTracking() {
    const trackState = () => {
      if (this.enabled) {
        this.captureState();
        setTimeout(trackState, 1000); // Update every second
      }
    };
    trackState();
  }

  /**
   * Clear all monitoring
   */
  clearEventMonitoring() {
    this.listeners.clear();
    // Note: Original function restoration would need more complex implementation
    // For now, we'll rely on page refresh to reset
  }

  /**
   * Wait for specific event
   */
  waitForEvent(type, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.removeEventListener(type, handler);
        reject(new Error(`Timeout waiting for event: ${type}`));
      }, timeout);

      const handler = (event) => {
        clearTimeout(timeoutId);
        this.removeEventListener(type, handler);
        resolve(event);
      };

      this.addEventListener(type, handler);
    });
  }

  /**
   * Wait for object to appear at position
   */
  async waitForObjectAtPosition(position, tolerance = 0.1, timeout = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const objects = this.getObjectsAtPosition(position, tolerance);
      if (objects.length > 0) {
        return objects;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`Timeout waiting for object at position: ${position.join(', ')}`);
  }
}

// Note: TestingBackdoor is now initialized by Stage.js when needed
// No auto-initialization to avoid unwanted testing overhead
