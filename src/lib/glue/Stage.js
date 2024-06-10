import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { ControlsManager } from './ControlsManager.js';
import { CollisionHandler } from './CollisionHandler.js';
import { GUIManager } from './GUIManager.js';
import { Box } from './Box.js';

export class Stage {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.children = [];
    this.boxes = [];
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.dragOffset = new THREE.Vector3();

    this.sceneManager = new SceneManager(this.scene);
    this.controlsManager = new ControlsManager(this.camera, this.renderer.domElement, this);
    this.collisionHandler = new CollisionHandler(this);
    this.guiManager = new GUIManager(this);

    this.camera.position.set(0, 50, 100);
    this.camera.lookAt(0, 0, 0);

    this.animate();
    window.addEventListener('resize', () => this.onWindowResize(), false);
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

  onMouseMove(event) {
    this.mouse.x = (event.clientX / this.container.clientWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / this.container.clientHeight) * 2 + 1;
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
    const ground = this.scene.getObjectByName('ground');
    const intersects = this.raycaster.intersectObject(ground);
    if (intersects.length > 0) {
      return intersects[0].point;
    }
    return null;
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }
}

