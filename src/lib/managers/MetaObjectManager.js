import * as THREE from "three";
import {MountingPoint} from "../objects/MountingPoint";
import {BoundingBox} from "../objects/BoundingBox";

export class MetaObjectManager extends THREE.EventDispatcher {
    constructor(stage, scene, config) {
        super();
        this.stage = stage
        this.scene = scene
        this.config = config
        this.mountingPoints = []
        this.boundingBoxes = []
    }

    addMountingPoint(position = new THREE.Vector3(0, 10, 0), rotation = new THREE.Euler(0, 0, 0)) {
        if (!position instanceof THREE.Vector3) { position = new THREE.Vector3(position.x, position.y, position.z); }
        if (!rotation instanceof THREE.Euler) { rotation = new THREE.Euler(rotation.x, rotation.y, rotation.z); }
        const mountingPoint = new MountingPoint(position, rotation, this);
        this.mountingPoints.push(mountingPoint);
        this.scene.add(mountingPoint);
        this.editingType = 'mountingPoint';
        mountingPoint.addEventListener('change', () => {
            this.dispatchEvent({ type: 'mountingPointChanged', object: mountingPoint });
        })

        return mountingPoint
    }

    removeMountingPoint(index) {
        const mountingPoint = this.mountingPoints[index];
        if (mountingPoint) {
            this.scene.remove(mountingPoint);
            this.mountingPoints.splice(index, 1);
        }
    }

    addBoundingBox(refObject, data) {
        const color = this.config.boundingBoxColors[this.boundingBoxes.length % this.config.boundingBoxColors.length];
        const boundingBox = new BoundingBox(refObject, this, data);
        boundingBox.setColor(color);
        this.boundingBoxes.push(boundingBox);
        this.scene.add(boundingBox);

        this.editingType = 'boundingBox';
        boundingBox.addEventListener('change', () => {
            this.dispatchEvent({ type: 'boundingBoxChanged', object: boundingBox });
        });

        return boundingBox
    }

    removeBoundingBox(index) {
        const boundingBox = this.boundingBoxes[index];
        this.scene.remove(boundingBox);
        this.boundingBoxes.splice(index, 1);
    }

    setBoundingBoxLocked(index, locked) {
        this.boundingBoxes[index].locked = !!locked;
        this.boundingBoxes[index].setTransparentBoxVisibility(!locked);
    }
}