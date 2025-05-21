let highlights = []

export function highlightObject(object, color) {
  if (object && object.material && object.material.emissive) {
    object.material.emissive.set(color);
    console.log("oink")
  }
  else if (object && object.children) {
    for (let c of object.children) {
      if (c.material && c.material.emissive) {
        console.log("daya")
        c.material.emissive.set(color);
      }
    }
  }
}

export function unhighlightObject(object) {

}
