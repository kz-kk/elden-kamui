// 最適化された地形・樹木システム
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getAssetPath } from './environment.js';

// 最適化された樹木インスタンシングシステム
export class OptimizedTreeSystem {
    constructor(scene) {
        this.scene = scene;
        this.treeInstances = new Map(); // テンプレートごとのインスタンス管理
        this.loader = new GLTFLoader();
        this.treeTemplates = [];
        this.maxInstancesPerMesh = 10000; // 1つのInstancedMeshあたりの最大インスタンス数
    }

    // 樹木テンプレートの読み込み
    async loadTreeTemplates() {
        const treeModels = ['oak_tree_3D.glb', 'pine_tree_3D.glb'];
        const promises = treeModels.map(model => this.loadTreeModel(model));
        
        try {
            this.treeTemplates = await Promise.all(promises);
            console.log(`${this.treeTemplates.length}個の樹木テンプレートを読み込みました`);
        } catch (error) {
            console.error('樹木テンプレートの読み込みに失敗:', error);
        }
    }

    // 個別の樹木モデルを読み込み
    loadTreeModel(modelName) {
        return new Promise((resolve, reject) => {
            const path = getAssetPath(`assets/area/${modelName}`);
            this.loader.load(
                path,
                (gltf) => {
                    const template = gltf.scene;
                    
                    // マテリアルの最適化
                    template.traverse((child) => {
                        if (child.isMesh) {
                            // シャドウ設定
                            child.castShadow = true;
                            child.receiveShadow = true;
                            
                            // マテリアルの最適化
                            if (child.material) {
                                const mat = child.material.clone();
                                mat.side = THREE.FrontSide; // 裏面カリング
                                mat.shadowSide = THREE.FrontSide;
                                child.material = mat;
                            }
                        }
                    });
                    
                    resolve({
                        template,
                        modelName,
                        boundingBox: new THREE.Box3().setFromObject(template)
                    });
                },
                null,
                reject
            );
        });
    }

    // チャンク用の樹木インスタンスを作成
    createTreeInstancesForChunk(chunkX, chunkZ, chunkSize, treePositions) {
        if (this.treeTemplates.length === 0) return [];

        const chunkKey = `${chunkX}_${chunkZ}`;
        const instancedMeshes = [];

        // テンプレートごとにインスタンスを分類
        const templateGroups = new Map();
        
        treePositions.forEach(pos => {
            const templateIndex = Math.floor(Math.random() * this.treeTemplates.length);
            if (!templateGroups.has(templateIndex)) {
                templateGroups.set(templateIndex, []);
            }
            templateGroups.get(templateIndex).push(pos);
        });

        // 各テンプレートについてInstancedMeshを作成
        templateGroups.forEach((positions, templateIndex) => {
            const template = this.treeTemplates[templateIndex];
            const meshes = this.createInstancedTreeMeshes(template, positions, chunkKey);
            instancedMeshes.push(...meshes);
        });

        return instancedMeshes;
    }

    // インスタンスメッシュの作成
    createInstancedTreeMeshes(template, positions, chunkKey) {
        const meshes = [];
        const originalMeshes = [];
        
        // テンプレートからメッシュを抽出
        template.template.traverse((child) => {
            if (child.isMesh) {
                originalMeshes.push(child);
            }
        });

        originalMeshes.forEach((originalMesh) => {
            // 位置配列を分割（最大インスタンス数を超えないように）
            for (let i = 0; i < positions.length; i += this.maxInstancesPerMesh) {
                const batchPositions = positions.slice(i, i + this.maxInstancesPerMesh);
                const count = batchPositions.length;

                // InstancedMeshを作成
                const instancedMesh = new THREE.InstancedMesh(
                    originalMesh.geometry,
                    originalMesh.material,
                    count
                );

                instancedMesh.castShadow = true;
                instancedMesh.receiveShadow = true;

                // 各インスタンスの変換行列を設定
                const matrix = new THREE.Matrix4();
                const rotation = new THREE.Euler();
                const quaternion = new THREE.Quaternion();
                const scale = new THREE.Vector3();

                batchPositions.forEach((pos, idx) => {
                    // ランダムな回転
                    rotation.set(
                        (Math.random() - 0.5) * 0.1,
                        Math.random() * Math.PI * 2,
                        (Math.random() - 0.5) * 0.1
                    );
                    quaternion.setFromEuler(rotation);

                    // ランダムなスケール
                    const scaleValue = 0.8 + Math.random() * 0.4;
                    scale.set(scaleValue, scaleValue, scaleValue);

                    // 変換行列を構築
                    matrix.compose(pos.position, quaternion, scale);
                    instancedMesh.setMatrixAt(idx, matrix);
                });

                // インスタンス属性を更新
                instancedMesh.instanceMatrix.needsUpdate = true;
                
                // 境界ボックスを計算（バウンディング情報を更新）
                if (instancedMesh.computeBoundingBox) {
                    instancedMesh.computeBoundingBox();
                }
                
                meshes.push(instancedMesh);
            }
        });

        return meshes;
    }

    // チャンクの樹木を削除
    removeTreesForChunk(chunkX, chunkZ) {
        const chunkKey = `${chunkX}_${chunkZ}`;
        const instances = this.treeInstances.get(chunkKey);
        
        if (instances) {
            instances.forEach(mesh => {
                this.scene.remove(mesh);
                mesh.geometry.dispose();
                if (mesh.material.dispose) mesh.material.dispose();
            });
            this.treeInstances.delete(chunkKey);
        }
    }
}

// 最適化されたチャンクマネージャー
export class OptimizedChunkManager {
    constructor(scene, chunkSize = 300, renderDistance = 3) {
        this.scene = scene;
        this.chunkSize = chunkSize;
        this.renderDistance = renderDistance;
        this.deleteDistance = renderDistance + 2;
        this.chunks = new Map();
        this.playerChunk = { x: 0, z: 0 };
        this.treeSystem = new OptimizedTreeSystem(scene);
        
        // 地形マテリアルの準備
        this.sharedMaterial = null;
        this.noise = new SimplexNoise();
        
        // 樹木配置パラメータ
        this.minTreesPerChunk = 60;
        this.maxTreesPerChunk = 80;
    }

    // 初期化
    async initialize() {
        // テクスチャの読み込み
        const textureLoader = new THREE.TextureLoader();
        const groundTexture = await new Promise((resolve) => {
            textureLoader.load(getAssetPath('assets/area/dry_grassland.png'), resolve);
        });
        
        groundTexture.wrapS = THREE.RepeatWrapping;
        groundTexture.wrapT = THREE.RepeatWrapping;
        groundTexture.repeat.set(30, 30);
        
        this.sharedMaterial = new THREE.MeshStandardMaterial({
            map: groundTexture,
            roughness: 0.85,
            metalness: 0.05,
            color: new THREE.Color(0xAAAAAA),
            side: THREE.FrontSide
        });

        // 樹木テンプレートの読み込み
        await this.treeSystem.loadTreeTemplates();
    }

    // プレイヤー位置の更新とチャンク管理
    updatePlayerPosition(worldX, worldZ) {
        const newChunk = this.getChunkCoords(worldX, worldZ);
        
        if (newChunk.x !== this.playerChunk.x || newChunk.z !== this.playerChunk.z) {
            this.playerChunk = newChunk;
            this.updateChunks();
        }
    }

    // チャンクの更新（視錐台カリング対応）
    updateChunks(camera = null) {
        const visibleChunks = new Set();
        
        // カメラの視錐台を取得
        let frustum = null;
        if (camera) {
            frustum = new THREE.Frustum();
            const matrix = new THREE.Matrix4().multiplyMatrices(
                camera.projectionMatrix,
                camera.matrixWorldInverse
            );
            frustum.setFromProjectionMatrix(matrix);
        }
        
        // 必要なチャンクを特定
        for (let dx = -this.renderDistance; dx <= this.renderDistance; dx++) {
            for (let dz = -this.renderDistance; dz <= this.renderDistance; dz++) {
                const chunkX = this.playerChunk.x + dx;
                const chunkZ = this.playerChunk.z + dz;
                const key = `${chunkX}_${chunkZ}`;
                
                // 視錐台カリング
                if (frustum) {
                    const chunkCenter = new THREE.Vector3(
                        chunkX * this.chunkSize + this.chunkSize / 2,
                        0,
                        chunkZ * this.chunkSize + this.chunkSize / 2
                    );
                    const chunkRadius = this.chunkSize * 0.7; // 対角線の長さの約半分
                    
                    if (!frustum.intersectsSphere(new THREE.Sphere(chunkCenter, chunkRadius))) {
                        continue; // 視錐台外のチャンクはスキップ
                    }
                }
                
                visibleChunks.add(key);
                
                if (!this.chunks.has(key)) {
                    this.createChunk(chunkX, chunkZ);
                }
            }
        }
        
        // 不要なチャンクを削除
        for (const [key, chunk] of this.chunks) {
            if (!visibleChunks.has(key)) {
                const [x, z] = key.split('_').map(Number);
                const dx = Math.abs(x - this.playerChunk.x);
                const dz = Math.abs(z - this.playerChunk.z);
                
                if (dx > this.deleteDistance || dz > this.deleteDistance) {
                    this.removeChunk(key);
                }
            }
        }
    }

    // チャンクの作成
    createChunk(chunkX, chunkZ) {
        const key = `${chunkX}_${chunkZ}`;
        
        // 地形メッシュの作成
        const terrainMesh = this.createTerrainMesh(chunkX, chunkZ);
        
        // チャンクグループの作成
        const chunkGroup = new THREE.Group();
        chunkGroup.add(terrainMesh);
        
        // 樹木の配置
        const treePositions = this.generateTreePositions(chunkX, chunkZ);
        const treeMeshes = this.treeSystem.createTreeInstancesForChunk(
            chunkX, chunkZ, this.chunkSize, treePositions
        );
        
        treeMeshes.forEach(mesh => {
            chunkGroup.add(mesh);
        });
        
        // チャンクをシーンに追加
        this.scene.add(chunkGroup);
        this.chunks.set(key, {
            group: chunkGroup,
            trees: treeMeshes,
            terrain: terrainMesh
        });
    }

    // 地形メッシュの作成
    createTerrainMesh(chunkX, chunkZ) {
        const segments = 64; // セグメント数を減らしてパフォーマンス向上
        const geometry = new THREE.PlaneGeometry(
            this.chunkSize,
            this.chunkSize,
            segments,
            segments
        );
        
        const vertices = geometry.attributes.position.array;
        const worldOffsetX = chunkX * this.chunkSize;
        const worldOffsetZ = chunkZ * this.chunkSize;
        
        // 頂点の高さを設定
        for (let i = 0; i < vertices.length; i += 3) {
            const localX = vertices[i];
            const localZ = vertices[i + 1];
            
            const worldX = worldOffsetX + this.chunkSize / 2 + localX;
            const worldZ = worldOffsetZ + this.chunkSize / 2 - localZ;
            
            const height = this.getHeightAtPosition(worldX, worldZ);
            vertices[i + 2] = height;
        }
        
        geometry.computeVertexNormals();
        
        const mesh = new THREE.Mesh(geometry, this.sharedMaterial);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(
            worldOffsetX + this.chunkSize / 2,
            -5.0,
            worldOffsetZ + this.chunkSize / 2
        );
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        
        return mesh;
    }

    // 樹木位置の生成
    generateTreePositions(chunkX, chunkZ) {
        const positions = [];
        const worldOffsetX = chunkX * this.chunkSize;
        const worldOffsetZ = chunkZ * this.chunkSize;
        
        const treeCount = Math.floor(
            this.minTreesPerChunk + Math.random() * 
            (this.maxTreesPerChunk - this.minTreesPerChunk)
        );
        
        for (let i = 0; i < treeCount; i++) {
            const x = worldOffsetX + Math.random() * this.chunkSize;
            const z = worldOffsetZ + Math.random() * this.chunkSize;
            const y = -5.0 + this.getHeightAtPosition(x, z);
            
            positions.push({
                position: new THREE.Vector3(x, y, z)
            });
        }
        
        return positions;
    }

    // 地形の高さを取得
    getHeightAtPosition(worldX, worldZ) {
        let height = 0;
        
        // 複数のオクターブでノイズを合成
        height += this.noise.noise2D(worldX * 0.003, worldZ * 0.003) * 8.0;
        height += this.noise.noise2D(worldX * 0.01, worldZ * 0.01) * 3.0;
        height += this.noise.noise2D(worldX * 0.05, worldZ * 0.05) * 0.5;
        
        return height;
    }

    // チャンク座標の取得
    getChunkCoords(worldX, worldZ) {
        return {
            x: Math.floor(worldX / this.chunkSize),
            z: Math.floor(worldZ / this.chunkSize)
        };
    }

    // チャンクの削除
    removeChunk(key) {
        const chunk = this.chunks.get(key);
        if (chunk) {
            // グループ全体を削除
            this.scene.remove(chunk.group);
            
            // メモリ解放
            if (chunk.terrain) {
                chunk.terrain.geometry.dispose();
            }
            
            this.chunks.delete(key);
        }
    }
}

// SimplexNoiseクラス（既存のものと同じ）
class SimplexNoise {
    constructor(seed = Math.random()) {
        this.seed = seed;
        this.permutation = [];
        
        for (let i = 0; i < 256; i++) {
            this.permutation[i] = Math.floor((this.seed * 9301 + i * 49297) % 233280) % 256;
        }
        
        for (let i = 0; i < 256; i++) {
            this.permutation[256 + i] = this.permutation[i];
        }
    }
    
    grad(hash, x, y) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
    
    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }
    
    lerp(a, b, t) {
        return (1 - t) * a + t * b;
    }
    
    noise2D(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        
        x -= Math.floor(x);
        y -= Math.floor(y);
        
        const u = this.fade(x);
        const v = this.fade(y);
        
        const A = this.permutation[X] + Y;
        const AA = this.permutation[A];
        const AB = this.permutation[A + 1];
        const B = this.permutation[X + 1] + Y;
        const BA = this.permutation[B];
        const BB = this.permutation[B + 1];
        
        return this.lerp(
            this.lerp(this.grad(this.permutation[AA], x, y),
                     this.grad(this.permutation[BA], x - 1, y), u),
            this.lerp(this.grad(this.permutation[AB], x, y - 1),
                     this.grad(this.permutation[BB], x - 1, y - 1), u), v);
    }
}