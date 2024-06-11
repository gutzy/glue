import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { ControlsManager } from './ControlsManager.js';
import { CollisionHandler } from './CollisionHandler.js';
import { GUIManager } from './GUIManager.js';
import { Box } from './Box.js';
import { MountingPoint } from './MountingPoint.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { DragControls } from 'three/examples/jsm/controls/DragControls';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls';

export class Stage {
  constructor(container, config = {}) {
    this.container = container;
    this.config = config;
    this.scene = new THREE.Scene();
    this.setCamera(config.cameraType || 'perspective');
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.children = [];
    this.boxes = [];
    this.mountingPoints = [];
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
    });
  }

  addMountingPoint(position = new THREE.Vector3(0, 10, 0)) {
    const mountingPoint = new MountingPoint(position, this);
    console.log('Adding mounting point at position:', position);
    this.mountingPoints.push(mountingPoint);
    this.scene.add(mountingPoint);
    this.transformControls.attach(mountingPoint);
  }

  onMouseDown(event) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    for (let i = 0; i < intersects.length; i++) {
      console.log('Intersected', intersects[i].object.type, intersects[i].object.name);
      if (intersects[i].object.type === 'model') {
        this.selectedObject = intersects[i];
        console.log('Selected object:', this.selectedObject.object.type, this.selectedObject.object.name);
        break;
      }
      if (intersects[i].object.type === 'mountingPoint') {
        console.log('Selected mounting point:', intersects[i].object.name);
        // if transforms are already attached to this object, toggle their mode from translate to rotate
        if (this.transformControls.object === intersects[i].object) {
          this.transformControls.setMode(this.transformControls.mode === 'translate' ? 'rotate' : 'translate');
        }

        // should show the transform controls
        this.transformControls.attach(intersects[i].object);
        break;
      }
      if (intersects[i].object.type === 'Line') {
        console.log('Selected transform controls plane:', intersects[i].object.name);
        // should hide the transform controls
        // this.transformControls.detach();
        break;
      }

      if (intersects[i].object.name === 'ground') {
        this.selectedObject = null;
        console.log('Selected floor:');
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
