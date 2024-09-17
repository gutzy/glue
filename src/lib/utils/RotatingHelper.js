// return a 3D circle that is segmented into 12 parts, with a separator between each part
import {Shape, Mesh, Group, ExtrudeGeometry, MeshStandardMaterial, Color} from "three";

export class RotatingHelperEdge extends Mesh {
    constructor(angle, color, target) {
        const shape = new Shape()
        shape.moveTo(0, 0)
        shape.absarc(0, 0, 1, 0, Math.PI / 12, false)
        shape.lineTo(0, 0)

        shape.name = "RotatingHelperEdge"

        const geometry = new ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: false })
        const material = new MeshStandardMaterial({ color })
        material.transparent = true
        material.opacity = 0.5
        super(geometry, material)

        this.helperAngle = angle
        this.helperTarget = target
        this.rotation.z = angle * Math.PI / 12 - Math.PI / 24
    }

    setColor(color) {
        color = color instanceof Color ? color : new Color(color)
        this.material.color.set(color)
    }
}

export function RotatingHelper(parent) {
    let shape, group = new Group()
    for (let i = 0; i < 24; i++) {
        const color = i % 2 === 0 ? 0xbababa : 0x666666
        const mesh = new RotatingHelperEdge(i, color, parent)
        group.add(mesh)
    }
    group.rotation.x = -Math.PI / 2

    group.position.x = parent.position.x
    group.position.z = parent.position.z
    group.position.y = parent.position.y

    // group.position.y = 0
    return group
}
