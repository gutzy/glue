import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls';
import { DragControls } from 'three/examples/jsm/controls/DragControls';
// rotating helper

export class ControlsManager {
  constructor(camera, domElement, stage, config = {}) {
    this.camera = camera;
    this.domElement = domElement;
    this.stage = stage;
    this.config = config;

    this.orbitControls = new OrbitControls(this.camera, this.domElement);
    this.transformControls = new TransformControls(this.camera, this.domElement);
    this.stage.scene.add(this.transformControls);

    // add listener for clicking
    this.domElement.addEventListener('click', this.onClick.bind(this), false);

    // Updated event listener for TransformControls
    this.transformControls.addEventListener('dragging-changed', (event) => {
      console.log('Dragging changed:', event.value, this.orbitControls.enabled);
      this.orbitControls.enabled = !event.value;
    });

    this.domElement.addEventListener('mousemove', this.stage.onMouseMove.bind(this.stage), false);
    this.domElement.addEventListener('mouseup', this.stage.onMouseUp.bind(this.stage), false);

    this.configureOrbitControls()
  }

  initDragControls(boxes, domElement) {
    this.dragControls = new DragControls(boxes, this.camera, domElement);
    this.dragControls.addEventListener('dragstart', event => {
      this.orbitControls.enabled = false;
      this.stage.dispatchEvent({type:'drag-start', object: event.object})
      if (event.object.onClickEvent) {
        event.object.onClickEvent(event.object)
      }
      this.stage.calculateDragOffset(event.object, event);
    });
    this.dragControls.addEventListener('drag', event => {
      this.stage.updateDragPosition(event.object, event);
      this.stage.dispatchEvent({type:'drag-move', object: event.object})
      this.stage.collisionHandler.handleCollisions(event.object);
    });
    this.dragControls.addEventListener('dragend', (event) => {
      this.stage.dispatchEvent({type:'drag-end', object: event.object })
      this.orbitControls.enabled = true;
    });
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
      console.log("Rotating helper")
    }
  }

  setTransformMode(mode) {
    this.transformControls.setMode(mode);
  }

  configureOrbitControls() {
    this.orbitControls.enabled = true;
    this.orbitControls.enablePan = this.config.enablePan || false;
    this.orbitControls.enableZoom = this.config.enableZoom || false;
    this.orbitControls.enableRotate = (this.config.enableRotate && !this.config.navigationCube) || false;
    this.orbitControls.update();
  }

  setControls(attempt = 0) {
    if (!this.orbitControls || !this.dragControls) {
      if (attempt >= 10) {
        console.error("Controls not ready after 10 attempts")
      }
      setTimeout(() => {
        this.setControls(++attempt);
      },5)
      return;
    }
    this.configureOrbitControls()

    this.dragControls.enabled = this.config.enableDrag || false;
  }

  resetCameraPosition() {

    // if it's perspective, reset camera position to half the pos
    if (this.config.cameraType === 'perspective') {
      this.camera.position.set(this.config.cameraPosX/2, this.config.cameraPosY/2, this.config.cameraPosZ/2);
      this.orbitControls.target.set(0, this.config.lookAtY, 0);
      this.camera.lookAt(0, this.config.lookAtY, 0);
    }
    else {
      this.camera.position.set(this.config.cameraPosX, this.config.cameraPosY, this.config.cameraPosZ);
      this.orbitControls.target.set(0, 0, 0);
      this.camera.lookAt(0, 0, 0);
    }

    if (this.config.navigationCube) {
      this.stage.initializeNavigationCube()
    }
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

  setCamera(camera) {
    this.camera = camera;
    this.orbitControls.object = camera;
    this.orbitControls.update();
    this.transformControls.camera = camera;
  }

  setCameraType(cameraType) {
    if (this.cameraType === cameraType) return;

    this.cameraType = cameraType;
    this.stage.setCamera(cameraType)
    this.configureOrbitControls()
  }

  updateConfig(config) {
    this.config = { ...this.config, ...config };
    this.setControls();
    if (config.cameraType) this.setCameraType(config.cameraType)
  }

  // set camera zoom from 1 to 5.5 over 1 second, rotate 360 degrees too
  animateCameraZoom() {
    let animate = () => {}
    if (this.config.cameraType === 'orthographic') {
      this.camera.positionX = -100
      this.camera.positionY = 100
      this.camera.zoom = 2
      const zoom = this.camera.zoom
      const targetZoom = this.config.cameraInitialZoom
      const duration = 1000
      const start = Date.now()
      animate = () => {
        const now = Date.now()
        const elapsed = now - start
        const progress = elapsed / duration
        this.camera.zoom = zoom + (targetZoom - zoom) * progress
        // move the camera to position 0,0,0
        this.camera.position.x = -(100+this.config.cameraPosX) + ((100+this.config.cameraPosX) * progress)
        this.camera.position.y = (100+this.config.cameraPosY) - (100 * progress)
        this.camera.lookAt(0,0,0)
        this.camera.updateProjectionMatrix()
        if (progress < 1) {
          requestAnimationFrame(animate)
        }
        else {
          this.camera.position.set(this.config.cameraPosX, this.config.cameraPosY, this.config.cameraPosZ)
          this.camera.lookAt(0,0,0)
          this.camera.updateProjectionMatrix()
        }
      }
    }
    else {
        this.camera.zoom = 1
        this.camera.positionX = -30
        this.camera.positionY = 30
        this.camera.positionZ = 0
        const duration = 1000
        const start = Date.now()
        animate = () => {
          // pan camera outside stage
          const now = Date.now()
          const elapsed = now - start
          const progress = elapsed / duration
          this.camera.position.x = -(30+(this.config.cameraPosX/2)) + (30 * progress)
          this.camera.position.y = (30+(this.config.cameraPosY/2)) - (30 * progress)
          this.camera.position.z = ((this.config.cameraPosZ/2) * progress)
          this.camera.lookAt(0, this.config.lookAtY, 0)
          // this.camera.updateProjectionMatrix()
          if (progress < 1) {
            requestAnimationFrame(animate)
          }
          else {
            this.camera.position.set(this.config.cameraPosX/2, this.config.cameraPosY/2, this.config.cameraPosZ/2)
            this.camera.lookAt(0,this.config.lookAtY,0)
          }
        }
    }
    animate()
  }
}
