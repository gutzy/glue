import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { DragControlsPlus} from "../utils/DragControlsPlus";
import * as THREE from "three";
import Tween from '../utils/Tween.js';

let dragged = null;
// rotating helper

const USE_TWEENS = true; // Set to false if you want to use the old method of animating camera zoom

export class ControlsManager {
  constructor(camera, domElement, stage, config = {}) {
    this.camera = camera;
    this.domElement = domElement;
    this.stage = stage;
    this.config = config;
    this.dragOffset = new THREE.Vector3();
    this.winX = window.innerWidth;
    this.winY = window.innerHeight;

    this.orbitControls = new OrbitControls(this.camera, this.domElement);
    this.configureOrbitControls()

    this.initWindowControls()
  }

  initWindowControls() {
    window.addEventListener('mousemove', (event) => {
        this.winX = event.clientX;
        this.winY = event.clientY;
    })
  }

  resetDragControls(target) {
    let el = this.stage.renderer.domElement,
        offset = el.getBoundingClientRect(),
        x = this.winX - offset.left,
        y = this.winY - offset.top
    console.log(offset.left, offset.top, this.winX, this.winY, x, y)
    this.dragControls.resetSelected(target, this.winX, this.winY)
  }

  initDragControls(boxes, domElement) {
    this.dragControls = new DragControlsPlus(boxes, this.camera, domElement);

    let isFirstDragFrame = false;

    this.dragControls.addEventListener('dragstart', event => {
      if (dragged) {
        console.log("An object is already being dragged")
        return
      }
      else {
        dragged = event.object;
      }
      this.orbitControls.enabled = false;
      this.stage.dispatchEvent({ type: 'drag-start', object: event.object });
      if (event.object.onClickEvent) {
        event.object.onClickEvent(event.object);
      }

      this.calculateDragOffset(event.object, event);
      isFirstDragFrame = true; // flag to skip the first drag frame
    });

    this.dragControls.addEventListener('drag', event => {
      if (dragged !== event.object) {
        console.log("dragging a different object!!")
        return
      }
      if (isFirstDragFrame) {
        isFirstDragFrame = false;
        return; // skip the first frame to avoid the "jump"
      }

      this.updateDragPosition(event.object, event);
      this.stage.dispatchEvent({ type: 'drag-move', object: event.object });
      this.stage.collisionHandler.handleCollisions(event.object);
    });

    this.dragControls.addEventListener('dragend', event => {
      dragged = null
      this.stage.dispatchEvent({ type: 'drag-end', object: event.object });
      this.orbitControls.enabled = true;
    });
  }


  setControls(attempt = 0) {
    if (!this.orbitControls || !this.dragControls) {
      if (attempt >= 10) {
        console.error("Controls not ready after 10 attempts", this.orbitControls, this.dragControls);
        console.trace()
      }
      setTimeout(() => {
        this.setControls(++attempt);
      },5)
      return;
    }
    this.configureOrbitControls()


    this.dragControls.enabled = this.config.enableDrag || false;
  }

  updateDragPosition(object, event) {
    let intersectPoint = null;
      intersectPoint = this.getIntersectPoint(event);
    if (intersectPoint) {
      object.position.copy(intersectPoint).sub(this.dragOffset);
      object.position.y = object.geometry.parameters.height / 2; // Ensure the object stays on the ground
    }
    // if frame offset exceeds what we want, set it to 0
  }

  calculateDragOffset(object, event) {
    const intersectPoint = this.getIntersectPoint(event);
    if (intersectPoint) {
      this.dragOffset.copy(intersectPoint).sub(object.position);
    }
  }

  getIntersectPoint(event) {
    this.stage.raycaster.setFromCamera(this.stage.mouse, this.camera);

    const intersects = this.stage.raycaster.ray.intersectPlane(this.stage.intersectPlane, new THREE.Vector3());
    if (intersects) {
      return intersects;
    }
    return null;
  }

  configureOrbitControls() {
    this.orbitControls.enabled = true;
    this.orbitControls.enablePan = this.config.enablePan || false;
    this.orbitControls.enableZoom = this.config.enableZoom || false;
    this.orbitControls.enableRotate = (this.config.enableRotate && !this.config.navigationCube) || false;
    this.orbitControls.update();

    this.orbitControls.addEventListener('change', () => {
        // this.orbitControls.target.set(0, this.config.lookAtY, 0);

    })
  }

  resetCameraPosition() {
    // if it's perspective, reset camera position to half the pos
    if (this.config.cameraType === 'perspective') {
      if (USE_TWEENS) {
        Tween.create(this.camera.position, {
          x: this.config.cameraPosX / 2,
          y: this.config.cameraPosY / 2,
          z: this.config.cameraPosZ / 2
        }, 300, () => {
            this.camera.lookAt(0, this.config.lookAtY, 0);
            this.orbitControls.target.set(0, this.config.lookAtY, 0);
            if (this.config.rotation) { this.camera.rotation.z = this.config.rotation * Math.PI / 180; }
          this.camera.updateProjectionMatrix();
        });
      }
      else {
        this.camera.position.set(this.config.cameraPosX/2, this.config.cameraPosY/2, this.config.cameraPosZ/2);
        this.orbitControls.target.set(0, this.config.lookAtY, 0);
        this.camera.lookAt(0, this.config.lookAtY, 0);
        if (this.config.rotation) { this.camera.rotation.z = this.config.rotation * Math.PI / 180; }
      }

    }
    else {
      if (USE_TWEENS) {
        Tween.create(this.camera.position, {
          x: this.config.cameraPosX,
          y: this.config.cameraPosY,
          z: this.config.cameraPosZ
        }, 300, () => {
            this.camera.lookAt(0, this.config.lookAtY, 0);
            this.orbitControls.target.set(0, this.config.lookAtY, 0);
          if (this.config.rotation) { this.camera.rotation.z = this.config.rotation * Math.PI / 180; }
          this.camera.updateProjectionMatrix();
        });
      }
      else {
        this.camera.position.set(this.config.cameraPosX, this.config.cameraPosY, this.config.cameraPosZ);
        this.orbitControls.target.set(0, this.config.lookAtY, 0);
        this.camera.lookAt(0, this.config.lookAtY, 0);
        if (this.config.rotation) { this.camera.rotation.z = this.config.rotation * Math.PI / 180; }
      }
    }

    this.orbitControls.target.set(0, this.config.lookAtY, 0)

    if (this.config.navigationCube) {
      this.stage.initializeNavigationCube()
    }
  }

  setCamera(camera) {
    this.camera = camera;
    this.orbitControls.object = camera;
    this.orbitControls.update();
  }

  setCameraType(cameraType) {
    if (this.cameraType === cameraType) return;

    this.cameraType = cameraType;
    this.stage.setCamera(cameraType)
    this.configureOrbitControls()
  }

  updateConfig(config) {
    this.config = { ...this.config, ...config };
    if (this.config.dragItems) {
      this.setControls();
    }
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
        this.camera.lookAt(0,this.config.lookAtY,0)
        if (this.config.rotation) { this.camera.rotation.z = this.config.rotation * Math.PI / 180; }
        this.camera.updateProjectionMatrix()
        if (progress < 1) {
          requestAnimationFrame(animate)
        }
        else {
          this.camera.position.set(this.config.cameraPosX, this.config.cameraPosY, this.config.cameraPosZ)
          this.orbitControls.target.set(0, this.config.lookAtY, 0);
          this.camera.lookAt(0,this.config.lookAtY,0)
          if (this.config.rotation) { this.camera.rotation.z = this.config.rotation * Math.PI / 180; }
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
          if (this.config.rotation) { this.camera.rotation.z = this.config.rotation * Math.PI / 180; }
          // this.camera.updateProjectionMatrix()
          if (progress < 1) {
            requestAnimationFrame(animate)
          }
          else {
            this.camera.position.set(this.config.cameraPosX/2, this.config.cameraPosY/2, this.config.cameraPosZ/2)
            this.orbitControls.target.set(0, this.config.lookAtY, 0);
            this.camera.lookAt(0,this.config.lookAtY,0)
            if (this.config.rotation) { this.camera.rotation.z = this.config.rotation * Math.PI / 180; }
          }
        }
    }
    animate()
  }
}