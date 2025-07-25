// 環境関連の機能を実装するモジュール

// 依存関係のインポート
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PMREMGenerator } from 'three';

// 草を生やす関数
export function addGrass(scene, gameState) {
    // 草の数と配置範囲（メモリ最適化のため大幅に削減）
    const grassCount = 300; // 草の数をさらに削減
    const areaSize = 30;
    
    // 草の色のバリエーション（画像に色を乗算）
    const grassColors = [
        new THREE.Color(0x8B4513), // サドルブラウン
        new THREE.Color(0xA0522D), // シエナ
        new THREE.Color(0xCD853F), // ペルー
        new THREE.Color(0xD2B48C), // タン
        new THREE.Color(0xDEB887)  // バーリーウッド
    ];
    
    // 草のテクスチャを読み込む（明示的にパスを指定）
    // console.log("草のテクスチャ読み込みを開始します...");
    const textureLoader = new THREE.TextureLoader();
    
    // 明示的に指定されたパス
    const grassTexturePath = 'assets/area/grass.png';
    let grassTexture = null;
    
    // console.log(`草のテクスチャ読み込み開始: ${grassTexturePath}`);
    
    // テクスチャの読み込み
    textureLoader.load(
        grassTexturePath,
        function(texture) {
            // console.log(`テクスチャ読み込み成功: ${grassTexturePath}`);
            grassTexture = texture;
            createGrassWithTexture();
        },
        function(xhr) {
            // 進捗状況（オプション）
            if (xhr.lengthComputable) {
                const percentComplete = xhr.loaded / xhr.total * 100;
                // console.log(`テクスチャ読み込み進捗: ${Math.round(percentComplete)}%`);
            }
        },
        function(error) {
            console.error(`テクスチャ読み込み失敗: ${grassTexturePath}`, error);
            // 読み込み失敗時はフォールバックテクスチャを生成
            // console.log("フォールバックテクスチャを使用します");
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#7CFC00'; // 明るい緑
            ctx.fillRect(0, 0, 64, 64);
            grassTexture = new THREE.CanvasTexture(canvas);
            createGrassWithTexture();
        }
    );
    
    // テクスチャが読み込まれた後に草を生成する関数
    function createGrassWithTexture() {
        // console.log("草の生成を開始します。テクスチャ状態:", grassTexture ? "読み込み成功" : "読み込み失敗");
        
        // シェーダーベースの草を使用する場合
        if (gameState.useShaderGrass) {
            // 風に揺れる草のシェーダーマテリアル
            gameState.grassShaderMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    time: { value: 0 },
                    map: { value: grassTexture },
                    windStrength: { value: gameState.windStrength * 4 }, // 風の強さを調整
                    windFrequency: { value: gameState.windFrequency },
                    color: { value: new THREE.Color(1, 1, 1) } // 色の初期値
                },
                vertexShader: `
                    uniform float time;
                    uniform float windStrength;
                    uniform float windFrequency;
                    
                    varying vec2 vUv;
                    
                    void main() {
                        vUv = uv;
                        
                        // 草の先端ほど大きく揺れるように位置を調整
                        // uv.yが1に近いほど先端
                        float tipFactor = pow(uv.y, 1.0); // より強い先端効果
                        
                        // 風の効果を計算（より複雑な動き）
                        float windEffect = sin(time * windFrequency + position.x * 2.0) * windStrength;
                        // 二次的な風の効果（より自然な揺れ）
                        float secondaryWind = cos(time * windFrequency * 0.7 + position.z + position.x) * windStrength * 0.3;
                        
                        // 新しい位置を計算
                        vec3 newPosition = position;
                        
                        // X方向の揺れ（横方向）- 先端ほど大きく揺れる
                        newPosition.x += (windEffect + secondaryWind) * tipFactor;
                        
                        // Z方向の揺れ（奥行き方向）- より自然な3D効果
                        newPosition.z += secondaryWind * tipFactor * 0.8;
                        
                        // わずかなY方向の揺れ（上下方向）- 風が強いときに先端が少し持ち上がる
                        newPosition.y += abs(windEffect) * tipFactor * 0.05;
                        
                        // 射影変換
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform sampler2D map;
                    uniform vec3 color;
                    
                    varying vec2 vUv;
                    
                    void main() {
                        vec4 texColor = texture2D(map, vUv);
                        
                        // アルファテスト
                        if (texColor.a < 0.5) discard;
                        
                        // 色を適用
                        gl_FragColor = texColor * vec4(color, 1.0);
                    }
                `,
                transparent: true,
                side: THREE.DoubleSide
            });
            
            // 通常のスプライトマテリアルも用意（フォールバック用）
            const spriteMaterial = new THREE.SpriteMaterial({
                map: grassTexture,
                transparent: true,
                alphaTest: 0.1,
                depthTest: true,
                depthWrite: true
            });
            
            // 草の分布密度を上げるためのクラスタリング係数
            const clusterFactor = 0.9; // 高いほど密集する
            
            // バッチ処理のパラメータ
            const batchSize = 100;    // 一度に処理する草の数
            let processed = 0;
            
            // 草をバッチ処理で生成する関数
            function createGrassBatch() {
                if (processed >= grassCount) {
                    // console.log(`合計${processed}本の草を生成しました`);
                    return;
                }
                
                const currentBatchSize = Math.min(batchSize, grassCount - processed);
                
                // 草のインスタンスを作成
                for (let i = 0; i < currentBatchSize; i++) {
                    // ランダムなサイズを決定
                    const size = Math.random() * 1.5 + 0.3; // サイズを小さく
                    
                    // クラスタリングを考慮したランダムな位置
                    let x, z;
                    
                    // クラスタリング効果
                    if (Math.random() < clusterFactor) {
                        // 草の塊を形成
                        const clusterCenterX = Math.random() * areaSize * 2 - areaSize;
                        const clusterCenterZ = Math.random() * areaSize * 2 - areaSize;
                        const clusterRadius = 2 + Math.random() * 3; // 2〜5mのクラスタ半径
                        
                        // クラスタ内のランダム位置
                        const angle = Math.random() * Math.PI * 2;
                        const dist = Math.random() * clusterRadius;
                        x = clusterCenterX + Math.cos(angle) * dist;
                        z = clusterCenterZ + Math.sin(angle) * dist;
                    } else {
                        // 完全にランダムな位置
                        x = Math.random() * areaSize * 2 - areaSize;
                        z = Math.random() * areaSize * 2 - areaSize;
                    }
                    
                    // ランダムな色を選択
                    const colorIndex = Math.floor(Math.random() * grassColors.length);
                    const color = grassColors[colorIndex];
                    
                    // 色のランダム変動
                    const colorVariation = 0.1; // 色のブレ幅
                    const r = Math.max(0, Math.min(1, color.r + (Math.random() - 0.5) * colorVariation));
                    const g = Math.max(0, Math.min(1, color.g + (Math.random() - 0.5) * colorVariation));
                    const b = Math.max(0, Math.min(1, color.b + (Math.random() - 0.5) * colorVariation));
                    const variedColor = new THREE.Color(r, g, b);
                    
                    if (gameState.useShaderGrass) {
                        // シェーダーベースの草を作成
                        // 草の形状を定義（平面）
                        const grassGeometry = new THREE.PlaneGeometry(1, 1);
                        
                        // マテリアルをクローンして色を適用
                        const material = gameState.grassShaderMaterial.clone();
                        material.uniforms.map.value = grassTexture;
                        material.uniforms.windPhase = { value: Math.random() * Math.PI * 2 }; // ランダムな位相
                        material.uniforms.color = { value: variedColor };
                        
                        // メッシュを作成
                        const grassMesh = new THREE.Mesh(grassGeometry, material);
                        
                        // 位置を設定
                        grassMesh.position.set(x, -4.9, z);
                        
                        // サイズを設定
                        grassMesh.scale.set(size * 0.5, size * (0.8 + Math.random() * 0.4), 1);
                        
                        // 回転を設定（Y軸周りのランダム回転）
                        grassMesh.rotation.y = Math.random() * Math.PI * 2;
                        
                        // シーンに追加
                        scene.add(grassMesh);
                        
                        // 草のメッシュを配列に保存
                        gameState.grassSprites.push(grassMesh);
                    } else {
                        // 従来のスプライトベースの草を作成
                        // 個別のマテリアルを作成（色のバリエーションのため）
                        const material = spriteMaterial.clone();
                        material.color = variedColor;
                        
                        // スプライトを作成
                        const sprite = new THREE.Sprite(material);
                        
                        // スプライトの位置設定
                        sprite.position.set(x, -4.9, z); // 地面の高さに合わせて調整（-5.0より少し上）
                        
                        // スプライトのサイズ設定（ランダム）
                        sprite.scale.set(size, size * (0.8 + Math.random() * 0.4), 1);
                        
                        // ランダムな回転（Y軸周りのみ）
                        sprite.rotation.y = Math.random() * Math.PI * 2;
                        
                        // 風のアニメーション用のパラメータを追加
                        sprite.userData = {
                            originalPosition: new THREE.Vector3(x, -4.9, z),
                            originalScale: new THREE.Vector2(sprite.scale.x, sprite.scale.y),
                            windPhase: Math.random() * Math.PI * 2, // ランダムな位相
                            windAmplitude: 0.05 + Math.random() * 0.1 // ランダムな揺れ幅
                        };
                        
                        // シーンに追加
                        scene.add(sprite);
                        
                        // 草のスプライトを配列に保存
                        gameState.grassSprites.push(sprite);
                    }
                }
                
                processed += currentBatchSize;
                
                // 次のバッチをスケジュール（非同期処理でUIをブロックしない）
                setTimeout(createGrassBatch, 0);
            }
            
            // 草の生成開始
            createGrassBatch();
            
            // console.log(`${grassCount}本の草の生成を開始しました...`);
        } else {
            // 従来のスプライトベースの草を使用する場合（既存のコード）
            // スプライト用のマテリアル（共通設定）
            const spriteMaterial = new THREE.SpriteMaterial({
                map: grassTexture,
                transparent: true,    // 透明を有効化
                alphaTest: 0.1,       // 透明部分のカットオフ値を下げる（より細かい透明部分を表示）
                depthTest: true,      // 深度テスト有効
                depthWrite: true      // 深度書き込み有効
            });
            
            // 草の分布密度を上げるためのクラスタリング係数
            const clusterFactor = 0.7; // 高いほど密集する
            
            // バッチ処理のパラメータ
            const batchSize = 500;    // 一度に処理する草の数
            let processed = 0;
            
            // 草をバッチ処理で生成する関数
            function createGrassBatch() {
                if (processed >= grassCount) {
                    // console.log(`合計${processed}本の草を生成しました`);
                    return;
                }
                
                const currentBatchSize = Math.min(batchSize, grassCount - processed);
                
                // 草のインスタンスを作成
                for (let i = 0; i < currentBatchSize; i++) {
                    // ランダムなサイズを決定
                    const size = Math.random() * 1.5 + 0.5; // サイズはやや大きく
                    
                    // クラスタリングを考慮したランダムな位置
                    let x, z;
                    
                    // クラスタリング効果
                    if (Math.random() < clusterFactor) {
                        // 草の塊を形成
                        const clusterCenterX = Math.random() * areaSize * 2 - areaSize;
                        const clusterCenterZ = Math.random() * areaSize * 2 - areaSize;
                        const clusterRadius = 2 + Math.random() * 3; // 2〜5mのクラスタ半径
                        
                        // クラスタ内のランダム位置
                        const angle = Math.random() * Math.PI * 2;
                        const dist = Math.random() * clusterRadius;
                        x = clusterCenterX + Math.cos(angle) * dist;
                        z = clusterCenterZ + Math.sin(angle) * dist;
                    } else {
                        // 完全にランダムな位置
                        x = Math.random() * areaSize * 2 - areaSize;
                        z = Math.random() * areaSize * 2 - areaSize;
                    }
                    
                    // ランダムな色を選択
                    const colorIndex = Math.floor(Math.random() * grassColors.length);
                    const color = grassColors[colorIndex];
                    
                    // 色のランダム変動
                    const colorVariation = 0.1; // 色のブレ幅
                    const r = Math.max(0, Math.min(1, color.r + (Math.random() - 0.5) * colorVariation));
                    const g = Math.max(0, Math.min(1, color.g + (Math.random() - 0.5) * colorVariation));
                    const b = Math.max(0, Math.min(1, color.b + (Math.random() - 0.5) * colorVariation));
                    const variedColor = new THREE.Color(r, g, b);
                    
                    // 個別のマテリアルを作成（色のバリエーションのため）
                    const material = spriteMaterial.clone();
                    material.color = variedColor;
                    
                    // スプライトを作成
                    const sprite = new THREE.Sprite(material);
                    
                    // スプライトの位置設定
                    sprite.position.set(x, -4.9, z); // 地面の高さに合わせて調整（-5.0より少し上）
                    
                    // スプライトのサイズ設定（ランダム）
                    sprite.scale.set(size, size * (0.8 + Math.random() * 0.4), 1);
                    
                    // ランダムな回転（Y軸周りのみ）
                    sprite.rotation.y = Math.random() * Math.PI * 2;
                    
                    // 風のアニメーション用のパラメータを追加
                    sprite.userData = {
                        originalPosition: new THREE.Vector3(x, -4.9, z),
                        originalScale: new THREE.Vector2(sprite.scale.x, sprite.scale.y),
                        windPhase: Math.random() * Math.PI * 2, // ランダムな位相
                        windAmplitude: 0.05 + Math.random() * 0.1 // ランダムな揺れ幅
                    };
                    
                    // シーンに追加
                    scene.add(sprite);
                    
                    // 草のスプライトを配列に保存
                    gameState.grassSprites.push(sprite);
                }
                
                processed += currentBatchSize;
                
                // 次のバッチをスケジュール（非同期処理でUIをブロックしない）
                setTimeout(createGrassBatch, 0);
            }
            
            // 草の生成開始
            createGrassBatch();
            
            console.log(`${grassCount}本の草の生成を開始しました...`);
        }
    }
}

// 岩を配置する関数
export function addRocks(scene, gameState) {
    // 岩の数と配置範囲
    const rockCount = 70; // 岩の数を適度に減らす
    const areaSize = 45; // 配置範囲を広げる
    
    // console.log("岩のモデル読み込みを開始します...");
    
    // GLTFローダーを準備
    const loader = new GLTFLoader();
    
    // 岩のモデルを読み込む
    loader.load(
        'assets/area/weathered_rock.glb', // 岩のモデルパス
        function(gltf) {
            // console.log("岩のモデル読み込み成功");
            
            // 読み込んだモデルをテンプレートとして使用
            const rockTemplate = gltf.scene;
            
            // マテリアルを暗く調整する
            rockTemplate.traverse((child) => {
                if (child.isMesh) {
                    // メッシュのマテリアルを取得
                    if (child.material) {
                        // マテリアルを複製して元のマテリアルを保持
                        if (Array.isArray(child.material)) {
                            child.material = child.material.map(mat => {
                                const newMat = mat.clone();
                                // より暗めの色に調整
                                newMat.color.multiplyScalar(0.3); // 明るさを30%に低減（より暗く）
                                // 黒味を強くするために暗い色を乗算
                                newMat.color.multiply(new THREE.Color(0x333333));
                                newMat.roughness = 0.9; // より粗い表面に
                                newMat.metalness = 0.0; // 金属感を完全にゼロに
                                return newMat;
                            });
                        } else {
                            const newMat = child.material.clone();
                            // より暗めの色に調整
                            newMat.color.multiplyScalar(0.3); // 明るさを30%に低減（より暗く）
                            // 黒味を強くするために暗い色を乗算
                            newMat.color.multiply(new THREE.Color(0x333333));
                            newMat.roughness = 0.9; // より粗い表面に
                            newMat.metalness = 0.0; // 金属感を完全にゼロに
                            child.material = newMat;
                        }
                    }
                    
                    // 影の設定
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            // バッチ処理のパラメータ
            const batchSize = 15;
            let processed = 0;
            
            // 岩をバッチ処理で生成する関数
            function createRockBatch() {
                if (processed >= rockCount) {
                    // console.log(`合計${processed}個の岩を配置しました`);
                    return;
                }
                
                const currentBatchSize = Math.min(batchSize, rockCount - processed);
                
                // クラスタリングのパラメータ
                const clusterCount = 12; // クラスタ数を増加（8→12）
                let clusterCenters = [];
                
                // クラスタの中心点を事前に生成
                if (processed === 0) {
                    for (let i = 0; i < clusterCount; i++) {
                        clusterCenters.push({
                            x: Math.random() * areaSize * 2 - areaSize,
                            z: Math.random() * areaSize * 2 - areaSize
                        });
                    }
                }
                
                // 岩のインスタンスを作成
                for (let i = 0; i < currentBatchSize; i++) {
                    // 岩のコピーを作成
                    const rock = rockTemplate.clone();
                    
                    // 岩のサイズをより小さくする
                    let sizeScale;
                    // 10%の確率で大きな岩を生成
                    if (Math.random() < 0.1) {
                        sizeScale = 4.0 + Math.random() * 2.0; // 4.0〜6.0の大型岩
                        // console.log(`大型岩を生成: サイズ=${sizeScale.toFixed(2)}`);
                        // console.log(`大型岩を生成: サイズ=${sizeScale.toFixed(2)}`);
                    } else {
                        sizeScale = 1.5 + Math.random() * 2.0; // 1.5〜3.5の通常岩
                    }
                    rock.scale.set(sizeScale, sizeScale, sizeScale);
                    
                    // ランダムな位置を決定
                    let x, z;
                    
                    // クラスタリング（75%の確率でクラスタ内に配置）
                    if (Math.random() < 0.75 && clusterCenters.length > 0) {
                        // クラスタからランダムに選択
                        const clusterIndex = Math.floor(Math.random() * clusterCenters.length);
                        const cluster = clusterCenters[clusterIndex];
                        
                        if (cluster) {
                            const radius = 4 + Math.random() * 6; // クラスタ内の分散（4〜10m）- より広く
                            const angle = Math.random() * Math.PI * 2;
                            const distance = Math.random() * radius;
                            
                            x = cluster.x + Math.cos(angle) * distance;
                            z = cluster.z + Math.sin(angle) * distance;
                        } else {
                            // クラスタが見つからない場合はランダムな位置
                            x = Math.random() * areaSize * 2 - areaSize;
                            z = Math.random() * areaSize * 2 - areaSize;
                        }
                    } else {
                        // 完全にランダムな位置
                        x = Math.random() * areaSize * 2 - areaSize;
                        z = Math.random() * areaSize * 2 - areaSize;
                    }
                    
                    // 地面との関係を調整（サイズに応じて一部埋める）
                    const embeddedDepth = 0.1 + Math.random() * 0.5; // 埋め込み率（10%〜60%）に拡大
                    const adjustedHeight = sizeScale * embeddedDepth; // サイズに比例して埋める
                    const y = -5.0 - adjustedHeight + (Math.random() * 0.1); // 地面の高さに合わせて調整
                    
                    // 位置を設定
                    rock.position.set(x, y, z);
                    
                    // ランダムな回転を与える
                    rock.rotation.y = Math.random() * Math.PI * 2;
                    // わずかに傾ける（より自然な配置に見せる）
                    rock.rotation.x = (Math.random() - 0.5) * 0.3; // 傾きを強く
                    rock.rotation.z = (Math.random() - 0.5) * 0.3;
                    
                    // シーンに追加
                    scene.add(rock);
                    
                    // 衝突判定用に岩の情報を保存
                    gameState.rocks.push({
                        object: rock,
                        position: new THREE.Vector3(x, y, z),
                        scale: sizeScale,
                        collisionRadius: gameState.rockCollisionRadius * sizeScale * 0.7 // サイズに応じた衝突半径（見た目より少し小さめに）
                    });
                }
                
                processed += currentBatchSize;
                
                // 次のバッチをスケジュール
                setTimeout(createRockBatch, 0);
            }
            
            // 岩の生成開始
            createRockBatch();
            
            // console.log(`${rockCount}個の岩の配置を開始しました...`);
        },
        function(xhr) {
            // 進捗状況（オプション）
            if (xhr.lengthComputable) {
                const percentComplete = xhr.loaded / xhr.total * 100;
                // console.log(`岩のモデル読み込み進捗: ${Math.round(percentComplete)}%`);
            }
        },
        function(error) {
            console.error("岩のモデル読み込み失敗:", error);
            // モデルのパスが間違っている可能性があるため別のパスも試す
            // console.log("別のパスで岩のモデルの読み込みを試みます...");
            loader.load(
                'assets/rocks/weathered_rock.glb', // 代替パス
                function(gltf) {
                    // console.log("代替パスから岩のモデル読み込み成功");
                    // 読み込んだモデルをテンプレートとして使用
                    const rockTemplate = gltf.scene;
                    
                    // マテリアルを暗く調整する
                    rockTemplate.traverse((child) => {
                        if (child.isMesh) {
                            // メッシュのマテリアルを取得
                            if (child.material) {
                                // マテリアルを複製して元のマテリアルを保持
                                if (Array.isArray(child.material)) {
                                    child.material = child.material.map(mat => {
                                        const newMat = mat.clone();
                                        // より暗めの色に調整
                                        newMat.color.multiplyScalar(0.3); // 明るさを30%に低減（より暗く）
                                        // 黒味を強くするために暗い色を乗算
                                        newMat.color.multiply(new THREE.Color(0x333333));
                                        newMat.roughness = 0.9; // より粗い表面に
                                        newMat.metalness = 0.0; // 金属感を完全にゼロに
                                        return newMat;
                                    });
                                } else {
                                    const newMat = child.material.clone();
                                    // より暗めの色に調整
                                    newMat.color.multiplyScalar(0.3); // 明るさを30%に低減（より暗く）
                                    // 黒味を強くするために暗い色を乗算
                                    newMat.color.multiply(new THREE.Color(0x333333));
                                    newMat.roughness = 0.9; // より粗い表面に
                                    newMat.metalness = 0.0; // 金属感を完全にゼロに
                                    child.material = newMat;
                                }
                            }
                            
                            // 影の設定
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                    
                    // バッチ処理のパラメータ
                    const batchSize = 15;
                    let processed = 0;
                    
                    // 岩をバッチ処理で生成する関数
                    function createRockBatch() {
                        if (processed >= rockCount) {
                            // console.log(`合計${processed}個の岩を配置しました`);
                            return;
                        }
                        
                        const currentBatchSize = Math.min(batchSize, rockCount - processed);
                        
                        // クラスタリングのパラメータ
                        const clusterCount = 12; // クラスタ数を増加（8→12）
                        let clusterCenters = [];
                        
                        // クラスタの中心点を事前に生成
                        if (processed === 0) {
                            for (let i = 0; i < clusterCount; i++) {
                                clusterCenters.push({
                                    x: Math.random() * areaSize * 2 - areaSize,
                                    z: Math.random() * areaSize * 2 - areaSize
                                });
                            }
                        }
                        
                        // 岩のインスタンスを作成
                        for (let i = 0; i < currentBatchSize; i++) {
                            // 岩のコピーを作成
                            const rock = rockTemplate.clone();
                            
                            // 岩のサイズをより小さくする
                            let sizeScale;
                            // 10%の確率で大きな岩を生成
                            if (Math.random() < 0.1) {
                                sizeScale = 4.0 + Math.random() * 2.0; // 4.0〜6.0の大型岩
                                console.log(`大型岩を生成: サイズ=${sizeScale.toFixed(2)}`);
                            } else {
                                sizeScale = 1.5 + Math.random() * 2.0; // 1.5〜3.5の通常岩
                            }
                            rock.scale.set(sizeScale, sizeScale, sizeScale);
                            
                            // ランダムな位置を決定
                            let x, z;
                            
                            // クラスタリング（75%の確率でクラスタ内に配置）
                            if (Math.random() < 0.75 && clusterCenters.length > 0) {
                                // クラスタからランダムに選択
                                const clusterIndex = Math.floor(Math.random() * clusterCenters.length);
                                const cluster = clusterCenters[clusterIndex];
                                
                                if (cluster) {
                                    const radius = 4 + Math.random() * 6; // クラスタ内の分散（4〜10m）- より広く
                                    const angle = Math.random() * Math.PI * 2;
                                    const distance = Math.random() * radius;
                                    
                                    x = cluster.x + Math.cos(angle) * distance;
                                    z = cluster.z + Math.sin(angle) * distance;
                                } else {
                                    // クラスタが見つからない場合はランダムな位置
                                    x = Math.random() * areaSize * 2 - areaSize;
                                    z = Math.random() * areaSize * 2 - areaSize;
                                }
                            } else {
                                // 完全にランダムな位置
                                x = Math.random() * areaSize * 2 - areaSize;
                                z = Math.random() * areaSize * 2 - areaSize;
                            }
                            
                            // 地面との関係を調整（サイズに応じて一部埋める）
                            const embeddedDepth = 0.1 + Math.random() * 0.5; // 埋め込み率（10%〜60%）に拡大
                            const adjustedHeight = sizeScale * embeddedDepth; // サイズに比例して埋める
                            const y = -5.0 - adjustedHeight + (Math.random() * 0.1); // 地面の高さに合わせて調整
                            
                            // 位置を設定
                            rock.position.set(x, y, z);
                            
                            // ランダムな回転を与える
                            rock.rotation.y = Math.random() * Math.PI * 2;
                            // わずかに傾ける（より自然な配置に見せる）
                            rock.rotation.x = (Math.random() - 0.5) * 0.3; // 傾きを強く
                            rock.rotation.z = (Math.random() - 0.5) * 0.3;
                            
                            // シーンに追加
                            scene.add(rock);
                            
                            // 衝突判定用に岩の情報を保存
                            gameState.rocks.push({
                                object: rock,
                                position: new THREE.Vector3(x, y, z),
                                scale: sizeScale,
                                collisionRadius: gameState.rockCollisionRadius * sizeScale * 0.7 // サイズに応じた衝突半径（見た目より少し小さめに）
                            });
                        }
                        
                        processed += currentBatchSize;
                        
                        // 次のバッチをスケジュール
                        setTimeout(createRockBatch, 0);
                    }
                    
                    // 岩の生成開始
                    createRockBatch();
                    
                    console.log(`${rockCount}個の岩の配置を開始しました...`);
                },
                null,
                function(error) {
                    console.error("代替パスからの岩のモデル読み込みも失敗:", error);
                }
            );
        }
    );
}

// 草の揺れを更新する関数
export function updateGrassWind(gameState) {
    // パフォーマンス向上のため、5フレームに1回だけ更新
    if (!gameState.grassUpdateCounter) gameState.grassUpdateCounter = 0;
    gameState.grassUpdateCounter++;
    if (gameState.grassUpdateCounter % 5 !== 0) return;
    
    // 現在の時間を取得（風のアニメーションに使用）
    const time = performance.now() * 0.001;
    
    // シェーダーベースの草の場合は時間パラメータを更新
    if (gameState.useShaderGrass && gameState.grassShaderMaterial) {
        // 各草のメッシュを更新
        for (let i = 0; i < gameState.grassSprites.length; i++) {
            const grassMesh = gameState.grassSprites[i];
            
            // シェーダーマテリアルの時間パラメータを更新
            if (grassMesh.material && grassMesh.material.uniforms) {
                grassMesh.material.uniforms.time.value = time;
                
                // 風の位相がある場合は考慮
                if (grassMesh.material.uniforms.windPhase) {
                    const windPhase = grassMesh.material.uniforms.windPhase.value;
                    const windEffect = Math.sin(time * gameState.windFrequency + windPhase) * gameState.windStrength;
                    // 必要に応じて追加のパラメータを更新できます
                }
            }
        }
    } else {
        // 従来のスプライトベースの草の場合
        // 各草のスプライトを更新
        for (let i = 0; i < gameState.grassSprites.length; i++) {
            const sprite = gameState.grassSprites[i];
            const userData = sprite.userData;
            
            if (!userData) continue; // userData が設定されていない場合はスキップ
            
            // 風の効果を計算（サイン波で周期的な動き）
            const windEffect = Math.sin(time * gameState.windFrequency + userData.windPhase) * userData.windAmplitude;
            
            // スプライトの位置を更新（横方向に揺らす）
            sprite.position.x = userData.originalPosition.x + windEffect;
            
            // スプライトの回転を更新（わずかに傾ける）
            sprite.rotation.z = windEffect * 0.2;
            
            // スプライトのスケールを更新（伸縮効果）
            const scaleEffect = 1.0 + Math.sin(time * gameState.windFrequency * 1.2 + userData.windPhase) * 0.05;
            sprite.scale.y = userData.originalScale.y * scaleEffect;
        }
    }
}

/**
 * 代替の環境マップを生成する関数
 * @param {THREE.Scene} scene - Three.jsのシーンオブジェクト
 * @param {THREE.WebGLRenderer} renderer - Three.jsのレンダラーオブジェクト
 */
export function createDefaultEnvMap(scene, renderer) {
    // console.log("代替の環境マップを生成します");
    
    // PMREMGeneratorを使用して環境マップを生成
    const pmremGenerator = new PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    
    // 簡易的な環境マップ用のシーンを作成
    const envScene = new THREE.Scene();
    
    // グラデーションの背景を設定
    const colors = [
        new THREE.Color(0x0077ff), // 上部（青空）
        new THREE.Color(0xffffff)  // 下部（白）
    ];
    
    const envGeometry = new THREE.SphereGeometry(100, 32, 32);
    const envMaterial = new THREE.ShaderMaterial({
        uniforms: {
            color1: { value: colors[0] },
            color2: { value: colors[1] }
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 color1;
            uniform vec3 color2;
            varying vec3 vWorldPosition;
            void main() {
                float y = normalize(vWorldPosition).y;
                float t = (y + 1.0) / 2.0;
                gl_FragColor = vec4(mix(color2, color1, t), 1.0);
            }
        `,
        side: THREE.BackSide
    });
    
    const envMesh = new THREE.Mesh(envGeometry, envMaterial);
    envScene.add(envMesh);
    
    // 環境マップを生成
    const renderTarget = pmremGenerator.fromScene(envScene);
    scene.environment = renderTarget.texture;
    
    // 不要になったリソースを解放
    pmremGenerator.dispose();
    envGeometry.dispose();
    envMaterial.dispose();
    
    // console.log("代替の環境マップを生成しました");
}