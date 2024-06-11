import * as THREE from 'three';
export class SceneManager {
  constructor(scene) {
    this.scene = scene;
    this.initScene();
  }

  initScene() {
    this.addLights();
    this.createFloor();
  }

  addLights() {
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(0, 200, 100);
    const ambientLight = new THREE.AmbientLight(0x606060); // soft white light
    this.scene.add(ambientLight);
    this.scene.add(light);
  }

  createFloor() {
    const geometry = new THREE.PlaneGeometry(1000, 1000);
    const material = new THREE.MeshBasicMaterial({ color: 0x666666 });
    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.name = 'ground';
    this.scene.add(ground);
  }
}
