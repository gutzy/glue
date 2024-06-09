import {Vector3} from "three";

export function checkIntersection(selectedItem, stage) {
  let doesIntersect = false;

  for (let otherBox of stage.boxes) {
    if (otherBox.id !== selectedItem.box.id) {
      const intersects = selectedItem.box.intersects(otherBox);
      if (intersects) {
        console.log(`Intersection detected between Box ${selectedItem.box.id} and Box ${otherBox.id}`);
        console.log(`Selected Box ${selectedItem.box.id} - Position: (${selectedItem.box.x}, ${selectedItem.box.y}, ${selectedItem.box.z}), Size: (${selectedItem.box.width}, ${selectedItem.box.height}, ${selectedItem.box.depth}), Rotation: ${selectedItem.box.rotation}`);
        console.log(`Other Box ${otherBox.id} - Position: (${otherBox.x}, ${otherBox.y}, ${otherBox.z}), Size: (${otherBox.width}, ${otherBox.height}, ${otherBox.depth}), Rotation: ${otherBox.rotation}`);
        doesIntersect = true;
        break;
      }
    }
  }

  return doesIntersect;
}

export function handleCollision(selectedItem, stage, targetX, targetY, originalX, originalZ) {
  let slideX = targetX;
  let slideZ = targetY;

  console.log(`Trying to slide along X axis: (${targetX}, ${originalZ})`);
  selectedItem.box.x = targetX;
  selectedItem.box.z = originalZ;
  let intersection = checkIntersection(selectedItem, stage);
  if (!intersection.doesIntersect) {
    slideX = targetX;
    slideZ = originalZ;
  } else {
    console.log(`Trying to slide along Z axis: (${originalX}, ${targetY})`);
    selectedItem.box.x = originalX;
    selectedItem.box.z = targetY;
    intersection = checkIntersection(selectedItem, stage);
    if (!intersection.doesIntersect) {
      slideX = originalX;
      slideZ = targetY;
    } else {
      console.log(`Full collision detected, reverting to original position: (${originalX}, ${originalZ})`);
      slideX = originalX;
      slideZ = originalZ;

      // If the intersection involves a stackable object, try to stack instead of stopping
      if (intersection.otherBox.stackable) {
        console.log(`Attempting to stack Box ${selectedItem.box.id} on Box ${intersection.otherBox.id}`);
        selectedItem.box.y = intersection.otherBox.y + intersection.otherBox.height;
        selectedItem.position.y = intersection.otherBox.y + intersection.otherBox.height;
        return { slideX: originalX, slideZ: originalZ, stacked: true };
      }
    }
  }

  return { slideX, slideZ, stacked: false };
}


export function handleStacking(selectedItem, stage) {
  let isStacked = false;

  for (let otherBox of stage.boxes) {
    if (otherBox.id !== selectedItem.box.id && otherBox.stackable) {
      const obb = otherBox.getOBB();
      const intersects = selectedItem.box.getOBB().intersectsOBB(obb);
      if (intersects) {
        console.log(`Stacking Box ${selectedItem.box.id} on top of Box ${otherBox.id}`);
        console.log(`Selected Box ${selectedItem.box.id} - Position: (${selectedItem.box.x}, ${selectedItem.box.y}, ${selectedItem.box.z}), Size: (${selectedItem.box.width}, ${selectedItem.box.height}, ${selectedItem.box.depth}), Rotation: ${selectedItem.box.rotation}`);
        console.log(`Other Box ${otherBox.id} - Position: (${otherBox.x}, ${otherBox.y}, ${otherBox.z}), Size: (${otherBox.width}, ${otherBox.height}, ${otherBox.depth}), Rotation: ${otherBox.rotation}`);
        selectedItem.box.x = otherBox.x;
        selectedItem.box.z = otherBox.z;
        selectedItem.box.y = otherBox.y + otherBox.height;
        selectedItem.position.x = otherBox.x;
        selectedItem.position.z = otherBox.z;
        selectedItem.position.y = otherBox.y + otherBox.height;
        isStacked = true;
        break;
      }
    }
  }

  return isStacked;
}

export function findStackableBelow(selectedItem, stage) {
  let belowBox = null;
  let maxHeight = -Infinity;

  for (let otherBox of stage.boxes) {
    if (otherBox.id !== selectedItem.box.id && otherBox.stackable) {
      const distance = selectedItem.box.y - (otherBox.y + otherBox.height);
      const horizontalOverlapX = Math.abs(selectedItem.box.x - otherBox.x) < (selectedItem.box.width + otherBox.width) / 2;
      const horizontalOverlapZ = Math.abs(selectedItem.box.z - otherBox.z) < (selectedItem.box.depth + otherBox.depth) / 2;
      console.log(`Checking Box ${selectedItem.box.id} against Box ${otherBox.id}: distance = ${distance}, horizontalOverlapX = ${horizontalOverlapX}, horizontalOverlapZ = ${horizontalOverlapZ}, maxHeight = ${maxHeight}`);
      if (distance >= 0 && horizontalOverlapX && horizontalOverlapZ) {
        if (otherBox.y + otherBox.height > maxHeight) {
          belowBox = otherBox;
          maxHeight = otherBox.y + otherBox.height;
          console.log(`Updated belowBox: Box ${belowBox.id}, maxHeight = ${maxHeight}`);
        }
      }
    }
  }

  console.log(`findStackableBelow: selectedItem = ${selectedItem.box.id}, belowBox = ${belowBox ? belowBox.id : 'null'}`);
  return belowBox;
}

export function applyGravity(selectedItem, stage) {
  const belowBox = findStackableBelow(selectedItem, stage);
  if (belowBox) {
    selectedItem.box.y = belowBox.y + belowBox.height;
    selectedItem.position.y = belowBox.y + belowBox.height;
    console.log(`Box ${selectedItem.box.id} falling to Box ${belowBox.id}`);
  } else {
    selectedItem.box.y = 0;
    selectedItem.position.y = 0;
    console.log(`Box ${selectedItem.box.id} falling to the floor`);
  }
}

export function checkHorizontalIntersection(selectedItem, otherBox) {
  const selectedOBB = selectedItem.box.getOBB();
  const otherOBB = otherBox.getOBB();
  const selectedCenter = new Vector3(selectedOBB.center.x, 0, selectedOBB.center.z);
  const otherCenter = new Vector3(otherOBB.center.x, 0, otherOBB.center.z);
  const selectedHalfSize = new Vector3(selectedOBB.halfSize.x, 0, selectedOBB.halfSize.z);
  const otherHalfSize = new Vector3(otherOBB.halfSize.x, 0, otherOBB.halfSize.z);

  const overlapX = Math.abs(selectedCenter.x - otherCenter.x) < (selectedHalfSize.x + otherHalfSize.x);
  const overlapZ = Math.abs(selectedCenter.z - otherCenter.z) < (selectedHalfSize.z + otherHalfSize.z);

  console.log(`checkHorizontalIntersection: selectedItem = ${selectedItem.box.id}, otherBox = ${otherBox.id}, selectedCenter = ${selectedCenter}, otherCenter = ${otherCenter}, overlapX = ${overlapX}, overlapZ = ${overlapZ}`);
  console.log(`Box positions - Selected Box: (${selectedItem.box.x}, ${selectedItem.box.y}, ${selectedItem.box.z}), Other Box: (${otherBox.x}, ${otherBox.y}, ${otherBox.z})`);
  console.log(`Box dimensions - Selected Box: (${selectedItem.box.width}, ${selectedItem.box.height}, ${selectedItem.box.depth}), Other Box: (${otherBox.width}, ${otherBox.height}, ${otherBox.depth})`);

  return { overlapX, overlapZ };
}
