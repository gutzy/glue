import { SelectedZoneHelper } from '../utils/SelectedZoneHelper.js';
import * as THREE from 'three';

export class ZoneHelperManager {
  constructor(stage) {
    this.stage = stage;
    this.helpers = new Map(); // Map of helperId -> { helper, metadata }
    this.globalOpacity = 1;
    this.isFadingOut = false;
    this.fadeInProgress = false;
  }

  // Create a new zone helper
  createHelper(helperId, objects, color, options = {}) {
    console.log('🔍 ZoneHelperManager.createHelper called');
    console.log('🔍 Helper ID:', helperId);
    console.log('🔍 Objects count:', objects.length);
    console.log('🔍 Color:', color);
    console.log('🔍 Options:', options);
    
    // If a helper with the same ID already exists, remove it first to avoid orphaned meshes
    if (this.helpers.has(helperId)) {
      console.log('🔍 Existing helper found for ID, removing before creating a new one:', helperId);
      this.removeHelper(helperId);
    }

    const {
      influence = 2,
      falloff = 1,
      maxDistance = 10,
      threshold = 0.002,
      initialOpacity = null,
      placeholderObjects = []
    } = options;

    const helper = new SelectedZoneHelper(objects, color, influence, falloff, maxDistance, threshold);
    
    // Set initial opacity if specified, otherwise use global opacity
    if (initialOpacity !== null) {
      helper.material.uniforms.uAlpha.value = initialOpacity;
    } else {
      helper.material.uniforms.uAlpha.value = this.globalOpacity;
    }

    this.helpers.set(helperId, {
      helper,
      metadata: {
        color,
        objects: [...objects],
        placeholderObjects: Array.isArray(placeholderObjects) ? [...placeholderObjects] : [],
        influence,
        falloff,
        maxDistance,
        threshold,
        initialOpacity
      }
    });

    this.stage.add(helper.mesh);
    console.log('🔍 Helper created and added to stage. Total helpers:', this.helpers.size);
    return helper;
  }

  // Update helper objects
  updateHelper(helperId, objects) {
    const helperData = this.helpers.get(helperId);
    if (!helperData) return;

    helperData.helper.objects = objects;
    helperData.helper.update();
    helperData.metadata.objects = [...objects];
  }

  // Remove a helper
  removeHelper(helperId) {
    console.log('🔍 ZoneHelperManager.removeHelper called');
    console.log('🔍 Helper ID:', helperId);
    
    const helperData = this.helpers.get(helperId);
    if (!helperData) {
      console.log('🔍 WARNING: Helper not found for ID:', helperId);
      return;
    }

    console.log('🔍 Removing helper from stage');
    this.stage.remove(helperData.helper.mesh);
    // Remove placeholder objects if any
    const placeholders = helperData.metadata.placeholderObjects || [];
    placeholders.forEach((obj) => {
      try {
        this.stage.scene.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      } catch (e) {}
    });
    
    // Properly dispose of the helper to clean up materials and geometries
    helperData.helper.dispose();
    
    this.helpers.delete(helperId);
    console.log('🔍 Helper removed and disposed. Total helpers remaining:', this.helpers.size);
  }

  // Remove all helpers
  removeAllHelpers() {
    this.helpers.forEach((helperData) => {
      this.stage.remove(helperData.helper.mesh);
      const placeholders = helperData.metadata.placeholderObjects || [];
      placeholders.forEach((obj) => {
        try {
          this.stage.scene.remove(obj);
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        } catch (e) {}
      });
      // Properly dispose of each helper
      helperData.helper.dispose();
    });
    this.helpers.clear();
  }

  // Get helper by ID
  getHelper(helperId) {
    const helperData = this.helpers.get(helperId);
    return helperData ? helperData.helper : null;
  }

  // Get all helpers
  getAllHelpers() {
    return Array.from(this.helpers.values()).map(data => data.helper);
  }

  // Get helper metadata
  getHelperMetadata(helperId) {
    const helperData = this.helpers.get(helperId);
    return helperData ? helperData.metadata : null;
  }

  // Fade a specific helper
  fadeHelper(helperId, targetOpacity, duration = 500) {
    const helperData = this.helpers.get(helperId);
    if (!helperData) return Promise.resolve();

    return helperData.helper.fadeOpacity(targetOpacity, duration);
  }

  // Fade all helpers
  fadeAllHelpers(targetOpacity, duration = 500) {
    if (this.fadeInProgress) return Promise.resolve();
    
    this.fadeInProgress = true;
    const fadePromises = Array.from(this.helpers.values()).map(helperData => 
      helperData.helper.fadeOpacity(targetOpacity, duration)
    );

    return Promise.all(fadePromises).then(() => {
      this.fadeInProgress = false;
      this.globalOpacity = targetOpacity;
    });
  }

  // Fade in all helpers
  fadeAllHelpersIn(duration = 500) {
    return this.fadeAllHelpers(1, duration);
  }

  // Fade out all helpers
  fadeAllHelpersOut(duration = 500) {
    this.isFadingOut = true;
    return this.fadeAllHelpers(0, duration).then(() => {
      this.isFadingOut = false;
    });
  }

  // Check if currently fading out
  isCurrentlyFadingOut() {
    return this.isFadingOut;
  }

  // Update all helpers (for animation frames)
  update() {
    this.helpers.forEach(helperData => {
      helperData.helper.update();
    });
  }

  // Get helper count
  getHelperCount() {
    return this.helpers.size;
  }

  // Check if helper exists
  hasHelper(helperId) {
    return this.helpers.has(helperId);
  }

  // High-level: build helpers from positions/items
  // positions: [{ name, color }]
  // items: [{ uniqueId, position }]
  // getStageObjectById: (id) => THREE.Object3D
  // options: { initialOpacity?: number }
  createHelpersForPositions({ positions = [], items = [], getStageObjectById, options = {} }) {
    const positionGroups = new Map();
    items.forEach(item => {
      if (!item.position) return;
      const stageObj = typeof getStageObjectById === 'function' ? getStageObjectById(item.uniqueId) : null;
      if (!stageObj) return;
      if (!positionGroups.has(item.position)) positionGroups.set(item.position, []);
      positionGroups.get(item.position).push(stageObj);
    });

    let createdCount = 0;
    positionGroups.forEach((objects, positionName) => {
      if (!objects || objects.length === 0) return;
      const pos = positions.find(p => p.name === positionName);
      const color = pos ? pos.color : 0x00ffcc;
      const helperId = `position_${positionName}`;
      this.createHelper(helperId, objects, color, {
        ...options,
        initialOpacity: options.initialOpacity ?? 0,
      });
      createdCount += 1;
    });

    if (createdCount === 0 && positions.length > 0) {
      // Create placeholders at center for each position
      positions.forEach(pos => {
        const placeholderGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const placeholderMaterial = new THREE.MeshBasicMaterial({ visible: false });
        const placeholderMesh = new THREE.Mesh(placeholderGeometry, placeholderMaterial);
        placeholderMesh.position.set(0, 0, 0);
        this.stage.scene.add(placeholderMesh);
        const helperId = `position_${pos.name}`;
        this.createHelper(helperId, [placeholderMesh], pos.color, {
          initialOpacity: options.initialOpacity ?? 0,
          placeholderObjects: [placeholderMesh],
        });
      });
    }
  }

  rebuildHelpers({ positions = [], items = [], getStageObjectById, options = {} }) {
    this.removeAllHelpers();
    this.createHelpersForPositions({ positions, items, getStageObjectById, options });
  }

  // Compute an influence radius similar to SelectedZoneHelper's blob sizing
  computeInfluenceRadius(object) {
    if (!object) return 0.2;
    const bbox = new THREE.Box3().setFromObject(object);
    const size = bbox.getSize(new THREE.Vector3());
    const baseRadius = Math.max(size.x, size.z) / 2;
    const scaledRadius = Math.min(1, baseRadius * 2.0);
    return Math.max(0.15, scaledRadius);
  }

  // Get world-space center of an object's bounding box
  getObjectCenter(object) {
    if (!object) return { x: 0, z: 0 };
    const bbox = new THREE.Box3().setFromObject(object);
    const center = bbox.getCenter(new THREE.Vector3());
    return { x: center.x, z: center.z };
  }
} 