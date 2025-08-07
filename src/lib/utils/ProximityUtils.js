import * as THREE from 'three';

// Approximate the blob radius used by SelectedZoneHelper for a given object
export function computeInfluenceRadius(object, influenceScale = 2.0, maxBlobSize = 1.0) {
  if (!object) return 0.2;
  const bbox = new THREE.Box3().setFromObject(object);
  const size = bbox.getSize(new THREE.Vector3());
  const base = Math.max(size.x, size.z) / 2;
  const radius = Math.min(maxBlobSize, base * influenceScale);
  return Math.max(0.15, radius);
}

// Get world-space center of an object based on its bounding box
export function getObjectCenter(object) {
  if (!object) return { x: 0, z: 0 };
  const bbox = new THREE.Box3().setFromObject(object);
  const center = bbox.getCenter(new THREE.Vector3());
  return { x: center.x, z: center.z };
}


