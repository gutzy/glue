import * as THREE from 'three';

export class MountingPoint extends THREE.Object3D {
  constructor(position, stage) {
    super();

    // Configurable colors
    const colorNorth = new THREE.Color(1, 0, 0);  // Red
    const colorWest = new THREE.Color(0, 0, 1);   // Blue
    const colorSouth = new THREE.Color(0, 1, 0);  // Green
    const colorEast = new THREE.Color(1, 1, 0);   // Yellow
    const colorBase1 = new THREE.Color(1, 0.66, 0.5); // Pink
    const colorBase2 = new THREE.Color(0.5, 1, 1);    // Aqua

    // Define vertices for the four-sided pyramid (50% taller)
    const vertices = [
      new THREE.Vector3(-1, 0, -1),  // A
      new THREE.Vector3(1, 0, -1),   // B
      new THREE.Vector3(1, 0, 1),    // C
      new THREE.Vector3(-1, 0, 1),   // D
      new THREE.Vector3(0, 3, 0)     // E (taller)
    ];

    // Define faces with distinct colors
    const faces = [
      // Base (split diagonally)
      [0, 1, 2],  // Half Base1
      [0, 2, 3],  // Half Base2
      // Sides
      [0, 1, 4], // North face
      [1, 2, 4], // East face
      [2, 3, 4], // South face
      [3, 0, 4]  // West face
    ];

    const geometry = new THREE.BufferGeometry();

    const positions = [];
    const colors = [];

    // Add each face's vertices and color
    faces.forEach((face, i) => {
      const [a, b, c] = face;

      positions.push(...vertices[a].toArray());
      positions.push(...vertices[b].toArray());
      positions.push(...vertices[c].toArray());

      // For the base faces
      if (i < 2) {
        const baseColor = i === 0 ? colorBase1 : colorBase2;
        colors.push(baseColor.r, baseColor.g, baseColor.b);
        colors.push(baseColor.r, baseColor.g, baseColor.b);
        colors.push(baseColor.r, baseColor.g, baseColor.b);
      } else {  // For the side faces
        const sideColors = [colorNorth, colorEast, colorSouth, colorWest];
        const color = sideColors[i - 2];
        for (let j = 0; j < 3; j++) {
          colors.push(color.r, color.g, color.b);
        }
      }
    });

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });

    const pyramid = new THREE.Mesh(geometry, material);
    // set type attribute, for collision detection
    pyramid.type = 'mountingPoint';
    this.add(pyramid);

    stage.scene.add(this);
  }

  toObject() {
    return {
      position: { x: this.position.x, y: this.position.y, z: this.position.z},
      rotation: { x: this.rotation.x, y: this.rotation.y, z: this.rotation.z}
    };
  }
}
