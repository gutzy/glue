import { OBB } from 'three/examples/jsm/math/OBB.js';
import { Vector3, Matrix4 } from 'three';

let boxId = 0;

export class Box {
  constructor(x, y, z, width, height, depth, rotation = 0, stackable = false) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.rotation = rotation; // Rotation around Y axis, in degrees
    this.stackable = stackable; // New property to indicate if the box is stackable
    this.id = ++boxId;
  }

  getOBB() {
    const center = new Vector3(0, 0, 0); // Center should be at origin
    const halfSize = new Vector3(this.width / 2, this.height / 2, this.depth / 2);

    const rotationMatrix = new Matrix4().makeRotationY(this.rotation * Math.PI / 180);
    const translationMatrix = new Matrix4().makeTranslation(this.x, this.y, this.z);

    const obb = new OBB(center, halfSize);
    obb.applyMatrix4(rotationMatrix);
    obb.applyMatrix4(translationMatrix);

    return obb;
  }

  intersects(other) {
    const obb1 = this.getOBB();
    const obb2 = other.getOBB();
    return obb1.intersectsOBB(obb2);
  }

  rotate(degrees) {
    this.rotation = (this.rotation + degrees) % 360;
  }
}
