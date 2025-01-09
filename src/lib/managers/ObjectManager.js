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
        return this.boxes.find(box => box.uniqueId === uniqueId);
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

    addBox(x, y, z, width, height, depth, rotation = 0, stackable = false) {
        const box = new Box(x, y, z, width, height, depth, rotation, stackable);
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

    async loadGLTFModel(url, { onClick=null }, { stackable = false, customData = null }, onPercent = () => {}) {
        var model = await GLTFModel(url, {}, onPercent)
        model.glueId = ++this.glueId
        this.scene.add(model)
        const sizeBox = new THREE.Box3().setFromObject(model, true);

        const box = this.addBox(model.position.x, model.position.y, model.position.z, sizeBox.max.x - sizeBox.min.x, sizeBox.max.y - sizeBox.min.y, sizeBox.max.z - sizeBox.min.z, 0, stackable)
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
        box.onClickEvent = onClick

        return model
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