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
import {GLTFModel} from "./utils/ModelUtils";

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
    this.selectedObject = null;

    this.sceneManager = new SceneManager(this.scene, this.camera, this.container, this.config);
    this.controlsManager = new ControlsManager(this.camera, this.renderer.domElement, this, this.config);
    this.collisionHandler = new CollisionHandler(this);
    this.guiManager = new GUIManager(this);

    this.initControls();
    this.animate();
    window.addEventListener('resize', () => this.onWindowResize(), false);
    window.addEventListener('keydown', (event) => this.onKeyDown(event), false);
  }

  add(item) {
    this.scene.add(item);
  }

  removeByType(type) {
    console.log(this.scene.children)
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
        console.log(this.children[i])
        if (this.children[i].uniqueId === item.uniqueId) {
          this.children.splice(i, 1);
          break
        }
      }
      if (item.attachedModel) {
        this.remove(item.attachedModel)
      }
      // item.visible = false;
      item.parent.remove(item)
      this.scene.remove(item);
    }
  }

  setCamera(cameraType) {
    const aspect = this.container.clientWidth / this.container.clientHeight;

    if (cameraType === 'orthographic') {
      this.camera = new THREE.OrthographicCamera(-50 * aspect, 50 * aspect, 50, -50, 0.1, 1000);
    } else {
      this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    }

    this.camera.position.set(0, this.config.cameraPosY, this.config.cameraPosZ);
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
    this.transformControls.detach();
    const box = new Box(x, y, z, width, height, depth, rotation, stackable);
    this.scene.add(box);
    this.children.push(box);
    this.boxes.push(box);

    return box
  }

  removeBox(box) {
    const index = this.children.indexOf(box);
    const boxIndex = this.boxes.indexOf(box);
    if (index > -1) {
      this.scene.remove(box);
      this.children.splice(index, 1);
    }
    console.log({boxIndex, box})
    if (boxIndex > -1) {
      this.boxes.splice(boxIndex, 1);
    }
  }

  async loadGLTFModel(url, { onClick=null }, { stackable = false, customData = null }) {
    var model = await GLTFModel(url, {})
    model.glueId = ++this.glueId
    this.scene.add(model)
    console.log('Loaded GLTF model:', model);
    const sizeBox = new THREE.Box3().setFromObject(model);

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

    box.onClickEvent = onClick

    return model
  }

  async loadModel(contents, translation = null, rotation = null) {
    console.log({contents})

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
        console.log('Loaded model:', gltf.scene);
        if (translation) {
          console.log('Setting translation:', translation);
          gltf.scene.position.set(translation.x, translation.y, translation.z);
        }
        if (rotation) {
          console.log('Setting rotation:', rotation);
          gltf.scene.rotation.set(rotation.x, rotation.y, rotation.z);
        }
        resolve(gltf.scene);
      });
    });
  }

  async removeModel(model) {
    const index = this.models.indexOf(model);
    console.log('Removing model:', {model, index})
    if (index > -1) {
      this.scene.remove(this.models[index]);
      this.models.splice(index, 1);
    }
  }

  addMountingPoint(position = new THREE.Vector3(0, 10, 0), rotation = new THREE.Euler(0, 0, 0)) {
    if (!position instanceof THREE.Vector3) { position = new THREE.Vector3(position.x, position.y, position.z); }
    if (!rotation instanceof THREE.Euler) { rotation = new THREE.Euler(rotation.x, rotation.y, rotation.z); }
    console.log('Adding mounting point at position:', position, rotation);
    const mountingPoint = new MountingPoint(position, rotation, this);
    this.mountingPoints.push(mountingPoint);
    this.scene.add(mountingPoint);
    this.transformControls.attach(mountingPoint);
    this.transformControlsWhat = 'mountingPoint';
    mountingPoint.addEventListener('change', () => {
        this.dispatchEvent({ type: 'mountingPointChanged', object: mountingPoint });
    })

    return mountingPoint
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

  addBoundingBox(refObject, data) {
    const color = this.config.boundingBoxColors[this.boundingBoxes.length % this.config.boundingBoxColors.length];
    const boundingBox = new BoundingBox(refObject, this, data);
    boundingBox.setColor(color);
    this.boundingBoxes.push(boundingBox);
    this.scene.add(boundingBox);

    this.transformControls.attach(boundingBox);
    this.transformControlsWhat = 'boundingBox';
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

  setBoundingBoxLocked(index, locked) {
    this.boundingBoxes[index].locked = !!locked;
    this.boundingBoxes[index].setTransparentBoxVisibility(!locked);
    this.transformControls.detach();
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

    console.log('---------')
    for (let i = 0; i < intersects.length; i++) {
      parent = intersects[i].object.parent || null;


      if (intersects[i].object.type === 'Mesh' &&
          intersects[i].object.name !== 'ground' &&
          intersects[i].object.name !== 'XYZ' //&&
            // intersects[i].object.name !== 'Z' &&
            // intersects[i].object.name !== 'X' &&
            // intersects[i].object.name !== 'XZ' &&
            // intersects[i].object.name !== 'XY' &&
            // intersects[i].object.name !== 'ZY' &&
            // intersects[i].object.name !== 'Y'
      ) {
        let skipGizmo = false
        console.log(intersects[i].object.type, intersects[i].object.name);
        if (intersects[i].object.parent) {
          let p = intersects[i].object.parent
          while (p && p.parent) {
            if (p.type === "TransformControlsGizmo") {
              skipGizmo = true
            }
            p = p.parent
          }
        }
        if (!skipGizmo) {
          console.log("Something");
          something = true
        }
      }

      // console.log('Intersected', intersects[i].object.type, intersects[i].object.name);
      if (intersects[i].object.type === 'model') {
        this.selectedObject = intersects[i];
        console.log("Bobobob")
        // console.log('Selected object:', this.selectedObject.object.type, this.selectedObject.object.name);
        break;
      }

      if (intersects[i].object.type === 'mountingPoint') {
        itemType = 'mountingPoint';
        // console.log('Selected mounting point:', intersects[i].object.name);
        // should show the transform controls to the scene
        if (parent && parent.type === 'mountingPoint') {
          // console.log("Father")
          this.transformControls.attach(parent);
          this.transformControlsWhat = 'mountingPoint';
        }
        else {
          // console.log("Son of",parent.type)
          this.transformControls.attach(intersects[i].object);
          this.transformControlsWhat = 'mountingPoint';
        }

        // if (event.shiftKey) {
        //   console.log('Shift key pressed');
        //   this.transformControls.setMode(this.transformControls.mode === 'translate' ? 'rotate' : 'translate');
        // }
      }

      if (intersects[i].object.type === 'boundingBox') {
        console.log('Selected bounding box:', intersects[i].object.name);
        // should show the transform controls to the scene
        if (parent && parent.type === 'boundingBox') {
          if (!parent.locked) {
            itemType = 'boundingBox';
            this.transformControls.attach(parent);
            this.transformControlsWhat = 'boundingBox';
          }
        }
        else {
          if (!intersects[i].object.locked) {
            itemType = 'boundingBox';
            this.transformControls.attach(intersects[i].object);
            this.transformControlsWhat = 'boundingBox';
          }
        }

      }
      // XYZ control plane - when clicking this, if it's a bounding box or a mounting point, should toggle the transform controls type
      if (intersects[i].object.type === 'Mesh' && intersects[i].object.name === 'XYZ' && this.transformControls.object) {
        console.log('XYZ control plane clicked');
        if (itemType) break;
      }

      if (intersects[i].object.type === 'Line' && this.transformControls.object) {
        console.log("Line clicked")
        itemType = 'something'
        break;
      }


      if (intersects[i].object.name === 'ground' && itemType === null && !something) {
        this.dispatchEvent({type:'ground-clicked'})
        this.selectedObject = null;
        // should hide the transform controls
        this.transformControls.detach();
        break;
      }

    }

    this.dispatchEvent({type:'mouse-clicked'})
  }

  initControls() {
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableZoom = true;
    this.orbitControls.enableRotate = true;
    this.orbitControls.enablePan = false;

    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.transformControls.visible = false
    this.scene.add(this.transformControls);

    this.transformControls.dispose()

    this.dragControls = new DragControls(this.boxes, this.camera, this.renderer.domElement);
    this.dragControls.addEventListener('dragstart', event => {
      console.log("Start of drag", event.object)
      this.dispatchEvent({type:'drag-start', object: event.object})
      if (event.object.onClickEvent) {
        event.object.onClickEvent(event.object)
      }
      this.orbitControls.enabled = false;
      this.calculateDragOffset(event.object, event);
    });
    this.dragControls.addEventListener('drag', event => {
      this.updateDragPosition(event.object, event);
      this.collisionHandler.handleCollisions(event.object);
    });
    this.dragControls.addEventListener('dragend', () => {
      this.dispatchEvent({type:'drag-end'})
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

  toggleTransformControlsMode() {
    const mode = this.transformControls.mode;
    if (mode === 'translate') {
      this.transformControls.setMode('rotate')
      // limit to Y axis rotation
      console.log(this.transformControls)
      if (this.transformControlsWhat === 'mountingPoint') {
        this.transformControls.showX = true
        this.transformControls.showY = true
        this.transformControls.showZ = true
      }
      else if (this.transformControlsWhat === 'boundingBox') {
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

  onKeyDown(event) {
    // replace the mode of the transform controls when pressing the M key
    if (event.key === 'm') {
      this.toggleTransformControlsMode()
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

    // const rayOrigin = this.raycaster.ray.origin;
    // const rayDirection = this.raycaster.ray.direction;
    // const length = 10;

    // const rayHelper = new THREE.ArrowHelper(rayDirection, rayOrigin, length, 0xff0000);
    // this.scene.add(rayHelper);
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

  createStageObject(width, height) {
    if (this.stageObject) {
      this.scene.remove(this.stageObject);
    }
    this.stageObject = new Box(0, 0, 0, 100, 0.1, 100, 0, true);
    this.scene.add(this.stageObject);
  }
}