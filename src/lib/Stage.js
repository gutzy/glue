import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { ControlsManager } from './ControlsManager.js';
import { CollisionHandler } from './CollisionHandler.js';
import { GUIManager } from './GUIManager.js';
import { Box } from './objects/Box.js';
import { MountingPoint } from './objects/MountingPoint.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import {EventDispatcher, OrthographicCamera, PerspectiveCamera} from "three";
import Config from "./Config";
import {BoundingBox} from "./objects/BoundingBox";
import {GLTFModel} from "./utils/ModelUtils";
import {initNavCube, resetNavCameraType, updateNavCubePosition, updateNavCubeRotation} from "./utils/NavigationCube";

export class Stage extends EventDispatcher {
  constructor(container, config = {}) {
    super();
    this.glueId = -1
    this.container = container;
    this.config = new Config(config);
    this.scene = new THREE.Scene();
    this.camera = null;

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

    this.sceneManager = new SceneManager(this.scene, this.camera, this.container, this.config);
    this.controlsManager = new ControlsManager(this.camera, this.renderer.domElement, this, this.config);
    this.collisionHandler = new CollisionHandler(this);
    this.guiManager = new GUIManager(this);

    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this), false);
    this.animate();
    window.addEventListener('resize', () => this.onWindowResize(), false);
    window.addEventListener('keydown', (event) => this.onKeyDown(event), false);

    setTimeout(() => this.controlsManager.animateCameraZoom())
    this.controlsManager.initDragControls(this.boxes, this.renderer.domElement);

    // if there's a navigation cube in the settings, add it
    setTimeout(() => {
        this.initializeNavigationCube()
    }, 100)
  }

  initializeNavigationCube() {
    this.navScene = this.config.navigationCube ? initNavCube(this.config, this.camera) : null;
  }

  add(item) {
    this.scene.add(item);
  }

  getByUniqueId(uniqueId) {
    return this.boxes.find(box => box.uniqueId === uniqueId);
  }

  removeByType(type) {
    this.scene.children = this.scene.children.filter(child => child.type !== type);
  }

  removeByName(name) {
    this.scene.children = this.scene.children.filter(child => child.name !== name);
  }

  remove(item) {
    if (item) {
      if (item.type === 'box') {
        this.removeBox(item);
      }
      for (let i = 0; i < this.children.length; i++) {
        if (this.children[i].uniqueId === item.uniqueId) {
          this.children.splice(i, 1);
          break
        }
      }
      if (item.attachedModel) {
        this.remove(item.attachedModel)
      }
      // item.visible = false;
      if (item.parent) item.parent.remove(item)
      if (item.boxId) {
        console.log("BOX ID", item.boxId)
        const box = this.getByUniqueId(item.boxId)
        this.scene.remove(box)
        this.removeByType('boxHelper')

        // remove from boxes array
        const index = this.boxes.indexOf(box);
        if (index > -1) {
          this.boxes.splice(index, 1);
        }
      }
      this.scene.remove(item);
    }
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
      this.controlsManager.initDragControls(this.boxes, this.renderer.domElement);
    }

    if (this.navScene) {
      resetNavCameraType(cameraType)
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
    const box = new Box(x, y, z, width, height, depth, rotation, stackable);
    this.scene.add(box);
    this.children.push(box);
    this.boxes.push(box);

    box.visible = false;

    return box
  }

  removeBox(box) {
    const index = this.children.indexOf(box);
    const boxIndex = this.boxes.indexOf(box);
    if (index > -1) {
      this.scene.remove(box);
      this.children.splice(index, 1);
    }
    if (boxIndex > -1) {
      this.boxes.splice(boxIndex, 1);
    }
  }

  async loadGLTFModel(url, { onClick=null }, { stackable = false, customData = null }, onPercent = () => {}) {
    var model = await GLTFModel(url, {}, onPercent)
    model.glueId = ++this.glueId
    this.scene.add(model)
    const sizeBox = new THREE.Box3().setFromObject(model, true);

    const box = this.addBox(model.position.x, model.position.y, model.position.z, sizeBox.max.x - sizeBox.min.x, sizeBox.max.y - sizeBox.min.y, sizeBox.max.z - sizeBox.min.z, 0, stackable)
    box.uniqueId = customData?.uniqueId || model.glueId
    box.name = customData?.name || "Model"
    box.description = customData?.description || "A Loaded GLTF Model"
    box.attachedModel = model

    // make the model follow the box position on every frame
    box.addEventListener('change', () => {
        model.position.set(box.position.x, box.position.y - (sizeBox.max.y - sizeBox.min.y) / 2, box.position.z);
        model.rotation.set(box.rotation.x, box.rotation.y, box.rotation.z);
    })

    model.boxId = box.uniqueId

    box.onClickEvent = onClick

    return model
  }

  async loadModel(contents, translation = null, rotation = null) {
    return new Promise((resolve, reject) => {
      this.loader.parse(contents, '', (gltf) => {
        gltf.scene.scale.set(this.config.modelScale || 1, this.config.modelScale || 1, this.config.modelScale || 1);
        // set type attribute, for collision detection
          gltf.scene.traverse((child) => {
              if (child.isMesh) {
              child.type = 'model';
              }
          });
        gltf.scene.glueId = ++this.glueId
        this.scene.add(gltf.scene);
        this.models.push(gltf.scene);
        if (translation) {
          gltf.scene.position.set(translation.x, translation.y, translation.z);
        }
        if (rotation) {
          gltf.scene.rotation.set(rotation.x, rotation.y, rotation.z);
        }
        resolve(gltf.scene);
      });
    });
  }

  async removeModel(model) {
    const index = this.models.indexOf(model);
    if (index > -1) {
      this.scene.remove(this.models[index]);
      this.models.splice(index, 1);
    }
  }

  setBoxModelScale(model, scale) {
    // get original position on the floor
    const sizeBox = new THREE.Box3().setFromObject(model, true);
    const originalY = sizeBox.min.y

    // console.log(model, model.scale, scale)
    model.scale.set(scale, scale, scale);

    // set the model back on the floor
    sizeBox.setFromObject(model, true);
    model.position.y -= (sizeBox.min.y - originalY) * scale

    // scale the attached model
    if (model.attachedModel) {
      model.attachedModel.scale.set(scale, scale, scale);
      // model.attachedModel.position.y -= (sizeBox.min.y - originalY) * scale
    }

  }

  addMountingPoint(position = new THREE.Vector3(0, 10, 0), rotation = new THREE.Euler(0, 0, 0)) {
    if (!position instanceof THREE.Vector3) { position = new THREE.Vector3(position.x, position.y, position.z); }
    if (!rotation instanceof THREE.Euler) { rotation = new THREE.Euler(rotation.x, rotation.y, rotation.z); }
    const mountingPoint = new MountingPoint(position, rotation, this);
    this.mountingPoints.push(mountingPoint);
    this.scene.add(mountingPoint);
    this.editingType = 'mountingPoint';
    mountingPoint.addEventListener('change', () => {
        this.dispatchEvent({ type: 'mountingPointChanged', object: mountingPoint });
    })

    return mountingPoint
  }

  removeMountingPoint(index) {
    const mountingPoint = this.mountingPoints[index];
    if (mountingPoint) {
      this.scene.remove(mountingPoint);
      this.mountingPoints.splice(index, 1);
    }
  }

  addBoundingBox(refObject, data) {
    const color = this.config.boundingBoxColors[this.boundingBoxes.length % this.config.boundingBoxColors.length];
    const boundingBox = new BoundingBox(refObject, this, data);
    boundingBox.setColor(color);
    this.boundingBoxes.push(boundingBox);
    this.scene.add(boundingBox);

    this.editingType = 'boundingBox';
    boundingBox.addEventListener('change', () => {
      this.dispatchEvent({ type: 'boundingBoxChanged', object: boundingBox });
    });

    return boundingBox
  }

  removeBoundingBox(index) {
      const boundingBox = this.boundingBoxes[index];
      this.scene.remove(boundingBox);
      this.boundingBoxes.splice(index, 1);
  }

  setBoundingBoxLocked(index, locked) {
    this.boundingBoxes[index].locked = !!locked;
    this.boundingBoxes[index].setTransparentBoxVisibility(!locked);
  }

  onMouseDown(event) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    let intersects = this.raycaster.intersectObjects(this.scene.children, true);
    let itemType = null;
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

      if (intersects[i].object.type === 'mountingPoint') {
        itemType = 'mountingPoint';
        if (parent && parent.type === 'mountingPoint') {
          this.editingType = 'mountingPoint';
        }
        else {
          this.editingType = 'mountingPoint';
        }

      }

      if (intersects[i].object.type === 'boundingBox') {
        if (parent && parent.type === 'boundingBox') {
          if (!parent.locked) {
            itemType = 'boundingBox';
            this.editingType = 'boundingBox';
          }
        }
        else {
          if (!intersects[i].object.locked) {
            itemType = 'boundingBox';
            this.editingType = 'boundingBox';
          }
        }

      }
      // XYZ control plane - when clicking this, if it's a bounding box or a mounting point, should toggle the transform controls type
      if (intersects[i].object.type === 'Mesh' && intersects[i].object.name === 'XYZ') {
        if (itemType) break;
      }

      if (intersects[i].object.type === 'Line') {
        itemType = 'something'
        break;
      }

      if (intersects[i].object.name === 'ground' && itemType === null && !something) {
        this.dispatchEvent({type:'ground-clicked'})
        break;
      }
    }

    this.dispatchEvent({type:'mouse-clicked'})
  }

  onMouseMove(event) {
    this.mouse.x = (event.clientX / this.container.clientWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / this.container.clientHeight) * 2 + 1;
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

  onKeyDown(event) {
    if (event.key === 'm') {
      this.controlsManager.toggleTransformControlsMode(this.editingType)
    }
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
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  createStageObject(width, height) {
    if (this.stageObject) {
      this.scene.remove(this.stageObject);
    }
    this.stageObject = new Box(0, 0, 0, 100, 0.1, 100, 0, true);
    this.scene.add(this.stageObject);
  }
}