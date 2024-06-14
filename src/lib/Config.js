export default class Config {
  constructor() {
    this.cameraType = 'perspective';
    this.modelScale = 1;
    this.showDebugGui = false;
    this.enablePan = false;
    this.enableZoom = false;
    this.enableRotate = false;
    this.enableDrag = false;
  }

    updateConfig(config) {
      if (config.cameraType) this.cameraType = config.cameraType;
      if (config.modelScale) this.modelScale = config.modelScale;
      if (config.showDebugGui) this.showDebugGui = config.showDebugGui;
      if (config.enablePan) this.enablePan = config.enablePan;
      if (config.enableZoom) this.enableZoom = config.enableZoom;
      if (config.enableRotate) this.enableRotate = config.enableRotate;
      if (config.enableDrag) this.enableDrag = config.enableDrag;
    }
}
