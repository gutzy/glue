import { GUI } from 'dat.gui';
import Config from './Config';

export class GUIManager {
  constructor(stage) {
    this.stage = stage;
    this.initGUI();

    this.updateConfig(this.stage.config);
  }

  initGUI() {
    if (!window.gui) {
      this.gui = new GUI();
      window.gui = this.gui;

      // Panel for adding objects
      const objectParams = {
        x: 0,
        y: 0,
        z: 0,
        width: 10,
        height: 10,
        depth: 10,
        rotation: 0,
        stackable: false,
        addBox: () => {
          this.stage.addBox(objectParams.x, objectParams.y, objectParams.z, objectParams.width, objectParams.height, objectParams.depth, objectParams.rotation, objectParams.stackable);
        }
      };

      const objectFolder = this.gui.addFolder('Object Parameters');
      objectFolder.add(objectParams, 'x').name('X Position').step(1);
      objectFolder.add(objectParams, 'y').name('Y Position').step(1);
      objectFolder.add(objectParams, 'z').name('Z Position').step(1);
      objectFolder.add(objectParams, 'width').name('Width').step(1);
      objectFolder.add(objectParams, 'height').name('Height').step(1);
      objectFolder.add(objectParams, 'depth').name('Depth').step(1);
      objectFolder.add(objectParams, 'rotation').name('Rotation').step(1);
      objectFolder.add(objectParams, 'stackable').name('Stackable');
      objectFolder.add(objectParams, 'addBox').name('Add Box');

      // Panel for configuration settings. Config params should be extracted from the config object, using
      // the config class to ensure that the values are reactive.
      const configParams = {
        cameraType: this.stage.config.cameraType || 'perspective',
        modelScale: this.stage.config.modelScale || 1,
        enablePan: this.stage.config.enablePan || false,
        enableZoom: this.stage.config.enableZoom || false,
        enableRotate: this.stage.config.enableRotate || false,
        enableDrag: this.stage.config.enableDrag || false,
        updateConfig: () => {
          this.stage.updateConfig({
            cameraType: configParams.cameraType,
            modelScale: configParams.modelScale,
            enablePan: configParams.enablePan,
            enableZoom: configParams.enableZoom,
            enableRotate: configParams.enableRotate,
            enableDrag: configParams.enableDrag,
          });
        }
      };

      const configFolder = this.gui.addFolder('Configuration Settings');
      configFolder.add(configParams, 'cameraType', ['perspective', 'orthographic']).name('Camera Type').onChange(configParams.updateConfig);
      configFolder.add(configParams, 'modelScale', 0.1, 100).name('Model Scale').onChange(configParams.updateConfig);
      configFolder.add(configParams, 'enablePan').name('Enable Pan').onChange(configParams.updateConfig);
      configFolder.add(configParams, 'enableZoom').name('Enable Zoom').onChange(configParams.updateConfig);
      configFolder.add(configParams, 'enableRotate').name('Enable Rotate').onChange(configParams.updateConfig);
      configFolder.add(configParams, 'enableDrag').name('Enable Drag').onChange(configParams.updateConfig);

      objectFolder.open();
      configFolder.open();
    } else {
      this.gui = window.gui;
    }
  }

  updateConfig(config) {
    console.log("Updating config", config);
    if (config.showDebugGui) {
      this.gui.show();
    }
    else {
      this.gui.hide();
    }
  }
}
