import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls';
import { DragControls } from 'three/examples/jsm/controls/DragControls';

export class ControlsManager {
  constructor(camera, domElement, stage) {
    this.camera = camera;
    this.domElement = domElement;
    this.stage = stage;

    this.orbitControls = new OrbitControls(this.camera, this.domElement);
    this.transformControls = new TransformControls(this.camera, this.domElement);
    this.stage.scene.add(this.transformControls);

    this.dragControls = new DragControls(this.stage.children, this.camera, this.domElement);
    this.dragControls.addEventListener('dragstart', event => {
      this.orbitControls.enabled = false;
      this.stage.calculateDragOffset(event.object, event);
    });
    this.dragControls.addEventListener('drag', event => {
      this.stage.updateDragPosition(event.object, event);
      event.object.position.y = event.object.geometry.parameters.height / 2;
      this.stage.collisionHandler.handleCollisions(event.object);
    });
    this.dragControls.addEventListener('dragend', () => {
      this.orbitControls.enabled = true;
    });

    this.domElement.addEventListener('mousemove', this.stage.onMouseMove.bind(this.stage), false);
  }
}
