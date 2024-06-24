import * as THREE from 'three';

export class BoundingBox extends THREE.Object3D {
  constructor(refObject, name = 'BoundingBox', data) {
    super();
    this.name = name;
    this.locked = false;

    const wireframeMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
    const translucentMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: false, transparent: true, opacity: 0.25 });

    if (refObject) {
        this.box = this.setFromObject(refObject, wireframeMaterial);
        this.transBox = this.setFromObject(refObject, translucentMaterial);

        // get box bounding box
        const boxCoords = new THREE.Box3().setFromObject(refObject);

        // set position based on boxCoords
        this.position.set(
            (boxCoords.max.x + boxCoords.min.x) / 2,
            (boxCoords.max.y + boxCoords.min.y) / 2,
            (boxCoords.max.z + boxCoords.min.z) / 2
        );

        // ..then, offset the child elements to the center of the bounding box
        this.box.position.set(0,0,0);
        this.transBox.position.set(0,0,0);
    }
    else {
        if (data !== undefined) {
            const {max, min, position, rotation} = data;

            this.box = this.setFromSize(max.x - min.x, max.y - min.y, max.z - min.z, wireframeMaterial)
            this.transBox = this.setFromSize(max.x - min.x, max.y - min.y, max.z - min.z, translucentMaterial)
            this.position.set(position.x, position.y, position.z);
            this.rotation.y = rotation;
        }
        else {
          this.box = this.setFromSize(1,1,1, wireframeMaterial);
          this.transBox = this.setFromSize(1,1,1, translucentMaterial);
        }
    }
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

  setTransparentBoxVisibility(visible) {
      this.transBox.visible = visible;
  }

  toObject() {
  this.box.geometry.computeBoundingBox()
    return {
      min: this.box.geometry.boundingBox.min,
      max: this.box.geometry.boundingBox.max,
      position: { x: this.position.x, y: this.position.y, z: this.position.z},
      rotation: this.rotation.y
    };
  }
}
