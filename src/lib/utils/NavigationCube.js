let navScene, navCamera, navCube, mainCamera;
const navCubeSize = 50; // Cube size in pixels
import * as THREE from 'three';
const mouse = new THREE.Vector2();
let isDragging = false;

let mouseDownStartPoint = { x: 0, y: 0 };
let lastMousePosition = { x: 0, y: 0 };
const raycaster = new THREE.Raycaster();



function createFaceMaterial(color, text) {
    const size = 256; // Texture resolution
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');

    // Draw background color
    context.fillStyle = color;
    context.fillRect(0, 0, size, size);

    // Draw text
    context.fillStyle = 'white'; // Text color
    context.font = 'bold 48px Arial'; // Font size and style
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, size / 2, size / 2); // Center the text

    // Return a material with the canvas texture
    const texture = new THREE.CanvasTexture(canvas);
    return new THREE.MeshBasicMaterial({ map: texture });
}

export function initNavCube(config, mainCameraRef) {
    if (!config.navigationCube) return;

    mainCamera = mainCameraRef;

    navScene = new THREE.Scene();
    navCamera = new THREE.OrthographicCamera(
        -window.innerWidth / 2,
        window.innerWidth / 2,
        window.innerHeight / 2,
        -window.innerHeight / 2,
        0.1,
        1000
    );
    navCamera.position.z = 50;
    const navCubeGeometry = new THREE.BoxGeometry(50, 50, 50);
    const navCubeMaterials = [
        createFaceMaterial('red', 'Right'),  // +X
        createFaceMaterial('green', 'Left'), // -X
        createFaceMaterial('blue', 'Top'),   // +Y
        createFaceMaterial('#444400', 'Bottom'), // -Y
        createFaceMaterial('#008888', 'Front'), // +Z
        createFaceMaterial('magenta', 'Back') // -Z
    ];

    navCube = new THREE.Mesh(navCubeGeometry, navCubeMaterials);
    navScene.add(navCube);

// Add event listeners for dragging
    window.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return {scene: navScene, camera: navCamera};
}

// Position the Cube in the Top-Left Corner
export function updateNavCubePosition() {
    if (!navCube) {
        console.error('Error: navCube is not defined!');
        return;
    }
    if (!navCamera) {
        console.error('Error: navCamera is not defined!');
        return;
    }

    const offsetTop = 150, offsetLeft = 50; // Padding from the edges
    const cubeWidth = navCube.geometry.parameters.width * navCube.scale.x;
    const cubeHeight = navCube.geometry.parameters.height * navCube.scale.y;

    // Position the cube in the top-left corner
    navCube.position.set(
        navCamera.left + cubeWidth / 2 + offsetLeft,
        navCamera.top - cubeHeight / 2 - offsetTop,
        0
    );
}

function onMouseDown(event) {
    // Check if the click is on the navCube
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    mouseDownStartPoint.x = event.clientX;
    mouseDownStartPoint.y = event.clientY;

    raycaster.setFromCamera(mouse, navCamera);
    const intersects = raycaster.intersectObject(navCube, true);

    if (intersects.length > 0) {
        isDragging = true;
        lastMousePosition.x = event.clientX;
        lastMousePosition.y = event.clientY;
    }
}
function onMouseMove(event) {
    if (!isDragging) return;

    const deltaX = event.clientX - lastMousePosition.x; // Horizontal drag
    const deltaY = event.clientY - lastMousePosition.y; // Vertical drag

    // Rotate the navCube
    navCube.rotation.y -= deltaX * 0.01; // Reverse horizontal drag -> Y-axis rotation
    navCube.rotation.x -= deltaY * 0.01; // Reverse vertical drag -> X-axis rotation

    // Sync the main camera with the navCube
    const rotation = new THREE.Euler(navCube.rotation.x, -navCube.rotation.y, 0, 'XYZ'); // Negate only Y for camera
    mainCamera.position.setFromSphericalCoords(10, Math.PI / 2 - rotation.x, rotation.y);
    mainCamera.lookAt(0, 0, 0);

    lastMousePosition.x = event.clientX;
    lastMousePosition.y = event.clientY;

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
                    mainCamera.position.set(10, 0, 0);
                    navCube.rotation.x = 0;
                    navCube.rotation.y = -Math.PI / 2;
                    break;
                case 1: // Left (-X)
                    mainCamera.position.set(-10, 0, 0);
                    navCube.rotation.x = 0;
                    navCube.rotation.y = Math.PI / 2;
                    break;
                case 2: // Top (+Y)
                    mainCamera.position.set(0, 10, 0);
                    navCube.rotation.x = Math.PI / 2;
                    navCube.rotation.y = 0;
                    break;
                case 3: // Bottom (-Y)
                    mainCamera.position.set(0, -10, 0);
                    navCube.rotation.x = -Math.PI / 2;
                    navCube.rotation.y = 0;
                    break;
                case 4: // Front (+Z)
                    mainCamera.position.set(0, 0, 10);
                    navCube.rotation.x = 0;
                    navCube.rotation.y = 0;
                    break;
                case 5: // Back (-Z)
                    mainCamera.position.set(0, 0, -10);
                    navCube.rotation.x = 0;
                    navCube.rotation.y = Math.PI;
                    break;
                default:
                    console.error('Unknown face index:', faceIndex);
            }

            // Make the camera look at the stage center
            mainCamera.lookAt(0, 0, 0);
        }
    }

}

