import * as THREE from 'three';

export class BoundingBox extends THREE.Object3D {
  constructor(refObject, name = 'BoundingBox') {
    super();
    this.name = name;

    const wireframeMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
    const translucentMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: false, transparent: true, opacity: 0.25 });

    if (refObject !== undefined) {
        this.box = this.setFromObject(refObject, wireframeMaterial);
        this.transBox = this.setFromObject(refObject, translucentMaterial);
    }
    else {
        this.box = this.setFromSize(1,1,1, wireframeMaterial);
        this.transBox = this.setFromSize(1,1,1, translucentMaterial);
    }
    const boxCoords = new THREE.Box3().setFromObject(this.box);
    console.log('Bounding Box coords:', boxCoords);

    this.add(this.box);
    this.add(this.transBox);

    this.type = 'boundingBox';
  }

  setFromObject(object, material) {
    const box = new THREE.Box3().setFromObject(object);

    const geometry = new THREE.BoxGeometry(
      box.max.x - box.min.x,
      box.max.y - box.min.y,
      box.max.z - box.min.z
    );
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
        (box.max.x + box.min.x) / 2,
        (box.max.y + box.min.y) / 2,
        (box.max.z + box.min.z) / 2
        );
    mesh.type = 'boundingBox';

    return mesh;
  }

  setFromSize(w,h,d,material) {
    const geometry = new THREE.BoxGeometry(w,h,d);
    // this.box.position.set(0,0,0);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0,0,0);
    mesh.type = 'boundingBox';
    return mesh;
  }

  setColor(color) {
    this.box.material.color.set(color);
    this.transBox.material.color.set(color);
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
