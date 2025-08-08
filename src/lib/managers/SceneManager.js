import * as THREE from 'three';
export class SceneManager {

  constructor(scene, camera, container, config) {
    this.scene = scene;
    this.camera = camera;
    this.container = container;
    this.config = config;
    this.initScene();

    this.bounds = null
  }

  initScene() {
    this.setupSceneSettings(this.config.backgroundColor, this.config.floorColor, this.config.curtainColor)
    this.addLights()
  }

  setupSceneSettings(backgroundColor, floorColor, curtainColor) {
    this.scene.background = new THREE.Color(backgroundColor || 0x000000);
    this.scene.fog = new THREE.Fog(0x000000, 1, 1000);

    const floor = this.scene.getObjectByName('ground');
    if (floor) {
      this.createFloor(floor.geometry.parameters.width, floor.geometry.parameters.height, floorColor)
    }
    if (this.backdrop) {
        this.createStageBackdrop(this.curtainSizeWidth, this.curtainSizeHeight, this.curtainHeight, this.gap, curtainColor);
    }
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
  createStageBackdrop(width, height, curtainHeight = 4, gap = 0.25, curtainColor = 0x881111) {
    if (this.backdrop) {
        this.removeStageBackdrop();
    }

    if (!this.curtainHeight) this.curtainHeight = curtainHeight;
    if (!this.gap) this.gap = gap;
    if (!this.curtainSizeWidth) this.curtainSizeWidth = width;
    if (!this.curtainSizeHeight) this.curtainSizeHeight = height;

    const geometry = new THREE.PlaneGeometry(width, curtainHeight, 80, 3);
    const material = new THREE.MeshStandardMaterial({ color: curtainColor, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(geometry, material);
    plane.position.set(0, curtainHeight/2, -height/2 + gap);
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

  createFloor(width = 10, height = 10, floorColor = 0xeeeeee) {
    // remove any existing ground
    const oldGround = this.scene.getObjectByName('ground');
    if (oldGround) {
      this.scene.remove(oldGround);
    }

    const geometry = new THREE.BoxGeometry(width, height, 0.3);
    const material = new THREE.MeshPhongMaterial({ color: floorColor, side: THREE.DoubleSide });
    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.15;
    ground.name = 'ground';
    this.scene.add(ground);

    const floorBoundingBox = new THREE.Box3().setFromObject(ground);
    this.bounds = {
      x1: floorBoundingBox.min.x,
      z1: floorBoundingBox.min.z,
      x2: floorBoundingBox.max.x,
      z2: floorBoundingBox.max.z
    }
  }
}