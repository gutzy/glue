import * as THREE from 'three';

export class BoundingBox extends THREE.Object3D {
  constructor({min, max}, name = 'BoundingBox') {
    super();
    this.name = name;

    console.log('Bounding Box created:', {max, min});

    const boxGeometry = new THREE.BoxGeometry(
      max.x - min.x,
      max.y - min.y,
      max.z - min.z
    );
    const boxMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      wireframe: true,
    });
    const translucentBoxMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        wireframe: false,
        transparent: true,
        opacity: 0.5,
        })

    this.box = new THREE.Mesh(boxGeometry, boxMaterial);
    this.box.position.set(
      (max.x + min.x) / 2,
      (max.y + min.y) / 2,
      (max.z + min.z) / 2
    );
    this.add(this.box);

    this.transBox = new THREE.Mesh(boxGeometry, translucentBoxMaterial);
    this.transBox.position.set(
      (max.x + min.x) / 2,
      (max.y + min.y) / 2,
      (max.z + min.z) / 2
    );
    this.transBox.type = 'boundingBox';
    this.add(this.transBox);

    console.log('Bounding Box created, sizes:', min, max);
    var boxCoords = new THREE.Box3().setFromObject(this.box);
    console.log('Bounding Box coords:', boxCoords);

    this.type = 'boundingBox';
  }

  setFromObject(object) {
    const box = new THREE.Box3().setFromObject(object);
    this.box.geometry = new THREE.BoxGeometry(
      box.max.x - box.min.x,
      box.max.y - box.min.y,
      box.max.z - box.min.z
    );
    this.box.position.set(
      (box.max.x + box.min.x) / 2,
      (box.max.y + box.min.y) / 2,
      (box.max.z + box.min.z) / 2
    );
  }

  updateGeometry(min, max) {
    this.box.geometry.dispose();
    this.box.geometry = new THREE.BoxGeometry(
      max.x - min.x,
      max.y - min.y,
      max.z - min.z
    );
    this.box.position.set(
      (max.x + min.x) / 2,
      (max.y + min.y) / 2,
      (max.z + min.z) / 2
    );
  }

  toObject() {
    console.log("Returning bounding box min, max and rotation on the Y axis")
    return {
      min: this.box.geometry.boundingBox.min,
      max: this.box.geometry.boundingBox.max,
      position: { x: this.position.x, y: this.position.y, z: this.position.z},
      rotation: this.rotation.y
    };
  }
}
