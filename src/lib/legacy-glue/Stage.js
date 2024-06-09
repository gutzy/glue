import {
  Scene,
  WebGLRenderer,
  Raycaster,
  MeshBasicMaterial,
  BoxGeometry,
  Mesh,
  AmbientLight,
  Color,
  PerspectiveCamera,
  DirectionalLight
} from 'three';
import { Controls } from "./Controls.js";
import { Box } from "./Box.js";

export class Stage {
  constructor(element) {
    this.children = [];
    this.boxes = [];
    this.element = element;

    this.init();
  }

  init() {
    this.initScene();
    this.initRenderer();
    this.initControls();
    this.setupLights();
    this.resetCamera();
    this.demoBoxes();
    this.animate();
  }

  initScene() {
    this.scene = new Scene();
    this.scene.background = new Color(0x000000);
    this.raycaster = new Raycaster();
  }

  initRenderer() {
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.element.clientWidth, this.element.clientHeight);
    this.element.appendChild(this.renderer.domElement);
  }

  initControls() {
    this.controls = new Controls(this.renderer.domElement, this);
  }

  setupLights() {
    const light = new DirectionalLight(0xffffff, 1);
    light.position.set(0, 200, 100);

    const ambientLight = new AmbientLight(0x606060); // soft white light
    this.scene.add(ambientLight);
    this.scene.add(light);
  }

  resetCamera() {
    this.camera = new PerspectiveCamera(75, this.element.clientWidth / this.element.clientHeight, 0.1, 1000);
    this.camera.aspect = this.element.clientWidth / this.element.clientHeight;
    this.camera.updateProjectionMatrix();
    this.camera.position.z = 100;
    this.camera.position.x = 0;
    this.camera.position.y = 100;
    this.camera.lookAt(0, 0, 0);
  }

  animate() {
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.animate());
  }

  demoBoxes() {
    this.add(new Box(-10, 0, 0, 10, 10, 10, 0));
    this.add(new Box(10, 0, 0, 10, 10, 10, 0));
    this.add(new Box(0, 0, 10, 10, 10, 10, 0));
    this.add(new Box(0, 0, -10, 10, 10, 10, 0));

    this.add(new Box(30, 0, 30, 16, 16, 30, 0, true));
    this.add(new Box(30, 0, -30, 20, 10, 10, 0));
    this.add(new Box(-30, 0, 30, 10, 20, 10, 0, true));

    this.add(new Box(40, 0, 0, 10, 20, 10, 45));
    this.add(new Box(45, 0, 20, 20, 30, 10, 90, true));
    this.add(new Box(60, 0, 20, 20, 10, 10, 135));
    this.add(new Box(75, 0, -20, 30, 10, 10, 180));
    this.add(new Box(90, 0, 0, 10, 10, 10, 225));
    this.add(new Box(105, 0, 0, 10, 10, 10, 270));
    this.add(new Box(120, 0, 0, 10, 10, 10, 315));
  }

  add(box) {
    const geometry = new BoxGeometry(box.width, box.height, box.depth);
    const color = box.stackable ? 0x0000ff : 0x00ff00;
    const material = new MeshBasicMaterial({ color, wireframe: true });
    const cube = new Mesh(geometry, material);
    const faceMaterial = new MeshBasicMaterial({ color: box.stackable ? 0x000055 : 0x005500 });
    const faceCube = new Mesh(geometry, faceMaterial);
    cube.add(faceCube);

    cube.position.set(box.x, box.y, box.z);
    cube.rotation.y = box.rotation * Math.PI / 180;
    cube.glue = true;
    cube.box = box;
    box.cube = cube;

    this.children.push(cube);
    this.boxes.push(box);
    this.scene.add(cube);
  }

  remove(child) {
    this.children.splice(this.children.indexOf(child), 1);
    if (child.box) {
      this.boxes.splice(this.boxes.indexOf(child.box), 1);
    }
    this.scene.remove(child);
  }

  rayCasting(mouseX, mouseY, type) {
    const x = (mouseX / this.element.clientWidth) * 2 - 1;
    const y = -(mouseY / this.element.clientHeight) * 2 + 1;
    this.raycaster.setFromCamera({ x, y }, this.camera);
    let intersects = this.raycaster.intersectObjects(this.children);
    switch (type) {
      case 'glue':
        return intersects.filter(i => i.object.glue);
      case 'floor':
        const floor = new Mesh(new BoxGeometry(1000, 1, 1000), new MeshBasicMaterial({ color: 0x000000 }));
        floor.position.set(0, -1, 0);
        floor.floor = true;
        this.children.push(floor);
        this.scene.add(floor);
        intersects = this.raycaster.intersectObjects(this.children).filter(i => i.object.floor);
        this.children.pop();
        this.scene.remove(floor);
        return intersects;
      case 'all':
      default:
        return intersects;
    }
  }

  destroy() {
    this.element.removeChild(this.renderer.domElement);
  }
}
