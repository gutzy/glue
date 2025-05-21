let navScene, navCamera, navCube, mainCamera, navCameraType = 'orthographic';
const navCubeSize = 70; // Cube size in pixels
import * as THREE from 'three';
const mouse = new THREE.Vector2();
let isDragging = false;

let mouseDownStartPoint = { x: 0, y: 0 };
let lastMousePosition = { x: 0, y: 0 };
const raycaster = new THREE.Raycaster();

let myConfig;

let _width = window.innerWidth, _height = window.innerHeight;

export function resetNavCameraType(type = 'orthographic', width = window.innerWidth, height = window.innerHeight) {

    _width = width
    _height = height
    navCameraType = type;

    type = 'orthographic'

    if (type === 'orthographic') {
        navCamera = new THREE.OrthographicCamera(
            -width / 2,
            width / 2,
            height / 2,
            -height / 2,
            0.1,
            1000
        );
        navCamera.position.z = 150;
    } else if (type === 'perspective') {
        console.log("Wut??")
        navCamera = new THREE.PerspectiveCamera(
            75, // Field of view
            width / height, // Aspect ratio
            0.1, // Near plane
            1000 // Far plane
        );
        navCamera.position.z = 75*6;
        navCamera.position.y = -75;
        navCamera.position.x = 0;
    } else {
        console.error('Unknown camera type:', type);
    }
    navScene.add(navCamera);
    navScene.camera = navCamera;

    navCamera.lookAt(0, 0, 0);

    // Update matrices
    navCamera.updateProjectionMatrix();
    navCamera.updateMatrixWorld();

    // Ensure cube position and rotation are updated
    updateNavCubePosition();
    updateNavCubeRotation();

    return navCamera
}

function createFaceMaterial(color, text, textColor = 'black') {
    const size = 256; // Texture resolution
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');

    // Draw background color
    context.fillStyle = color;
    context.fillRect(0, 0, size, size);

    context.fillStyle = textColor; // Text color
    context.font = 'bold 48px Arial'; // Font size and style
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text.toUpperCase(), size / 2, size / 2); // Center the text

    // Return a material with the canvas texture
    const texture = new THREE.CanvasTexture(canvas);
    return new THREE.MeshBasicMaterial({ map: texture });
}

export function initNavCube(config, mainCameraRef, width = window.innerWidth, height = window.innerHeight) {
    if (!config.navigationCube) return;

    myConfig = config;

    mainCamera = mainCameraRef;
    navScene = new THREE.Scene();
    navCameraType === 'orthographic' ? navCamera = resetNavCameraType('orthographic', width, height) : navCamera = resetNavCameraType('perspective', width, height);

    navCamera.position.z = 150;
    const navCubeGeometry = new THREE.BoxGeometry(navCubeSize, navCubeSize, navCubeSize);
    const navCubeMaterials = [
        createFaceMaterial('#e14141', 'Right'),  // +X
        createFaceMaterial('#74b1ed', 'Left'), // -X
        createFaceMaterial('#43ec5f', 'Top'),   // +Y
        createFaceMaterial('#702f20', 'Bottom','white'), // -Y
        createFaceMaterial('#e8cb95', 'Front'), // +Z
        createFaceMaterial('#33216a', 'Back', 'white') // -Z
    ];

    navCube = new THREE.Mesh(navCubeGeometry, navCubeMaterials);
    navScene.add(navCube);

// Add event listeners for dragging
    let el = document.querySelector('canvas')
    el.removeEventListener('mousedown', onMouseDown);
    el.removeEventListener('mousemove', onMouseMove);
    el.removeEventListener('mouseup', onMouseUp);

    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('mousemove', onMouseMove);
    el.addEventListener('mouseup', onMouseUp);

    return {scene: navScene, camera: navCamera};
}

// Position the Cube in the Top-Left Corner
export function updateNavCubePosition() {
    if (!navCube) {
        // console.error('Error: navCube is not defined!');
        return;
    }
    if (!navCamera) {
        // console.error('Error: navCamera is not defined!');
        return;
    }

    const offsetTop = 80, offsetLeft = 50; // Padding from the edges
    const cubeWidth = navCube.geometry.parameters.width * navCube.scale.x;
    const cubeHeight = navCube.geometry.parameters.height * navCube.scale.y;

    navCameraType = 'orthographic'
    // Position the cube in the top-left corner
    if (navCameraType === 'orthographic') {
        navCube.position.set(
            navCamera.left + cubeWidth / 2 + offsetLeft,
            navCamera.top - cubeHeight / 2 - offsetTop,
            0
        );
    } else if (navCameraType === 'perspective') {
        // For perspective camera, we need to adjust the position based on the camera's field of view
        // the cube needs to be in the top left corner of the screen, and the camera needs to be looking at the center of the stage
        const aspect = navCamera.aspect;
        const fov = THREE.MathUtils.degToRad(navCamera.fov);
        const height = 2 * Math.tan(fov / 2) * navCamera.position.z;
        const width = height * aspect;
        navCube.position.set(
            -width / 5 + cubeWidth / 2 + offsetLeft,
            height / 2 - cubeHeight / 2 - offsetTop,
            0
        );
    } else {
        console.error('Unknown camera type:', navCameraType);
    }

}

export function updateNavCubeRotation() {
    if (isDragging) return
    if (!navCube) {
        // console.error('Error: navCube is not defined!');
        return;
    }
    if (!mainCamera) {
        // console.error('Error: mainCamera is not defined!');
        return;
    }

    // Sync the navCube with the main camera
        const rotation = new THREE.Euler(-mainCamera.rotation.x, -mainCamera.rotation.y, 0, 'XYZ'); // Negate only Y for cube
        navCube.rotation.set(rotation.x, rotation.y, rotation.z);
}

function onMouseDown(event) {
    let target = event.target;
    // get target size
    const rect = target.getBoundingClientRect();
    _width = rect.width;
    _height = rect.height;
    // console.log("Target size: ", rect.width, rect.height, "Window size: ", window.innerWidth, window.innerHeight)
    // console.log("Target position: ", rect.left, rect.top, "Window position: ", window.innerWidth, window.innerHeight)
    // Check if the click is on the navCube
    mouse.x = ((event.clientX-rect.left) / (rect.width || window.innerWidth)) * 2 - 1;
    mouse.y = -((event.clientY-rect.top) / (rect.height || window.innerHeight)) * 2 + 1;

    mouseDownStartPoint.x = (event.clientX - rect.left);
    mouseDownStartPoint.y = event.clientY - rect.top;

    raycaster.setFromCamera(mouse, navCamera);
    const intersects = raycaster.intersectObject(navCube, true);

    if (intersects.length > 0) {
        isDragging = true;
        lastMousePosition.x = event.clientX;
        lastMousePosition.y = event.clientY;
    }
}
function onMouseMove(event) {
    let target = event.target;
    const rect = target.getBoundingClientRect();

    if (!isDragging) {
        // change cursor if hovering over navCube
        mouse.x = ((event.clientX - rect.left) / (_width || window.innerWidth)) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / (_height || window.innerHeight)) * 2 + 1;
        raycaster.setFromCamera(mouse, navCamera);
        const intersects = raycaster.intersectObject(navCube, true);
        if (intersects.length > 0) {
            document.querySelector('canvas').style.cursor = 'move';
        }
        else {
            document.querySelector('canvas').style.cursor = 'default';
        }
        return;
    }

    const power = 0.04;

    const deltaX = (event.clientX - rect.left) - lastMousePosition.x; // Horizontal drag
    const deltaY = (event.clientY - rect.top) - lastMousePosition.y; // Vertical drag

    // Rotate the navCube
    navCube.rotation.y -= deltaX * power; // Reverse horizontal drag -> Y-axis rotation
    navCube.rotation.x -= deltaY * power; // Reverse vertical drag -> X-axis rotation

    // Sync the main camera with the navCube
    const rotation = new THREE.Euler(navCube.rotation.x, -navCube.rotation.y, 0, 'XYZ'); // Negate only Y for camera
    mainCamera.position.setFromSphericalCoords(10, Math.PI / 2 - rotation.x, rotation.y);
    mainCamera.lookAt(0, myConfig.lookAtY || 0, 0);

    lastMousePosition.x = event.clientX - rect.left;
    lastMousePosition.y = event.clientY - rect.top;

    // Ensure camera updates
    mainCamera.updateProjectionMatrix();
    mainCamera.updateMatrixWorld();
}

function onMouseUp() {
    isDragging = false;

    const diffX = Math.abs(event.clientX - mouseDownStartPoint.x),
        diffY = Math.abs(event.clientY - mouseDownStartPoint.y);

    if (diffX < 5 && diffY < 5) {
        // Click event
        // Perform face click logic
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, navCamera);
        const intersects = raycaster.intersectObject(navCube, true);

        if (intersects.length > 0) {
            const faceIndex = intersects[0].face.materialIndex;

            console.log('Clicked Face Index:', faceIndex);

            // Map faceIndex to camera positions
            switch (faceIndex) {
                case 0: // Right (+X)
                    mainCamera.position.set(10,  myConfig.lookAtY || 0, 0);
                    navCube.rotation.x = 0;
                    navCube.rotation.y = -Math.PI / 2;
                    break;
                case 1: // Left (-X)
                    mainCamera.position.set(-10,  myConfig.lookAtY || 0, 0);
                    navCube.rotation.x = 0;
                    navCube.rotation.y = Math.PI / 2;
                    break;
                case 2: // Top (+Y)
                    mainCamera.position.set(0, 100, 0);
                    navCube.rotation.x = Math.PI / 2;
                    navCube.rotation.y = 0;
                    break;
                case 3: // Bottom (-Y)
                    mainCamera.position.set(0, -10, 0);
                    navCube.rotation.x = -Math.PI / 2;
                    navCube.rotation.y = 0;
                    break;
                case 4: // Front (+Z)
                    mainCamera.position.set(0,  myConfig.lookAtY || 0, 10);
                    navCube.rotation.x = 0;
                    navCube.rotation.y = 0;
                    break;
                case 5: // Back (-Z)
                    mainCamera.position.set(0, myConfig.lookAtY || 0, -10);
                    navCube.rotation.x = 0;
                    navCube.rotation.y = Math.PI;
                    break;
                default:
                    console.error('Unknown face index:', faceIndex);
            }

            // Make the camera look at the stage center
            mainCamera.lookAt(0,  myConfig.lookAtY || 0, 0);
        }
    }
}

