import { Raycaster } from "three";
import { checkIntersection, handleCollision, handleStacking, applyGravity, checkHorizontalIntersection } from './IntersectionUtils.js';

export class Controls {
  isMouseDown = false;
  isDraggingItem = false;
  isPlacingNewItem = false;
  isRotatingItem = false;

  selectedItem = null;
  selectionPoint = null;

  constructor(domElement, stage) {
    this.domElement = domElement;
    this.stage = stage;

    this.attachEventListeners();
  }

  attachEventListeners() {
    this.domElement.addEventListener('mousedown', this.onMouseDown);
    this.domElement.addEventListener('mousemove', this.onMouseMove);
    this.domElement.addEventListener('mouseup', this.onMouseUp);
  }

  detachEventListeners() {
    this.domElement.removeEventListener('mousedown', this.onMouseDown);
    this.domElement.removeEventListener('mousemove', this.onMouseMove);
    this.domElement.removeEventListener('mouseup', this.onMouseUp);
  }

  onMouseDown = (event) => {
    this.isMouseDown = true;
    this.isDraggingItem = false;

    const intersects = this.stage.rayCasting(event.clientX, event.clientY, 'glue');
    if (intersects.length > 0) {
      this.selectedItem = intersects[0].object;
      this.selectionPoint = intersects[0].point;
      this.selectionPoint.x -= this.selectedItem.position.x;
      this.selectionPoint.z -= this.selectedItem.position.z;
      console.log(`Selected Box ${this.selectedItem.box.id}`);
    } else {
      this.selectedItem = null;
    }
  }

  onMouseMove = (event) => {
    if (this.isMouseDown && this.selectedItem) {
      this.isDraggingItem = true;
      const x = event.clientX;
      const y = event.clientY;
      let targetX, targetY;

      const intersects = this.stage.rayCasting(x, y, 'floor');
      if (intersects.length > 0) {
        const intersect = intersects[0];
        if (this.selectedItem) {
          targetX = intersect.point.x - this.selectionPoint.x;
          targetY = intersect.point.z - this.selectionPoint.z;
          console.log(`Moving Box ${this.selectedItem.box.id} to (${targetX}, ${targetY})`);

          if (this.selectedItem.box) {
            const originalX = this.selectedItem.box.x;
            const originalZ = this.selectedItem.box.z;

            this.selectedItem.box.x = targetX;
            this.selectedItem.box.z = targetY;

            let isStacked = false;
            for (let otherBox of this.stage.boxes) {
              if (otherBox.id !== this.selectedItem.box.id && otherBox.stackable) {
                if (checkHorizontalIntersection(this.selectedItem, otherBox)) {
                  console.log(`Box ${this.selectedItem.box.id} stacked on Box ${otherBox.id}`);
                  this.selectedItem.box.x = otherBox.x;
                  this.selectedItem.box.z = otherBox.z;
                  this.selectedItem.box.y = otherBox.y + otherBox.height;
                  this.selectedItem.position.x = otherBox.x;
                  this.selectedItem.position.z = otherBox.z;
                  this.selectedItem.position.y = otherBox.y + otherBox.height;
                  isStacked = true;
                  break;
                }
              }
            }

            if (!isStacked) {
              applyGravity(this.selectedItem, this.stage);
            }

            if (checkIntersection(this.selectedItem, this.stage)) {
              const { slideX, slideZ } = handleCollision(this.selectedItem, this.stage, targetX, targetY, originalX, originalZ);
              this.selectedItem.box.x = slideX;
              this.selectedItem.box.z = slideZ;
              this.selectedItem.position.x = slideX;
              this.selectedItem.position.z = slideZ;
            } else {
              this.selectedItem.position.x = targetX;
              this.selectedItem.position.z = targetY;
            }
          }
        }
      }
    } else {
      this.isDraggingItem = false;
    }
  }

  onMouseUp = (event) => {
    this.isMouseDown = false;
    if (this.isDraggingItem) {
      this.isDraggingItem = false;
      applyGravity(this.selectedItem, this.stage);
    }
  }
}
