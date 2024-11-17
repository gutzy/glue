import { Box3, BoxHelper, Color, Object3D } from 'three'

export function SelectedItemHelper(parent, color) {
    // Create a new Object3D to hold the original bounding box
    const originalObject = new Object3D(), bpMesh = (parent);
    if (bpMesh.geometry) {
        originalObject.geometry = bpMesh.geometry.clone();
    }
    else if (bpMesh.object.geometry) {
        originalObject.geometry = bpMesh.object.geometry.clone();
    }
    else {
        console.log(bpMesh)
        console.log("No geometry found in blueprint mesh, cloning child geometry", bpMesh.children[0].geometry)
        originalObject.geometry = bpMesh.children[0].geometry.clone();
    }

    console.log({originalObject})

    // Calculate the bounding box of the original object
    const box = new Box3().setFromObject(originalObject);

    // Create a BoxHelper for the original bounding box
    const helper = new BoxHelper(originalObject, color instanceof Color ? color : new Color(color));

    // Update the helper's rotation before each render
    helper.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
        helper.matrixWorld.copy(parent.matrixWorld);
    };

    helper.update();
    return helper;
}



















