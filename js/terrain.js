// 地形生成モジュール
import * as THREE from 'three';

// パーリンノイズクラス（シンプルな実装）
class SimplexNoise {
    constructor(seed = Math.random()) {
        this.seed = seed;
        this.permutation = [];
        
        // 256個のランダムな値を生成
        for (let i = 0; i < 256; i++) {
            this.permutation[i] = Math.floor((this.seed * 9301 + i * 49297) % 233280) % 256;
        }
        
        // 配列を倍にして繰り返しを防ぐ
        for (let i = 0; i < 256; i++) {
            this.permutation[256 + i] = this.permutation[i];
        }
    }
    
    // グラデーション関数
    grad(hash, x, y) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
    
    // 補間関数
    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }
    
    // 線形補間
    lerp(a, b, t) {
        return (1 - t) * a + t * b;
    }
    
    // 2Dノイズ生成
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

// でこぼこした地形を生成する関数（シンプル版）
export function createTerrain(width = 100, height = 100, segments = 32) {
    // PlaneGeometry を作成
    const geometry = new THREE.PlaneGeometry(width, height, segments, segments);
    
    // ノイズジェネレーターを作成
    const noise = new SimplexNoise();
    
    // 頂点の高さを調整
    const vertices = geometry.attributes.position.array;
    
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const z = vertices[i + 2];
        
        // シンプルなノイズで高さを決定
        const elevation = noise.noise2D(x * 0.05, z * 0.05) * 2.0; // 起伏を2メートルに制限
        
        // Y座標（高さ）を設定
        vertices[i + 1] = elevation;
    }
    
    // 法線を再計算
    geometry.computeVertexNormals();
    
    return geometry;
}

// 地形にテクスチャマッピングを適用する関数
export function createTerrainMaterial(textureUrl, options = {}) {
    const {
        roughness = 0.9,
        metalness = 0.0,
        color = 0x888888,
        repeatX = 15,
        repeatY = 15,
        normalMapUrl = null,
        aoMapUrl = null
    } = options;
    
    // テクスチャをロード
    const textureLoader = new THREE.TextureLoader();
    const diffuseTexture = textureLoader.load(textureUrl);
    
    // テクスチャの繰り返し設定
    diffuseTexture.wrapS = THREE.RepeatWrapping;
    diffuseTexture.wrapT = THREE.RepeatWrapping;
    diffuseTexture.repeat.set(repeatX, repeatY);
    
    // マテリアル作成
    const materialOptions = {
        map: diffuseTexture,
        roughness,
        metalness,
        color: new THREE.Color(color)
    };
    
    // 法線マップがある場合
    if (normalMapUrl) {
        const normalTexture = textureLoader.load(normalMapUrl);
        normalTexture.wrapS = THREE.RepeatWrapping;
        normalTexture.wrapT = THREE.RepeatWrapping;
        normalTexture.repeat.set(repeatX, repeatY);
        materialOptions.normalMap = normalTexture;
    }
    
    // AOマップがある場合
    if (aoMapUrl) {
        const aoTexture = textureLoader.load(aoMapUrl);
        aoTexture.wrapS = THREE.RepeatWrapping;
        aoTexture.wrapT = THREE.RepeatWrapping;
        aoTexture.repeat.set(repeatX, repeatY);
        materialOptions.aoMap = aoTexture;
    }
    
    return new THREE.MeshStandardMaterial(materialOptions);
}

// 地形メッシュを作成する統合関数
export function createTerrainMesh(textureUrl, options = {}) {
    const {
        width = 100,
        height = 100,
        segments = 64,
        position = { x: 0, y: -5.0, z: 0 }
    } = options;
    
    // 地形ジオメトリを作成
    const geometry = createTerrain(width, height, segments);
    
    // 地形マテリアルを作成
    const material = createTerrainMaterial(textureUrl, options);
    
    // メッシュを作成
    const mesh = new THREE.Mesh(geometry, material);
    
    // 地面として水平に配置
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(position.x, position.y, position.z);
    mesh.receiveShadow = true;
    mesh.castShadow = false; // 地面は影を落とさない
    
    return mesh;
}