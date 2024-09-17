export default class Config {
  constructor(config) {
    this.cameraType = 'perspective';
    this.cameraPosX = 0;
    this.cameraPosY = 100;
    this.cameraPosZ = 100;
    this.modelScale = 1;
    this.showDebugGui = false;
    this.enablePan = false;
    this.enableZoom = false;
    this.enableRotate = false;
    this.enableDrag = false;
    this.rotatingHelper = false;
    this.boundingBoxColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xff8000]
    this.backgroundColor = 0x000000;


    if (config) this.updateConfig(config);
  }

    updateConfig(config) {
      if (config.cameraType !== undefined) this.cameraType = config.cameraType;
      if (config.cameraPosX !== undefined) this.cameraPosX = config.cameraPosX;
      if (config.cameraPosY !== undefined) this.cameraPosY = config.cameraPosY;
      if (config.cameraPosZ !== undefined) this.cameraPosZ = config.cameraPosZ;
      if (config.modelScale !== undefined) this.modelScale = config.modelScale;
      if (config.showDebugGui !== undefined) this.showDebugGui = config.showDebugGui;
      if (config.enablePan !== undefined) this.enablePan = config.enablePan;
      if (config.rotatingHelper !== undefined) this.rotatingHelper = config.rotatingHelper;
      if (config.enableZoom !== undefined) this.enableZoom = config.enableZoom;
      if (config.enableRotate !== undefined) this.enableRotate = config.enableRotate;
      if (config.enableDrag !== undefined) this.enableDrag = config.enableDrag;
      if (config.boundingBoxColors !== undefined) this.boundingBoxColors = config.boundingBoxColors;
      if (config.backgroundColor !== undefined) this.backgroundColor = config.backgroundColor;
    }
}
