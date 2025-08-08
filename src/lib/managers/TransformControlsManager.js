import {TransformControls} from "three/examples/jsm/controls/TransformControls";

export class TransformControlsManager {
  constructor(camera, domElement, stage, orbitControls, config = {}) {
    this.camera = camera;
    this.domElement = domElement;
    this.stage = stage;
    this.config = config;
    this.orbitControls = orbitControls;

    this.transformControls = new TransformControls(this.camera, this.domElement);
    this.stage.scene.add(this.transformControls);

    // add listener for clicking
    this.domElement.addEventListener('click', this.onClick.bind(this), false);

    // Updated event listener for TransformControls
    this.transformControls.addEventListener('dragging-changed', (event) => {
      this.orbitControls.enabled = !event.value;
    });

  }

  setTransformMode(mode) {
    this.transformControls.setMode(mode);
  }
  toggleTransformControlsMode(editingType) {
    const mode = this.transformControls.mode;
    if (mode === 'translate') {
        this.transformControls.setMode('rotate')
        // limit to Y axis rotation
        if (editingType === 'mountingPoint') {
            this.transformControls.showX = true
            this.transformControls.showY = true
            this.transformControls.showZ = true
        }
        else if (editingType === 'boundingBox') {
            this.transformControls.showX = false
            this.transformControls.showY = true
            this.transformControls.showZ = false
            this.transformControls.setSpace('local')
        }

        this.transformControls.setSpace('local')
    } else if (mode === 'rotate') {
        this.transformControls.setMode('scale')
        this.transformControls.showX = this.transformControls.showY = this.transformControls.showZ = true
    } else {
        this.transformControls.setMode('translate')
        this.transformControls.showX = this.transformControls.showY = this.transformControls.show
    }
  }

  onClick(event) {
    if (this.transformControls.object) {
      this.transformControls.detach();
    }

    if (this.config.rotatingHelper) {
      // const intersects = this.stage.getIntersects(event);
      // if (intersects.length > 0) {
      //   const object = intersects[0].object;
      //   this.transformControls.attach(object);
      // }
    }
  }
}