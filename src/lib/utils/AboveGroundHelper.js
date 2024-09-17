import {
    Vector3,
    BufferGeometry,
    Group,
    Line,
    LineBasicMaterial,
} from 'three'
import {selectableParent} from "@/util/models/ModelUtils";

export function AboveGroundHelper(parent) {
    let group = new Group()
    const color = 0xFF6666

    // get the width of the parent object
    let width = 0, height = 0
    if (parent.geometry) {
        width = parent.geometry.parameters.width; height = parent.geometry.parameters.height
    }
    else if (parent.children[0].geometry) { width = parent.children[0].geometry.boundingBox.max.x - parent.children[0].geometry.boundingBox.min.x; height = parent.children[0].geometry.boundingBox.max.y - parent.children[0].geometry.boundingBox.min.y }
    else if (parent.children[0].children[0].geometry) { width = parent.children[0].children[0].geometry.boundingBox.max.x - parent.children[0].children[0].geometry.boundingBox.min.x; height = parent.children[0].children[0].geometry.boundingBox.max.y - parent.children[0].children[0].geometry.boundingBox.min.y }
    else if (parent.children[0].children[0].children[0].geometry) { width = parent.children[0].children[0].children[0].geometry.boundingBox.max.x - parent.children[0].children[0].children[0].geometry.boundingBox.min.x; height = parent.children[0].children[0].children[0].geometry.boundingBox.max.y - parent.children[0].children[0].children[0].geometry.boundingBox.min.y }
    else {
        console.error("Could not find width of parent object")
    }

    // Draw a line from the side of the square to the object
    const line = new Line(
      new BufferGeometry().setFromPoints([new Vector3(-width/2-.01, 0, -height/2-.01),new Vector3(-width/2-0.01, parent.position.y, -height/2-.01)]),
      new LineBasicMaterial({ color })
    )
    group.add(line)
    const line2 = new Line(
      new BufferGeometry().setFromPoints([new Vector3(width/2+0.01, 0, -height/2-.01),new Vector3(width/2+0.01, parent.position.y, -height/2-.01)]),
      new LineBasicMaterial({ color })
    )
    group.add(line2)
    const line3 = new Line(
        new BufferGeometry().setFromPoints([new Vector3(-width/2-0.01, 0, height/2+0.01),new Vector3(-width/2-0.01, parent.position.y, height/2+0.01)]),
        new LineBasicMaterial({ color })
        )
    group.add(line3)
    const line4 = new Line(
        new BufferGeometry().setFromPoints([new Vector3(width/2+0.01, 0, height/2+0.01),new Vector3(width/2+0.01, parent.position.y, height/2+0.01)]),
        new LineBasicMaterial({ color })
        )
    group.add(line4)

    group.position.x = parent.position.x
    group.position.z = parent.position.z
    group.position.y = 0

    group.updateAgHelper = (parent) => {
        parent = selectableParent(parent)
        group.position.x = parent.position.x
        group.position.z = parent.position.z
        group.children[0].geometry.setFromPoints([
            new Vector3(-width/2-0.01, 0, -height/2-0.01),
            new Vector3(-width/2-0.01, parent.position.y, -height/2-0.01)
        ])
        group.children[1].geometry.setFromPoints([
            new Vector3(width/2+0.01, 0, -height/2-0.01),
            new Vector3(width/2+0.01, parent.position.y, -height/2-0.01)
        ])
        group.children[2].geometry.setFromPoints([
            new Vector3(-width/2-0.01, 0, height/2+0.01),
            new Vector3(-width/2-0.01, parent.position.y, height/2+0.01)
        ])
        group.children[3].geometry.setFromPoints([
            new Vector3(width/2+0.01, 0, height/2+0.01),
            new Vector3(width/2+0.01, parent.position.y, height/2+0.01)
        ])
    }

    return group
}
