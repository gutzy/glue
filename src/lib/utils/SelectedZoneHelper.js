import * as THREE from 'three'

const maxBlobSize = 1
const minBlobSize = 0.2 // Ensure visibility for tiny objects

export class SelectedZoneHelper {
    constructor(objects, color = 0x00ffcc, radius = 2.0, threshold = 1.0, size = 20, offsetY = 0) {
        this.objects = objects
        this.radius = radius
        this.threshold = threshold
        this.color = color
        this.size = size
        this.offsetY = offsetY // Offset for the Y position of the mesh
        this._currentOpacity = 1.0
        this._opacityAnimationFrame = null
        this._opacityAnimationStart = null
        this._opacityAnimationFrom = 1.0
        this._opacityAnimationTo = 1.0

        console.log('objects', objects)
        this.blobSizes = objects.map((obj, idx) => {
            console.log(`[ZoneHelper] Processing object ${idx}:`, obj.name, obj.type, obj.meta)
            console.log(`[ZoneHelper] Object details:`, {
                uniqueId: obj.uniqueId,
                name: obj.name,
                constructor: obj.constructor.name,
                parent: obj.parent?.name,
                hasMeta: !!obj.meta,
                metaKeys: obj.meta ? Object.keys(obj.meta) : 'none'
            })
            
            // For virtual composite objects, use the group's bounding box or fallback to the master box
            let targetObj = obj
            
            // If we receive an object with no uniqueId/name/meta, this is likely a placeholder
            // OR if we detect any sign this might be related to virtual items, search globally
            const needsVirtualSearch = (!obj.uniqueId && !obj.name && !obj.meta) ||
                                      (obj.name === 'Virtual Composite') ||
                                      (obj.meta && obj.meta.isVirtual) ||
                                      (obj.meta && obj.meta.isCompositeMaster)
            
            if (needsVirtualSearch) {
                console.log('[ZoneHelper] Received placeholder object, searching for Virtual Composite masters...')
                
                // Search through all objects in the first object's scene (which should be available through the objects array)
                if (this.objects && this.objects.length > 0) {
                    let scene = null
                    
                    // Find the scene by traversing up from any object we have
                    for (const testObj of this.objects) {
                        let current = testObj
                        while (current && current.parent) {
                            current = current.parent
                            if (current.type === 'Scene' || current.isScene) {
                                scene = current
                                break
                            }
                        }
                        if (scene) break
                    }
                    
                    if (scene) {
                        const allObjects = []
                        scene.traverse(child => {
                            if (child.name === 'Virtual Composite' || (child.meta && child.meta.isCompositeMaster)) {
                                allObjects.push(child)
                            }
                        })
                        
                        console.log('[ZoneHelper] Found Virtual Composite objects:', allObjects.length)
                        if (allObjects.length > 0) {
                            // Use the most recent Virtual Composite as the target
                            const composite = allObjects[allObjects.length - 1] 
                            console.log('[ZoneHelper] Using Virtual Composite:', composite.name, composite.uniqueId)
                            
                            if (composite.meta && composite.meta.group) {
                                targetObj = composite.meta.group
                                console.log('[ZoneHelper] Using group from found composite')
                            } else {
                                targetObj = composite
                                console.log('[ZoneHelper] Using composite master itself')
                            }
                        }
                    } else {
                        console.log('[ZoneHelper] Could not find scene for search')
                    }
                }
            }
            
            // Check if this looks like a composite master by searching for associated groups
            // This is more robust than relying on meta which might get lost
            const isLikelyComposite = obj.name === 'Virtual Composite' || 
                                     (obj.meta && obj.meta.isCompositeMaster) ||
                                     obj.name?.includes('Composite')
            
            if (isLikelyComposite) {
                console.log('[ZoneHelper] Detected likely composite master, looking for group...')
                
                // First try to get group from meta (stored during creation)
                if (obj.meta && obj.meta.group) {
                    console.log('[ZoneHelper] Using group from meta:', obj.meta.group)
                    targetObj = obj.meta.group
                } else {
                    // Fallback: Look for the associated group in the scene
                    const scene = obj.parent
                    console.log('[ZoneHelper] Searching scene for group, scene children:', scene?.children?.length)
                    
                    if (scene) {
                        const group = scene.children.find(child => {
                            const isGroup = child.type === 'Group'
                            const hasMatchingChild = child.children && child.children.some(c => c.boxId === obj.uniqueId)
                            console.log(`[ZoneHelper] Checking child:`, child.type, isGroup, hasMatchingChild)
                            return isGroup && hasMatchingChild
                        })
                        
                        if (group && group.children.length > 0) {
                            targetObj = group
                            console.log('[ZoneHelper] Using group from scene search:', group)
                        } else {
                            console.log('[ZoneHelper] No suitable group found in scene')
                        }
                    }
                }
            }
            
            const bbox = new THREE.Box3().setFromObject(targetObj)
            const size = bbox.getSize(new THREE.Vector3())
            
            // Ensure we have reasonable dimensions
            if (size.x === 0 && size.y === 0 && size.z === 0) {
                console.warn('Object has zero size, using fallback', obj)
                return minBlobSize
            }
            
            const computed = Math.max(size.x, size.z) / 2 * radius
            return Math.max(minBlobSize, Math.min(maxBlobSize, computed))
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
                uAlpha: { value: this._currentOpacity },
            },
            blending: THREE.NormalBlending,
            side: THREE.DoubleSide,
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
                uniform float uAlpha;

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
                    if (alpha * uAlpha < 0.01) discard;

                    gl_FragColor = vec4(uColor, alpha * uAlpha);
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
            // For virtual composite objects, use the group's center or fallback to the master box
            let targetObj = obj
            
            // If this is still a placeholder object OR shows signs of being virtual, search for the current Virtual Composite
            const needsVirtualSearch = (!obj.uniqueId && !obj.name && !obj.meta) ||
                                      (obj.name === 'Virtual Composite') ||
                                      (obj.meta && obj.meta.isVirtual) ||
                                      (obj.meta && obj.meta.isCompositeMaster)
            
            if (needsVirtualSearch) {
                // Search through all objects to find scene and Virtual Composite
                if (this.objects && this.objects.length > 0) {
                    let scene = null
                    
                    // Find the scene by traversing up from any object we have
                    for (const testObj of this.objects) {
                        let current = testObj
                        while (current && current.parent) {
                            current = current.parent
                            if (current.type === 'Scene' || current.isScene) {
                                scene = current
                                break
                            }
                        }
                        if (scene) break
                    }
                    
                    if (scene) {
                        const allObjects = []
                        scene.traverse(child => {
                            if (child.name === 'Virtual Composite' || (child.meta && child.meta.isCompositeMaster)) {
                                allObjects.push(child)
                            }
                        })
                        
                        if (allObjects.length > 0) {
                            // Use the most recent Virtual Composite as the target
                            const composite = allObjects[allObjects.length - 1] 
                            
                            if (composite.meta && composite.meta.group) {
                                targetObj = composite.meta.group
                            } else {
                                targetObj = composite
                            }
                        }
                    }
                }
            }
            
            // Check if this looks like a composite master (more robust than relying on meta)
            const isLikelyComposite = obj.name === 'Virtual Composite' || 
                                     (obj.meta && obj.meta.isCompositeMaster) ||
                                     obj.name?.includes('Composite')
            
            if (isLikelyComposite) {
                // First try to get group from meta (stored during creation)
                if (obj.meta && obj.meta.group) {
                    targetObj = obj.meta.group
                } else {
                    // Fallback: Look for the associated group in the scene
                    const scene = obj.parent
                    if (scene) {
                        const group = scene.children.find(child => 
                            child.type === 'Group' && 
                            child.children && child.children.some(c => c.boxId === obj.uniqueId)
                        )
                        if (group && group.children.length > 0) {
                            targetObj = group
                        }
                    }
                }
            }
            
            const bbox = new THREE.Box3().setFromObject(targetObj);
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

    setOpacity(opacity) {
        const clamped = Math.max(0, Math.min(1, opacity));
        this._currentOpacity = clamped;
        if (this.material && this.material.uniforms && this.material.uniforms.uAlpha) {
            this.material.uniforms.uAlpha.value = clamped;
            this.material.uniforms.uAlpha.needsUpdate = true;
        }
    }

    fadeOpacity(targetOpacity, duration = 500) {
        const clampedTarget = Math.max(0, Math.min(1, targetOpacity));
        if (Math.abs(clampedTarget - this._currentOpacity) < 0.001) {
            this.setOpacity(clampedTarget);
            return Promise.resolve();
        }
        if (this._opacityAnimationFrame) {
            cancelAnimationFrame(this._opacityAnimationFrame);
            this._opacityAnimationFrame = null;
        }
        this._opacityAnimationFrom = this._currentOpacity;
        this._opacityAnimationTo = clampedTarget;
        this._opacityAnimationStart = null;
        return new Promise(resolve => {
            const step = (timestamp) => {
                if (this._opacityAnimationStart === null) this._opacityAnimationStart = timestamp;
                const elapsed = timestamp - this._opacityAnimationStart;
                const t = duration <= 0 ? 1 : Math.min(1, elapsed / duration);
                const eased = t; // linear is fine
                const value = this._opacityAnimationFrom + (this._opacityAnimationTo - this._opacityAnimationFrom) * eased;
                this.setOpacity(value);
                if (t < 1) {
                    this._opacityAnimationFrame = requestAnimationFrame(step);
                } else {
                    this._opacityAnimationFrame = null;
                    resolve();
                }
            };
            this._opacityAnimationFrame = requestAnimationFrame(step);
        });
    }

    dispose() {
        if (this._opacityAnimationFrame) {
            cancelAnimationFrame(this._opacityAnimationFrame);
            this._opacityAnimationFrame = null;
        }
        if (this.mesh) {
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) this.mesh.material.dispose();
        }
    }
}
