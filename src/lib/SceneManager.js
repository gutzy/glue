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
    const ambientLight = new THREE.AmbientLight(0xffffff); // soft white light
    this.scene.add(ambientLight);
    this.scene.add(light);
  }

  applyZAxisWaves(plane) {
    const { position } = plane.geometry.attributes;
    const waveFrequency = 14;  // Frequency of the wave
    const waveAmplitude = 0.05;  // Amplitude of the wave for a subtle effect

    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);  // Use X position to calculate the wave
      const z = position.getZ(i);  // Original Z position (should be 0 initially)

      // Apply a sine wave to the Z position to create the wavy effect
      const wave = Math.sin(waveFrequency * x) * waveAmplitude;
      position.setZ(i, z + wave);  // Modify Z (depth) axis
    }

    position.needsUpdate = true;  // Ensure the geometry is updated
  }

  // create a plane in the back of the stage
  createStageBackdrop(width, height, gap = 0.25) {
    if (this.backdrop) {
        this.removeStageBackdrop();
    }

    const geometry = new THREE.PlaneGeometry(width, 4, 80, 3);
    const material = new THREE.MeshStandardMaterial({ color: 0x881111, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(geometry, material);
    plane.position.set(0, 2, -height/2 + gap);
    this.backdrop = plane;
    this.applyZAxisWaves(plane);
    this.scene.add(plane);
  }

  removeStageBackdrop() {
    this.scene.remove(this.backdrop);
  }

  createGridHelper() {
    const gridHelper = new THREE.GridHelper(10, 20);
    this.scene.add(gridHelper);
    gridHelper.position.y = -0.01;
  }

  createFloor(width = 10, height = 10) {
    // remove any existing ground
    const oldGround = this.scene.getObjectByName('ground');
    if (oldGround) {
      this.scene.remove(oldGround);
    }

    const geometry = new THREE.BoxGeometry(width, height, 0.3);
    const material = new THREE.MeshPhongMaterial({ color: 0xaaaaaa, side: THREE.DoubleSide });
    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.15;
    ground.name = 'ground';
    this.scene.add(ground);
  }
}