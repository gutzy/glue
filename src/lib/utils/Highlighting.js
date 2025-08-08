let highlights = []

export function highlightObject(object, color) {
  if (object && object.material && object.material.emissive) {
    object.material.emissive.set(color);
  }
  else if (object && object.children) {
    for (let c of object.children) {
      if (c.material && c.material.emissive) {
        c.material.emissive.set(color);
      }
    }
  }
}

export function unhighlightObject(object) {

}
