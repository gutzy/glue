import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { ControlsManager } from './ControlsManager.js';
import { CollisionHandler } from './CollisionHandler.js';
import { GUIManager } from './GUIManager.js';
import { Box } from './objects/Box.js';
import { MountingPoint } from './objects/MountingPoint.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { DragControls } from 'three/examples/jsm/controls/DragControls';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls';
import {EventDispatcher} from "three";
import Config from "./Config";
import {BoundingBox} from "./objects/BoundingBox";

export class Stage extends EventDispatcher {
  constructor(container, config = {}) {
    super();
    this.container = container;
    this.config = new Config(config);
    this.scene = new THREE.Scene();
    this.setCamera(config.cameraType || 'perspective');
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.children = [];
    this.boxes = [];
    this.boundingBoxes = [];
    this.mountingPoints = [];
    this.models = [];
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.dragOffset = new THREE.Vector3();
    this.intersectPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0));

    this.loader = new GLTFLoader();
    this.selectedObject = null;

    this.sceneManager = new SceneManager(this.scene);
    this.controlsManager = new ControlsManager(this.camera, this.renderer.domElement, this, this.config);
    this.collisionHandler = new CollisionHandler(this);
    this.guiManager = new GUIManager(this);

    this.camera.position.set(0, 50, 100);
    this.camera.lookAt(0, 0, 0);

    this.initControls();
    this.animate();
    window.addEventListener('resize', () => this.onWindowResize(), false);
  }

  setCamera(cameraType) {
    const aspect = this.container.clientWidth / this.container.clientHeight;

    if (cameraType === 'orthographic') {
      this.camera = new THREE.OrthographicCamera(-50 * aspect, 50 * aspect, 50, -50, 0.1, 1000);
    } else {
      this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    }

    this.camera.position.set(0, 50, 100);
    this.camera.lookAt(0, 0, 0);

    if (this.controlsManager) {
      this.controlsManager.setCamera(this.camera);
    }
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.cameraType) {
      this.setCamera(newConfig.cameraType);
    }
    this.controlsManager.updateConfig(this.config);
    this.guiManager.updateConfig(this.config);
  }

  addBox(x, y, z, width, height, depth, rotation = 0, stackable = false) {
    console.log('Adding box!!', { x, y, z, width, height, depth, rotation, stackable });
    const box = new Box(x, y, z, width, height, depth, rotation, stackable);
    this.scene.add(box);
    this.children.push(box);
    this.boxes.push(box);
  }

  removeBox(box) {
    const index = this.children.indexOf(box);
    if (index > -1) {
      this.scene.remove(box);
      this.children.splice(index, 1);
    }
    const boxIndex = this.boxes.indexOf(box);
    if (boxIndex > -1) {
      this.boxes.splice(boxIndex, 1);
    }
  }

  loadModel(contents) {
    this.loader.parse(contents, '', (gltf) => {
      gltf.scene.scale.set(this.config.modelScale || 1, this.config.modelScale || 1, this.config.modelScale || 1);
      // set type attribute, for collision detection
        gltf.scene.traverse((child) => {
            if (child.isMesh) {
            child.type = 'model';
            }
        });
      this.scene.add(gltf.scene);
      this.models.push(gltf.scene);
      console.log('Loaded model:', gltf.scene);
    });
  }

  addMountingPoint(position = new THREE.Vector3(0, 10, 0)) {
    if (!position instanceof THREE.Vector3) { position = new THREE.Vector3(position.x, position.y, position.z); }
    const mountingPoint = new MountingPoint(position, this);
    console.log('Adding mounting point at position:', position);
    this.mountingPoints.push(mountingPoint);
    this.scene.add(mountingPoint);
    this.transformControls.attach(mountingPoint);
  }

  removeMountingPoint(index) {
    const mountingPoint = this.mountingPoints[index];
    console.log('Removing mounting point:', mountingPoint)
    if (mountingPoint) {
      this.transformControls.detach();
      this.scene.remove(mountingPoint);
      this.mountingPoints.splice(index, 1);
    }
  }

  addBoundingBox(refObject) {
    const color = this.config.boundingBoxColors[this.boundingBoxes.length % this.config.boundingBoxColors.length];
    const boundingBox = new BoundingBox(refObject, this);
    boundingBox.setColor(color);
    this.boundingBoxes.push(boundingBox);
    console.log(this.config)
    this.scene.add(boundingBox);

    this.transformControls.attach(boundingBox);
    boundingBox.addEventListener('change', () => {
      this.dispatchEvent({ type: 'boundingBoxChanged', object: boundingBox });
    });

    return boundingBox
  }

  removeBoundingBox(index) {
    console.log('Removing bounding box:', index, this.boundingBoxes[index])
    // if (this.boundingBoxes.length > 1) {
      this.transformControls.detach();
      const boundingBox = this.boundingBoxes[index];
      this.scene.remove(boundingBox);
      this.boundingBoxes.splice(index, 1);
    // }
  }

  onMouseDown(event) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    let itemType = null;

    for (let i = 0; i < intersects.length; i++) {
      console.log('Intersected', intersects[i].object.type, intersects[i].object.name);
      if (intersects[i].object.type === 'model') {
        this.selectedObject = intersects[i];
        console.log('Selected object:', this.selectedObject.object.type, this.selectedObject.object.name);
        break;
      }

      if (intersects[i].object.type === 'mountingPoint') {
        itemType = 'mountingPoint';
        console.log('Selected mounting point:', intersects[i].object.name);
        // should show the transform controls to the scene
        if (intersects[i].object.parent && intersects[i].object.parent.type === 'mountingPoint') {
          this.transformControls.attach(intersects[i].object.parent);
        }
        else {
          this.transformControls.attach(intersects[i].object);
        }

        if (event.ctrlKey) {
          this.transformControls.setMode(this.transformControls.mode === 'translate' ? 'rotate' : 'translate');
        }
      }

      if (intersects[i].object.type === 'boundingBox') {
        itemType = 'boundingBox';
        console.log('Selected bounding box:', intersects[i].object.name);
        // should show the transform controls to the scene
        if (intersects[i].object.parent && intersects[i].object.parent.type === 'boundingBox') {
          this.transformControls.attach(intersects[i].object.parent);
        }
        else {
          this.transformControls.attach(intersects[i].object);
        }

        if (event.ctrlKey) {
          const mode = this.transformControls.mode;
          if (mode === 'translate') {
            this.transformControls.setMode('rotate')
            // limit to Y axis rotation
            console.log(this.transformControls)
            this.transformControls.showX = false
            this.transformControls.showY = true
            this.transformControls.showZ = false
            this.transformControls.setSpace('local')
          }
          else if (mode === 'rotate') {
            this.transformControls.setMode('scale')
            this.transformControls.showX = this.transformControls.showY = this.transformControls.showZ = true
          }
          else {
            this.transformControls.setMode('translate')
            this.transformControls.showX = this.transformControls.showY = this.transformControls.showZ = true
          }
        }
      }
      // XYZ control plane - when clicking this, if it's a bounding box or a mounting point, should toggle the transform controls type
      // ... when holding the ctrl key
      if (intersects[i].object.type === 'Mesh' && intersects[i].object.name === 'XYZ' && this.transformControls.object) {
        if (itemType) break;
      }

      if (intersects[i].object.type === 'Line' && this.transformControls.object) {
        itemType = 'something'
        break;
      }


      if (intersects[i].object.name === 'ground' && itemType === null) {
        this.selectedObject = null;
        // should hide the transform controls
        this.transformControls.detach();
        break;
      }
    }
  }

  initControls() {
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableZoom = true;
    this.orbitControls.enableRotate = true;
    this.orbitControls.enablePan = false;

    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.scene.add(this.transformControls);

    this.dragControls = new DragControls(this.boxes, this.camera, this.renderer.domElement);
    this.dragControls.addEventListener('dragstart', event => {
      this.orbitControls.enabled = false;
      this.calculateDragOffset(event.object, event);
    });
    this.dragControls.addEventListener('drag', event => {
      this.updateDragPosition(event.object, event);
      this.collisionHandler.handleCollisions(event.object);
    });
    this.dragControls.addEventListener('dragend', () => {
      this.orbitControls.enabled = true;
    });

    this.transformControls.addEventListener('dragging-changed', (event) => {
      this.orbitControls.enabled = !event.value;
      // console.log('Dragging changed:', event.value, this.orbitControls.enabled);
      // console.log("Mounting Points", this.mountingPoints.map(mp => mp.position.toArray()))
      console.log("Updating all:", this.boundingBoxes.map(bb => bb.position.toArray()), this.mountingPoints.map(mp => mp.position.toArray()))
      this.dispatchEvent({type:'bounding-boxes-change', boundingBoxes: this.boundingBoxes })
      this.dispatchEvent({type:'mounting-points-change', mountingPoints: this.mountingPoints })
    });

    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this), false);
  }

  onMouseMove(event) {
    this.mouse.x = (event.clientX / this.container.clientWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / this.container.clientHeight) * 2 + 1;
    this.updateRaycaster(); // Update raycaster on mouse move
  }

  calculateDragOffset(object, event) {
    const intersectPoint = this.getIntersectPoint(event);
    if (intersectPoint) {
      this.dragOffset.copy(intersectPoint).sub(object.position);
    }
  }

  updateDragPosition(object, event) {
    const intersectPoint = this.getIntersectPoint(event);
    if (intersectPoint) {
      object.position.copy(intersectPoint).sub(this.dragOffset);
      object.position.y = object.geometry.parameters.height / 2; // Ensure the object stays on the ground
    }
  }

  getIntersectPoint(event) {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.ray.intersectPlane(this.intersectPlane, new THREE.Vector3());
    if (intersects) {
      return intersects;
    }
    return null;
  }

  updateRaycaster() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }
}
