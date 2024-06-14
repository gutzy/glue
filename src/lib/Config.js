export default class Config {
  constructor(config) {
    this.cameraType = 'perspective';
    this.modelScale = 1;
    this.showDebugGui = false;
    this.enablePan = false;
    this.enableZoom = false;
    this.enableRotate = false;
    this.enableDrag = false;
    this.boundingBoxColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xff8000]

    if (config) this.updateConfig(config);
  }

    updateConfig(config) {
      if (config.cameraType) this.cameraType = config.cameraType;
      if (config.modelScale) this.modelScale = config.modelScale;
      if (config.showDebugGui) this.showDebugGui = config.showDebugGui;
      if (config.enablePan) this.enablePan = config.enablePan;
      if (config.enableZoom) this.enableZoom = config.enableZoom;
      if (config.enableRotate) this.enableRotate = config.enableRotate;
      if (config.enableDrag) this.enableDrag = config.enableDrag;
      if (config.boundingBoxColors) this.boundingBoxColors = config.boundingBoxColors;
    }
}
