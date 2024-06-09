export class DragAndDrop {
  constructor(scene) {
    this.scene = scene;
    this.dragging = false;
    this.draggedObject = null;
  }

  startDragging(object) {
    this.dragging = true;
    this.draggedObject = object;
  }

  drag(deltaX, deltaY, deltaZ) {
    if (this.dragging) {
      this.draggedObject.translate(deltaX, deltaY, deltaZ);
    }
  }

  stopDragging() {
    this.dragging = false;
    this.draggedObject = null;
  }

  isDragging() {
    return this.dragging;
  }
}
