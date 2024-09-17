import * as THREE from 'three';
export class SceneManager {

  constructor(scene, camera, container, config) {
    this.scene = scene;
    this.camera = camera;
    this.container = container;
    this.config = config;
    this.initScene();
  }

  initScene() {
    this.setupSceneSettings(this.config.backgroundColor)
    this.addLights()
  }

  setupSceneSettings(backgroundColor) {
    this.scene.background = new THREE.Color(backgroundColor || 0x000000);
    this.scene.fog = new THREE.Fog(0x000000, 1, 1000);
  }

  addLights() {
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(0, 200, 100);
    const ambientLight = new THREE.AmbientLight(0x606060); // soft white light
    this.scene.add(ambientLight);
    this.scene.add(light);
  }

  createGridHelper() {
    const gridHelper = new THREE.GridHelper(10, 20);
    this.scene.add(gridHelper);
    gridHelper.position.y = -0.01;
  }

  createFloor() {
    const geometry = new THREE.PlaneGeometry(10, 10);
    const material = new THREE.MeshNormalMaterial({ color: 0x666666, opacity: 0.01 });
    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.name = 'ground';
    this.scene.add(ground);
  }
}