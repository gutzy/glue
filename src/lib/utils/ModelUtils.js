import {Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, ObjectLoader, PointLight, Vector3} from "three";
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const _modelCache = {};
const _textureCache = {};

export function BoxModel(width, height, depth, color = 0x000000, {receiveShadow = false, castShadow = false}) {
    const geometry = new BoxGeometry(width, height, depth);
    const material = new MeshStandardMaterial({ color });
    const mesh = new Mesh(geometry, material);
    mesh.receiveShadow = receiveShadow;
    mesh.castShadow = castShadow;
    return mesh;
}

export function copyName(name) {
    // if name ends with "copy" or "copy {number}", don't add copy but increment the number
    const match = name.match(/copy(\s(\d+))?$/);
    if (match) {
        if (match[2]) {
            return name.replace(match[2], (parseInt(match[2]) + 1));
        }
        return name.replace(/copy$/, "copy 2");
    }
    return name + " copy";
}

export function cloneChildrenMaterials(object) {
    object.traverse(child => {
        if (child.isMesh) {
            child.material = child.material.clone();
        }
    });
}

export function getItemsAbove(item, stage) {
    const items = [];
    for (const k in stage.children) {
        const child = stage.children[k];
        if (child.aboveItems && child.aboveItems.indexOf(item) >= 0) {
            items.push(child);
        }
    }
    return items;
}

export function flipMeshesByAxis(meshes, axis) {
    if (axis === "x") {
        for (const k in meshes) {
            const mesh = meshes[k]
            mesh.position.x = -mesh.position.x
            mesh.rotation.y = -mesh.rotation.y
        }
    }
    else if (axis === "y") {
        for (const k in meshes) {
            const mesh = meshes[k]
            mesh.position.z = -mesh.position.z
            mesh.rotation.y = -Math.PI-mesh.rotation.y
        }
    }
    else if (axis === "z") {
        for (const k in meshes) {
            const mesh = meshes[k]
            mesh.position.y = -mesh.position.y
            mesh.rotation.x = -mesh.rotation.x
        }
    }
    return meshes
}

export function findSelectable(o) {
    let result = o.selectable ? o : null;
    if (result) return result;
    while (!result && o.children.length) {
        o = o.children[0];
        result = o.selectable ? o : null;
    }
    if (o.selectable) return o
    return result;
}

export function selectableParent(o) {
    let result = o;
    while (result && !result.selectable) {
        result = result.parent;
    }
    return result;

}

export function getBlueprintMesh(blueprint) {
    if (blueprint instanceof Mesh) return blueprint;
    let children = blueprint.children;
    if (children[0] && children[0].name === "Scene") children = children[0].children;
    while (children.length === 1 && children[0].name === "Group") {
        children = children[0].children;
    }
    return children[0];
}

export function GLTFModel(url, {receiveShadow = false, castShadow = false}, onPercent = () => {}) {
    if (_modelCache[url]) {
        // console.log("Using cached model")
        // restore the original texture
        let r = new Group().copy(new ObjectLoader().parse(JSON.parse(_modelCache[url])));
        const mesh = new Group();
        r.receiveShadow = receiveShadow;
        r.castShadow = castShadow;
        r.url = url;
        mesh.selectable = true
        mesh.add(r);
        return Promise.resolve(mesh);
    }
    const loader = new GLTFLoader();
    const mesh = new Group();

    mesh.receiveShadow = receiveShadow;
    mesh.castShadow = castShadow;
    mesh.url = url;
    mesh.selectable = true
    return new Promise((resolve, reject) => {
        loader.load(url, (gltf) => {
            const model = gltf.scene;
            model.receiveShadow = receiveShadow;
            model.castShadow = castShadow;
            model.url = url;
            mesh.add(model);
            resolve(mesh);
        }, (xhr) => {
            onPercent(xhr.loaded / xhr.total * 100);
        }, (error) => {
            console.log('An error happened', error);
            reject(error);
        });
    })
}

export function toScreenPosition(obj, camera, canvas) {
    var vector = new Vector3();
    var widthHalf = 0.5 * canvas.width;
    var heightHalf = 0.5 * canvas.height;

    obj.updateMatrixWorld();
    vector.setFromMatrixPosition(obj.matrixWorld);
    vector.project(camera);

    vector.x = (vector.x * widthHalf) + widthHalf;
    vector.y = -(vector.y * heightHalf) + heightHalf;

    return {
        x: vector.x + canvas.offsetLeft,
        y: vector.y + canvas.offsetTop
    };
}

export function PointLightRow(colors, planeAxis = 'x', planeZ = 5, planePosition = 0, spacing = 10, intensity = 1, distance = 0, decay = 1) {
    const lights = [];
    for (let i = 0; i < colors.length; i++) {
        const light = new PointLight(colors[i], intensity, distance, decay);
        light.position.set(0, distance/1.5, planeZ);
        light.position[planeAxis] = planePosition + i * spacing;
        lights.push(light);
    }
    return lights;
}

export function getTopIntersections(object, stage, exclude = []) {
    let objectSelectable = object.selectable ? object : findSelectable(object)
    if (!objectSelectable) {
        return []
    }
    const targetBox = new Box3().setFromObject(objectSelectable);
    let intersectingObjects = [], selectable
    let targets = stage.children.filter(child => child !== object && exclude.indexOf(child) < 0)
    for (let stageObject of targets) {
        selectable = findSelectable(stageObject)
        if (selectable === objectSelectable || selectable === null) continue
        const objectBox = new Box3().setFromObject(selectable);
        if (areBoxesIntersecting(targetBox, objectBox)) {
            intersectingObjects.push({
                object: selectable,
                point: targetBox.clone().getCenter(new Vector3()).setY(objectBox.max.y)
            });
        }
    }

    // Return the list of intersecting objects
    return intersectingObjects;
}

export function areBoxesIntersecting(box1, box2) {
    // Compute the 8 vertices for each box
    const vertices1 = computeVertices(box1);
    const vertices2 = computeVertices(box2);

    for (const vertex1 of vertices1) {
        for (const vertex2 of vertices2) {
            // Compute the vector between the two vertices
            const vector = new Vector3().subVectors(vertex2, vertex1);

            // Project all vertices onto this vector
            const projections1 = vertices1.map(vertex => vertex.dot(vector));
            const projections2 = vertices2.map(vertex => vertex.dot(vector));

            // Check if the projections overlap
            const max1 = Math.max(...projections1);
            const min1 = Math.min(...projections1);
            const max2 = Math.max(...projections2);
            const min2 = Math.min(...projections2);

            if (max1 < min2 || min1 > max2) {
                // The projections do not overlap, so the boxes do not intersect
                return false;
            }
        }
    }

    // All projections overlapped, so the boxes intersect
    return true;
}

function computeVertices(box) {
    const min = box.min;
    const max = box.max;

    return [
        new Vector3(min.x, min.y, min.z),
        new Vector3(min.x, min.y, max.z),
        new Vector3(min.x, max.y, min.z),
        new Vector3(min.x, max.y, max.z),
        new Vector3(max.x, min.y, min.z),
        new Vector3(max.x, min.y, max.z),
        new Vector3(max.x, max.y, min.z),
        new Vector3(max.x, max.y, max.z),
    ];
}

