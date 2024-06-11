import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls';
import { DragControls } from 'three/examples/jsm/controls/DragControls';

export class ControlsManager {
  constructor(camera, domElement, stage, config = {}) {
    this.camera = camera;
    this.domElement = domElement;
    this.stage = stage;
    this.config = config;

    this.orbitControls = new OrbitControls(this.camera, this.domElement);
    this.transformControls = new TransformControls(this.camera, this.domElement);
    this.stage.scene.add(this.transformControls);

    this.dragControls = new DragControls(this.stage.children, this.camera, this.domElement);
    this.dragControls.addEventListener('dragstart', event => {
      console.log('Drag Start');
      this.orbitControls.enabled = false;
      this.stage.calculateDragOffset(event.object, event);
    });
    this.dragControls.addEventListener('drag', event => {
      this.stage.updateDragPosition(event.object, event);
      event.object.position.y = event.object.geometry.parameters.height / 2;
      this.stage.collisionHandler.handleCollisions(event.object);
    });
    this.dragControls.addEventListener('dragend', () => {
      console.log('Drag End');
      this.orbitControls.enabled = true;
    });

    // Updated event listener for TransformControls
    this.transformControls.addEventListener('dragging-changed', (event) => {
      console.log('Dragging changed:', event.value, this.orbitControls.enabled);
      this.orbitControls.enabled = !event.value;
    });

    this.domElement.addEventListener('mousemove', this.stage.onMouseMove.bind(this.stage), false);

    this.setControls();
  }

  setTransformMode(mode) {
    this.transformControls.setMode(mode);
  }

  setControls() {
    this.orbitControls.enabled = this.config.enableControls || false;
    this.orbitControls.enablePan = this.config.enablePan || false;
    this.orbitControls.enableZoom = this.config.enableZoom || false;
    this.orbitControls.enableRotate = this.config.enableRotate || false;
    this.orbitControls.update();

    this.dragControls.enabled = this.config.enableDrag || false;
  }

  setCamera(camera) {
    this.camera = camera;
    this.orbitControls.object = camera;
    this.orbitControls.update();
    this.transformControls.camera = camera;
  }

  updateConfig(config) {
    this.config = { ...this.config, ...config };
    this.setControls();
  }
}
