import * as THREE from 'three';
import { SceneManager } from './managers/SceneManager.js';
import { ControlsManager } from './managers/ControlsManager.js';
import {ObjectManager} from "./managers/ObjectManager";
import { CollisionHandler } from './CollisionHandler.js';
import {EventDispatcher, OrthographicCamera, PerspectiveCamera} from "three";
import Config from "./Config";
import {initNavCube, resetNavCameraType, updateNavCubePosition, updateNavCubeRotation} from "./utils/NavigationCube";

export class Stage extends EventDispatcher {
  constructor(container, config = {}) {
    super()
    this.glueId = -1
    this.container = container
    this.config = new Config(config)
    this.scene = new THREE.Scene()
    this.camera = null
    this.mouse = new THREE.Vector2()
    this.raycaster = new THREE.Raycaster()
    this.intersectPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0))

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(this.renderer.domElement)

    this.setCamera(config.cameraType || 'perspective')

    this.sceneManager = new SceneManager(this.scene, this.camera, this.container, this.config)
    this.controlsManager = new ControlsManager(this.camera, this.renderer.domElement, this, this.config)
    this.objectManager = new ObjectManager(this, this.scene, this.config)
    this.collisionHandler = new CollisionHandler(this.objectManager)

    this.bindListeners()
    this.animate()

    setTimeout(() => this.controlsManager.animateCameraZoom())
    this.controlsManager.initDragControls(this.objectManager.boxes, this.renderer.domElement)

    // if there's a navigation cube in the settings, add it
    setTimeout(() => {
        this.initializeNavigationCube()
        this.resetStageHeight(this.container.clientHeight)
    }, 100)
  }

  bindListeners() {
    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this), false)
    this.renderer.domElement.addEventListener('mouseup', this.onMouseUp.bind(this), false)
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this), false)
    window.addEventListener('resize', this.onWindowResize.bind(this), false)
  }

  initializeNavigationCube() {
    this.navScene = this.config.navigationCube ? initNavCube(this.config, this.camera) : null;
  }

  add(item) {
    this.objectManager.add(item)
  }

  remove(item, byType) {
    this.objectManager.remove(item, byType)
  }

  getByUniqueId(uniqueId) {
    return this.objectManager.boxes.find(box => box.uniqueId === uniqueId);
  }

  setCamera(cameraType) {
    const aspect = this.container.clientWidth / this.container.clientHeight;

    if (cameraType === 'orthographic') {
      this.camera = new OrthographicCamera(-50 * aspect, 50 * aspect, 50, -50, 0.1, 1000);
      this.camera.zoom = this.config.cameraInitialZoom
      this.camera.updateProjectionMatrix()
    } else {
      this.camera = new PerspectiveCamera(75, aspect, 0.1, 1000);
    }

    this.camera.position.set(0, this.config.cameraPosY, this.config.cameraPosZ);
    this.camera.lookAt(0, this.config.lookAtY, 0);

    if (this.controlsManager) {
      this.controlsManager.setCamera(this.camera);
      this.controlsManager.initDragControls(this.objectManager.boxes, this.renderer.domElement);
    }

    if (this.navScene) {
      this.navScene.camera = resetNavCameraType(cameraType, this.container.clientWidth, this.container.clientHeight)
    }
  }

  resetStageHeight(height) {
    let width = this.container.clientWidth
    const aspect = width / height;
    this.renderer.setSize(this.container.clientWidth, height)
    if (this.camera.isPerspectiveCamera) {
      this.camera.aspect = aspect;
    } else if (this.camera.isOrthographicCamera) {
      const viewSize = this.camera.top - this.camera.bottom;
      this.camera.left = -viewSize * aspect / 2;
      this.camera.right = viewSize * aspect / 2;
      this.camera.top = viewSize / 2;
      this.camera.bottom = -viewSize / 2;
    }
    this.camera.updateProjectionMatrix();

    if (this.navScene) {
      this.navScene.camera = resetNavCameraType(this.camera.isPerspectiveCamera ? 'perspective' : 'orthographic', width, height)
    }
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.cameraType) {
      this.setCamera(newConfig.cameraType);
    }
    this.controlsManager.updateConfig(this.config);
  }

  updateRaycaster() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    this.dispatchEvent({type: 'move-intersect', intersects});
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.renderer.render(this.scene, this.camera);

    // if there's a nav scene, render it
    if (this.navScene) {
      updateNavCubePosition()
      updateNavCubeRotation()
      this.renderer.autoClear = false; // Prevent clearing the main scene
      this.renderer.clearDepth(); // Clear depth buffer for the overlay scene
      this.renderer.render(this.navScene.scene, this.navScene.camera);
    }
  }

  onWindowResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const aspect = width / height;

    if (this.camera.isPerspectiveCamera) {
      this.camera.aspect = aspect;
    } else if (this.camera.isOrthographicCamera) {
      const viewSize = this.camera.top - this.camera.bottom;
      this.camera.left = -viewSize * aspect / 2;
      this.camera.right = viewSize * aspect / 2;
      this.camera.top = viewSize / 2;
      this.camera.bottom = -viewSize / 2;
    }

    if (this.navScene) {
      this.navScene.camera = resetNavCameraType(this.camera.isPerspectiveCamera ? 'perspective' : 'orthographic', width, height)
    }

    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }


  onMouseDown(event) {
    const rect = event.target.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    let intersects = this.raycaster.intersectObjects(this.scene.children, true);
    let parent
    let something = false

    intersects = intersects.filter(intersect => intersect.object.visible)

    for (let i = 0; i < intersects.length; i++) {
      parent = intersects[i].object.parent || null;

      if (intersects[i].object.type === 'Mesh' &&
          intersects[i].object.name !== 'ground' &&
          intersects[i].object.name !== 'XYZ'
      ) {
        let skipGizmo = false
        if (intersects[i].object.parent) {
          let p = intersects[i].object.parent
          while (p && p.parent) {
            if (p.type === "TransformControlsGizmo") {
              skipGizmo = true
            }
            p = p.parent
          }
        }
        if (!skipGizmo) { something = true }
      }

      if (intersects[i].object.type === 'model') {
        break;
      }

      if (intersects[i].object.name === 'ground' && !something) {
        this.dispatchEvent({type:'ground-clicked'})
        break;
      }
    }

    this.dispatchEvent({type:'mouse-clicked'})
  }

  onMouseMove(event) {
    const rect = event.target.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.updateRaycaster(); // Update raycaster on mouse move

    // for dispatching the stage coordinates, get them:
    let stageCoordinates = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.intersectPlane, stageCoordinates);
    event.stageCoords = stageCoordinates;

    this.dispatchEvent({type: 'mouse-move', event});
  }

  onMouseUp(event) {
    this.dispatchEvent({type: 'mouse-up', event});
  }


}