import {Box} from "../objects/Box";
import {GLTFModel} from "../utils/ModelUtils";
import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader";

export class ObjectManager {
    constructor(stage, scene, config) {
        this.stage = stage
        this.scene = scene
        this.config = config
        this.children = []
        this.boxes = []
        this.models = []
        this.glueId = 0

        this.loader = new GLTFLoader();
    }

    getByUniqueId(uniqueId) {
        const found = this.boxes.find(box => box.uniqueId === uniqueId);
        if (found && found.name === 'Virtual Composite') {
            console.log('[ObjectManager] getByUniqueId returning Virtual Composite:', {
                uniqueId: found.uniqueId,
                name: found.name,
                hasMeta: !!found.meta,
                metaKeys: found.meta ? Object.keys(found.meta) : 'none'
            });
        }
        return found;
    }

    removeByName(name) {
        this.scene.children = this.scene.children.filter(child => child.name !== name);
    }

    removeByType(type) {
        this.scene.children = this.scene.children.filter(child => child.type !== type);
    }

    add(item) {
        this.scene.add(item);
    }

    remove(item, byType) {
        if (item) {
            if (item.type === 'box') {
                this.removeBox(item);
            }
            for (let i = 0; i < this.children.length; i++) {
                if (this.children[i].uniqueId === item.uniqueId) {
                    this.children.splice(i, 1);
                    break
                }
            }
            if (item.attachedModel) {
                this.remove(item.attachedModel)
            }

            // drop stacked items to the floor recursively
            if (item.stackedItems) {
                let parent = item
                item.stackedItems.forEach(stackedItem => {
                    this.stage.collisionHandler.dropGap(stackedItem, parent);
                    parent = stackedItem
                });
            }

            if (item.parent) item.parent.remove(item)
            if (item.boxId) {
                const box = this.getByUniqueId(item.boxId)
                this.scene.remove(box)
                this.removeByType('boxHelper')

                // remove from boxes array
                const index = this.boxes.indexOf(box);
                if (index > -1) {
                    this.boxes.splice(index, 1);
                }
            }
            this.scene.remove(item);
        }
        if (byType) {
            this.removeByType(byType)
        }
    }

    addBox(x, y, z, width, height, depth, rotation = 0, stackable = false, snapsToSimilar = false) {
        const box = new Box(x, y, z, width, height, depth, rotation, stackable, snapsToSimilar);
        this.scene.add(box);
        this.children.push(box);
        this.boxes.push(box);

        box.visible = false;

        return box
    }

    removeBox(box) {
        const index = this.children.indexOf(box);
        const boxIndex = this.boxes.indexOf(box);
        if (index > -1) {
            this.scene.remove(box);
            this.children.splice(index, 1);
        }
        if (boxIndex > -1) {
            this.boxes.splice(boxIndex, 1);
        }
    }

    async loadGLTFModel(url, { onClick=null }, { stackable = false, snapsToSimilar = false, customData = null }, onPercent = () => {}) {
        var model = await GLTFModel(url, {}, onPercent)
        model.glueId = ++this.glueId
        this.scene.add(model)
        const sizeBox = new THREE.Box3().setFromObject(model, true);

        const box = this.addBox(model.position.x, model.position.y, model.position.z, sizeBox.max.x - sizeBox.min.x, sizeBox.max.y - sizeBox.min.y, sizeBox.max.z - sizeBox.min.z, 0, stackable, snapsToSimilar)
        box.uniqueId = customData?.uniqueId || model.glueId
        box.name = customData?.name || "Model"
        box.description = customData?.description || "A Loaded GLTF Model"
        box.attachedModel = model

        // make the model follow the box position on every frame
        box.addEventListener('change', () => {
            model.position.set(box.position.x, box.position.y - (sizeBox.max.y - sizeBox.min.y) / 2, box.position.z);
            model.rotation.set(box.rotation.x, box.rotation.y, box.rotation.z);
        })

        model.boxId = box.uniqueId
        
        // Recursively set boxId on all children to ensure raycasting works correctly
        model.traverse((child) => {
            child.boxId = box.uniqueId;
        });
        
        box.onClickEvent = onClick

        // this.stage.controlsManager.resetDragControls(box)

        return model
    }

    // Load a composite virtual item from entry specs and expose a single draggable master box.
    // entries: Array of { url: string, position?: [x,y,z], rotation?: [rx,ry,rz] in degrees }
    async loadComposite(entries = [], { onClick = null } = {}) {
        if (!Array.isArray(entries) || entries.length === 0) return null;

        const childBoxes = [];
        const childModels = [];

        // Load all children sequentially to report progress deterministically
        for (const entry of entries) {
            const url = entry.url;
            if (!url) continue;
            // Reuse existing loader; mark as non-stackable, hidden drag boxes
            const model = await this.loadGLTFModel(url, { onClick }, { stackable: false, snapsToSimilar: false, customData: { name: entry.name || 'Composite Child' } }, () => {});
            if (!model) continue;
            const box = this.getByUniqueId(model.boxId);
            if (!box) continue;
            // mark and hide child boxes from interaction
            box.meta = { ...(box.meta || {}), isCompositeChild: true };
            box.visible = false;
            childBoxes.push(box);
            childModels.push(model);

            const p = entry.position || [0, null, 0];
            const r = entry.rotation || [0, 0, 0]; // degrees
            box.setPosition(p[0] || 0, p[1] ?? null, p[2] || 0);
            box.rotation.x = (r[0] || 0) * Math.PI / 180;
            box.setRotation(r[1] || 0);
            box.rotation.z = (r[2] || 0) * Math.PI / 180;
            box.dispatchEvent({ type: 'change' });
        }

        // Create group that carries actual rendered children
        const group = new THREE.Group();
        this.scene.add(group);
        // Use attach to preserve current world transforms of children
        childModels.forEach(m => group.attach(m));

        // Compute union bounds from the group directly (includes all descendants)
        const union = new THREE.Box3().setFromObject(group);
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        union.getCenter(center);
        union.getSize(size);
        // Guard against degenerate sizes
        size.set(Math.max(size.x, 0.001), Math.max(size.y, 0.001), Math.max(size.z, 0.001));

        // Create master box as the single draggable handle (floor-aligned)
        const height = Math.max(size.y, 0.001);
        const masterY = center.y - height / 2; // bottom should align with union.min.y
        const master = this.addBox(center.x, masterY, center.z, Math.max(size.x, 0.001), height, Math.max(size.z, 0.001), 0, false, false);
        // Generate uniqueId for the master box so splot can find it
        master.uniqueId = Math.random().toString(36).substring(7);
        master.name = 'Virtual Composite';
        master.meta = { isCompositeMaster: true, childBoxes, group };
        master.onClickEvent = onClick;
        
        console.log('[ObjectManager] Created composite master with meta:', master.meta);
        console.log('[ObjectManager] Master box uniqueId:', master.uniqueId, 'name:', master.name);
        
        // Add moveStackedItems method for composite master compatibility
        master.moveStackedItems = function() {
            // Update the group position based on master position
            if (group && groupOffset) {
                group.position.copy(this.position).sub(groupOffset);
                group.rotation.set(this.rotation.x, this.rotation.y, this.rotation.z);
            }
            // Also move any regularly stacked items (if any)
            if (this.stackedItems && typeof this.stackedItems.forEach === 'function') {
                this.stackedItems.forEach(item => {
                    item.position.set(
                        this.position.x + item.relativePosition.x,
                        this.position.y + item.relativePosition.y,
                        this.position.z + item.relativePosition.z
                    );
                    if (typeof item.moveStackedItems === 'function') {
                        item.moveStackedItems();
                    }
                    item.dispatchEvent({ type: 'change' });
                });
            }
        };

        // Precompute offset so models do not jump when master is created/moved.
        // We want group's world center ("center") to sit at the master's position.
        // Therefore, group.position = master.position - center
        const groupOffset = center.clone();

        // Drive group transform from master box using the offset
        master.addEventListener('change', () => {
            group.position.copy(master.position).sub(groupOffset);
            group.rotation.set(master.rotation.x, master.rotation.y, master.rotation.z);
        });
        group.traverse(ch => ch.boxId = master.uniqueId);
        // Initialize group transform so children remain where they were
        group.position.copy(master.position).sub(groupOffset);

        // Restrict drag to master boxes only (but avoid disrupting ongoing drags)
        if (this.stage?.controlsManager?.dragControls?.setObjects) {
            const dragControls = this.stage.controlsManager.dragControls;
            // Only update if not currently dragging to avoid interrupting user interaction
            if (!dragControls.enabled || !dragControls._isDragging) {
                const allowed = this.boxes.filter(b => !b.meta || !b.meta.isCompositeChild);
                dragControls.setObjects(allowed);
            }
        }

        return master;
    }

    async loadModel(contents, translation = null, rotation = null) {
        return new Promise((resolve, reject) => {
            this.loader.parse(contents, '', (gltf) => {
                gltf.scene.scale.set(this.config.modelScale || 1, this.config.modelScale || 1, this.config.modelScale || 1);
                // set type attribute, for collision detection
                gltf.scene.traverse((child) => {
                    if (child.isMesh) {
                        child.type = 'model';
                    }
                });
                gltf.scene.glueId = ++this.glueId
                this.scene.add(gltf.scene);
                this.models.push(gltf.scene);
                if (translation) {
                    gltf.scene.position.set(translation.x, translation.y, translation.z);
                }
                if (rotation) {
                    gltf.scene.rotation.set(rotation.x, rotation.y, rotation.z);
                }
                resolve(gltf.scene);
            });
        });
    }

    async removeModel(model) {
        const index = this.models.indexOf(model);
        if (index > -1) {
            this.scene.remove(this.models[index]);
            this.models.splice(index, 1);
        }
    }

    setBoxModelScale(model, scale) {
        // get original position on the floor
        const sizeBox = new THREE.Box3().setFromObject(model, true);
        const originalY = sizeBox.min.y

        model.scale.set(scale, scale, scale);

        // set the model back on the floor
        sizeBox.setFromObject(model, true);
        model.position.y -= (sizeBox.min.y - originalY) * scale

        // scale the attached model
        if (model.attachedModel) {
            model.attachedModel.scale.set(scale, scale, scale);
        }
    }
}