import * as THREE from 'three'

const maxBlobSize = 1

export class SelectedZoneHelper {
    constructor(objects, color = 0x00ffcc, radius = 2.0, threshold = 1.0, size = 20, offsetY = 0) {
        this.objects = objects
        this.radius = radius
        this.threshold = threshold
        this.color = color
        this.size = size
        this.offsetY = offsetY // Offset for the Y position of the mesh

        this.blobSizes = objects.map(obj => {
            const bbox = new THREE.Box3().setFromObject(obj)
            const size = bbox.getSize(new THREE.Vector3())
            return Math.min(maxBlobSize, Math.max(size.x, size.z) / 2 * radius)
        })


        this.material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: {
                uPoints: { value: new Array(100).fill(new THREE.Vector2()) },
                uRadii: { value: this.blobSizes.slice(0, 100) },
                uCount: { value: objects.length },
                uThreshold: { value: this.threshold },
                uColor: { value: new THREE.Color(color) },
            },
            vertexShader: `
                varying vec2 vWorldPos;

                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPos = worldPosition.xz;
                    gl_Position = projectionMatrix * viewMatrix * worldPosition;
                }
            `,
            fragmentShader: `
                uniform vec2 uPoints[100];
                uniform float uRadii[100];
                uniform int uCount;
                uniform float uThreshold;
                uniform vec3 uColor;

                varying vec2 vWorldPos;

                void main() {
                    float influence = 0.0;
                    for (int i = 0; i < 100; i++) {
                        if (i >= uCount) break;
                        vec2 delta = vWorldPos - uPoints[i];
                        float dist = length(delta);
                        influence += uRadii[i] * uRadii[i] / (dist * dist + 0.01);
                    }

                    float alpha = smoothstep(uThreshold - 0.2, uThreshold + 0.2, influence);
                    if (alpha < 0.01) discard;

                    gl_FragColor = vec4(uColor, alpha);
                }
            `
        });

        const geometry = new THREE.PlaneGeometry(size, size, 1, 1);
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.renderOrder = 999; // Optional: ensures above floor
        this.mesh.position.y = this.offsetY; // Set the Y position offset

        this.update(); // Initial update to set the points
    }

    pointSize(index) {
        return this.blobSizes[index] || this.radius;
    }

    update() {
        const updatedPoints = this.objects.map(obj => {
            const bbox = new THREE.Box3().setFromObject(obj);
            const center = bbox.getCenter(new THREE.Vector3());
            return new THREE.Vector2(center.x, center.z);
        });

        for (let i = 0; i < 100; i++) {
            this.material.uniforms.uPoints.value[i] = updatedPoints[i] || new THREE.Vector2(9999, 9999);
            this.material.uniforms.uRadii.value[i] = this.pointSize(i);
        }

        this.material.uniforms.uCount.value = this.objects.length;
        this.material.uniforms.uPoints.needsUpdate = true;
        this.material.uniforms.uRadii.needsUpdate = true;

        this.material.uniforms.uColor.value = new THREE.Color(this.color);
    }
}
