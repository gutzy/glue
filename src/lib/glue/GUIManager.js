import { GUI } from 'dat.gui';

export class GUIManager {
  constructor(stage) {
    this.stage = stage;
    this.initGUI();
  }

  initGUI() {
    if (!window.gui) {
      this.gui = new GUI();
      window.gui = this.gui;

      const params = {
        x: 0,
        y: 0,
        z: 0,
        width: 10,
        height: 10,
        depth: 10,
        rotation: 0,
        addBox: () => {
          this.stage.addBox(params.x, params.y, params.z, params.width, params.height, params.depth, params.rotation);
        }
      };

      this.gui.add(params, 'x').name('X Position').step(1);
      this.gui.add(params, 'y').name('Y Position').step(1);
      this.gui.add(params, 'z').name('Z Position').step(1);
      this.gui.add(params, 'width').name('Width').step(1);
      this.gui.add(params, 'height').name('Height').step(1);
      this.gui.add(params, 'depth').name('Depth').step(1);
      this.gui.add(params, 'rotation').name('Rotation').step(1);
      this.gui.add(params, 'addBox').name('Add Box');
    } else {
      this.gui = window.gui;
    }
  }
}
