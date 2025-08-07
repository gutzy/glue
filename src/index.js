// src/index.js
export { Stage } from './lib/Stage.js';
export { Box } from './lib/objects/Box.js';
export { MountingPoint } from './lib/objects/MountingPoint.js';
export { BoundingBox } from './lib/objects/BoundingBox.js';
export {highlightObject, unhighlightObject} from './lib/utils/Highlighting.js';
export {SelectedItemHelper} from './lib/utils/SelectedItemHelper.js';
export {SelectedZoneHelper} from './lib/utils/SelectedZoneHelper.js';
export {RotatingHelper} from './lib/utils/RotatingHelper.js';
export {toScreenPosition, PointLightRow, getTopIntersections} from './lib/utils/ModelUtils.js';
export { computeInfluenceRadius, getObjectCenter } from './lib/utils/ProximityUtils.js';