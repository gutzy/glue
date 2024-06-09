export class Box {
  constructor(x, y, z, width, height, depth, rotation = 0, stackable = false) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.rotation = rotation;
    this.stackable = stackable;
    this.cube = null;
  }
}
