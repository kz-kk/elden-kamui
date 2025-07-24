// ビームエフェクト関連の機能を提供するモジュール
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.137.0/build/three.module.js';
import { applyDragonDamage } from '../../player.js';

/**
 * ビーム用のテクスチャを生成する関数
 * @returns {THREE.Texture} 生成されたテクスチャ
 */
function createBeamTexture() {
    // ビーム用のテクスチャを作成
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    
    // よりクッキリした青白い球体のグラデーション
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)'); // 中心は白
    gradient.addColorStop(0.1, 'rgba(220, 250, 255, 1)'); // 内側は明るい青白
    gradient.addColorStop(0.3, 'rgba(150, 220, 255, 0.95)'); // 中間は青
    gradient.addColorStop(0.5, 'rgba(100, 180, 255, 0.8)'); // 外側は薄い青
    gradient.addColorStop(0.7, 'rgba(50, 120, 255, 0.3)'); // 端は透明に
    gradient.addColorStop(1, 'rgba(20, 80, 220, 0)'); // 端は透明に
    
    // 背景を透明に
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // グラデーションを描画
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(32, 32, 32, 0, Math.PI * 2);
    context.fill();
    
    // エッジを強調するために輪郭を追加
    context.strokeStyle = 'rgba(200, 240, 255, 0.8)';
    context.lineWidth = 1;
    context.beginPath();
    context.arc(32, 32, 28, 0, Math.PI * 2);
    context.stroke();
    
    return new THREE.CanvasTexture(canvas);
}

/**
 * 衝突時の爆発エフェクトのテクスチャを生成する関数
 * @returns {THREE.Texture} 生成されたテクスチャ
 */
function createExplosionTexture() {
    // 爆発用のテクスチャを作成
    const canvas = document.createElement('canvas');
    canvas.width = 128; // 解像度を上げる
    canvas.height = 128;
    const context = canvas.getContext('2d');
    
    // よりシャープな爆発のグラデーション
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)'); // 中心は白
    gradient.addColorStop(0.05, 'rgba(250, 253, 255, 1)'); // 内側は明るい青白
    gradient.addColorStop(0.2, 'rgba(200, 230, 255, 0.95)'); // 中間は青
    gradient.addColorStop(0.4, 'rgba(150, 200, 255, 0.8)'); // 外側は薄い青
    gradient.addColorStop(0.6, 'rgba(100, 160, 255, 0.4)'); // 端は透明に
    gradient.addColorStop(0.8, 'rgba(70, 130, 240, 0.2)'); // 端は透明に
    gradient.addColorStop(1, 'rgba(50, 100, 220, 0)'); // 端は透明に
    
    // 背景を透明に
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // グラデーションを描画
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(64, 64, 64, 0, Math.PI * 2);
    context.fill();
    
    // エッジを強調するために輪郭を追加
    context.strokeStyle = 'rgba(220, 240, 255, 0.7)';
    context.lineWidth = 1;
    context.beginPath();
    context.arc(64, 64, 60, 0, Math.PI * 2);
    context.stroke();
    
    // 中心に小さな明るい点を追加
    const centerGradient = context.createRadialGradient(64, 64, 0, 64, 64, 20);
    centerGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    centerGradient.addColorStop(0.5, 'rgba(240, 250, 255, 0.8)');
    centerGradient.addColorStop(1, 'rgba(200, 230, 255, 0)');
    
    context.fillStyle = centerGradient;
    context.beginPath();
    context.arc(64, 64, 20, 0, Math.PI * 2);
    context.fill();
    
    return new THREE.CanvasTexture(canvas);
}

/**
 * 衝突時の爆発エフェクトを生成する関数
 * @param {THREE.Vector3} position - 爆発の位置
 * @param {Object} gameState - ゲームの状態オブジェクト
 * @param {THREE.Scene} scene - Three.jsのシーンオブジェクト
 * @param {Object} [params] - 追加パラメータ（オプション）
 */
function createExplosionEffect(position, gameState, scene, params = {}) {
    // パーティクル数をさらに増やす
    const particleCount = params.isSmallExplosion ? 500 : 800;
    
    // サイズ乗数（小さな爆発の場合は小さくする）
    const sizeMultiplier = params.sizeMultiplier || 1.0;
    
    // ジオメトリ
    const geometry = new THREE.BufferGeometry();
    
    // パーティクルの初期位置
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const lifetimes = new Float32Array(particleCount);
    const scales = new Float32Array(particleCount);
    const colors = new Float32Array(particleCount * 3);
    const rotations = new Float32Array(particleCount);
    const rotationSpeeds = new Float32Array(particleCount);
    
    // 爆発のパーティクルを生成
    for (let i = 0; i < particleCount; i++) {
        // ランダムな方向に飛び散る
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const r = 0.05 + Math.random() * 0.6; // より広範囲に飛び散るように調整
        
        // 球面座標から直交座標に変換
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);
        
        // 位置を設定（爆発の中心から少しランダムにずらす）
        positions[i * 3] = position.x + (Math.random() - 0.5) * 0.2;
        positions[i * 3 + 1] = position.y + (Math.random() - 0.5) * 0.2;
        positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.2;
        
        // 速度を設定（外側に飛び散る - より多様な速度で）
        const speedVariation = Math.random();
        const speed = 0.1 + speedVariation * 0.4; // 速度のばらつきを増やす
        velocities[i * 3] = x * speed;
        velocities[i * 3 + 1] = y * speed;
        velocities[i * 3 + 2] = z * speed;
        
        // 寿命を設定（より多様なばらつき）
        lifetimes[i] = 10 + Math.random() * 50;
        
        // サイズを設定（より小さいパーティクルを多く）
        // 80%の確率で小さいパーティクル、20%の確率で大きめのパーティクル
        scales[i] = Math.random() < 0.8 ? 
                    (0.02 + Math.random() * 0.15) * sizeMultiplier : // 小さいパーティクル（さらに小さく）
                    (0.15 + Math.random() * 0.3) * sizeMultiplier;   // 大きめのパーティクル（小さく調整）
        
        // 色を設定（青白いグラデーションに加えて、わずかな色のバリエーションを追加）
        const colorType = Math.random();
        if (colorType < 0.7) {
            // 標準的な青白い色（70%の確率）
            const colorFactor = Math.random();
            colors[i * 3] = 0.8 + colorFactor * 0.2; // R
            colors[i * 3 + 1] = 0.9 + colorFactor * 0.1; // G
            colors[i * 3 + 2] = 1.0; // B
        } else if (colorType < 0.9) {
            // より白い色（20%の確率）
            colors[i * 3] = 0.95 + Math.random() * 0.05; // R
            colors[i * 3 + 1] = 0.95 + Math.random() * 0.05; // G
            colors[i * 3 + 2] = 1.0; // B
        } else {
            // わずかに紫がかった色（10%の確率）
            colors[i * 3] = 0.7 + Math.random() * 0.2; // R
            colors[i * 3 + 1] = 0.7 + Math.random() * 0.2; // G
            colors[i * 3 + 2] = 1.0; // B
        }
        
        // 回転を設定（より多様な回転）
        rotations[i] = Math.random() * Math.PI * 2;
        rotationSpeeds[i] = (Math.random() - 0.5) * 0.3; // 回転速度を上げる
    }
    
    // ジオメトリに属性を設定
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
    geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('rotation', new THREE.BufferAttribute(rotations, 1));
    geometry.setAttribute('rotationSpeed', new THREE.BufferAttribute(rotationSpeeds, 1));
    
    // 爆発のテクスチャを生成
    const explosionTexture = createExplosionTexture();
    
    // マテリアル - よりシャープに
    const material = new THREE.PointsMaterial({
        size: params.isSmallExplosion ? 0.2 : 0.3, // 小さな爆発はさらに小さく
        map: explosionTexture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true
    });
    
    // パーティクルシステム
    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    
    // エフェクトオブジェクト
    const explosionEffect = {
        particles: particles,
        geometry: geometry,
        material: material,
        lifetime: 70, // 寿命を長くする
        currentLife: 0,
        
        // パーティクル位置を更新するメソッド
        updatePositions: function() {
            this.currentLife++;
            
            const positions = this.geometry.attributes.position.array;
            const velocities = this.geometry.attributes.velocity.array;
            const lifetimes = this.geometry.attributes.lifetime.array;
            const scales = this.geometry.attributes.scale.array;
            const rotations = this.geometry.attributes.rotation.array;
            const rotationSpeeds = this.geometry.attributes.rotationSpeed.array;
            
            // 各パーティクルを更新
            for (let i = 0; i < particleCount; i++) {
                // 寿命を減らす
                lifetimes[i] -= 1;
                
                // 寿命が切れたパーティクルは非表示に
                if (lifetimes[i] <= 0) {
                    positions[i * 3] = 2000; // 画面外に移動
                    positions[i * 3 + 1] = 2000;
                    positions[i * 3 + 2] = 2000;
                    continue;
                }
                
                // 位置を更新
                positions[i * 3] += velocities[i * 3];
                positions[i * 3 + 1] += velocities[i * 3 + 1];
                positions[i * 3 + 2] += velocities[i * 3 + 2];
                
                // 回転を更新
                rotations[i] += rotationSpeeds[i];
                
                // 速度を減衰（より多様な減衰率）
                const decayRate = 0.95 + Math.random() * 0.04; // 0.95〜0.99の間
                velocities[i * 3] *= decayRate;
                velocities[i * 3 + 1] *= decayRate;
                velocities[i * 3 + 2] *= decayRate;
                
                // 重力効果（弱めに、ランダム性を持たせる）
                velocities[i * 3 + 1] -= 0.0005 + Math.random() * 0.001;
                
                // サイズを徐々に小さくする（ランダムな縮小率）
                scales[i] *= 0.97 + Math.random() * 0.01; // より速く小さくなるように調整
                
                // ランダムなゆらぎを追加
                if (Math.random() < 0.15) { // 15%の確率で（より頻繁に）
                    velocities[i * 3] += (Math.random() - 0.5) * 0.015; // より大きなゆらぎ
                    velocities[i * 3 + 2] += (Math.random() - 0.5) * 0.015;
                }
            }
            
            // 更新した属性をGPUに通知
            this.geometry.attributes.position.needsUpdate = true;
            this.geometry.attributes.lifetime.needsUpdate = true;
            this.geometry.attributes.scale.needsUpdate = true;
            this.geometry.attributes.rotation.needsUpdate = true;
        }
    };
    
    // エフェクトを配列に追加
    gameState.explosionEffects = gameState.explosionEffects || [];
    gameState.explosionEffects.push(explosionEffect);
    
    return explosionEffect;
}

/**
 * 青白い球体ビームエフェクトを生成する関数
 * @param {Object} gameState - ゲームの状態オブジェクト
 * @param {THREE.Scene} scene - Three.jsのシーンオブジェクト
 * @returns {void}
 */
export function createBeamEffect(gameState, scene) {
    if (!gameState.playerModel) return;
    
    // プレイヤーの前方向を計算
    const forwardX = Math.sin(gameState.playerRotation);
    const forwardZ = Math.cos(gameState.playerRotation);
    
    // ビームの発射位置（プレイヤーの前方）
    const beamOrigin = new THREE.Vector3(
        gameState.playerPosition.x + forwardX * 1.5, // プレイヤーの少し前から発生
        gameState.playerPosition.y + 1.2, // プレイヤーの胸より少し上
        gameState.playerPosition.z + forwardZ * 1.5
    );
    
    // ビームの方向ベクトル
    const beamDirection = new THREE.Vector3(forwardX, 0, forwardZ).normalize();
    
    // 球体の数（増やして、より散らばるように）
    const sphereCount = 8;
    const particleGeometry = new THREE.BufferGeometry();
    
    // パーティクルの初期位置
    const positions = new Float32Array(sphereCount * 3); // xyz
    const velocities = new Float32Array(sphereCount * 3); // xyz速度
    const lifetimes = new Float32Array(sphereCount); // 寿命
    const scales = new Float32Array(sphereCount); // サイズ
    const colors = new Float32Array(sphereCount * 3); // RGB色
    const rotations = new Float32Array(sphereCount); // 回転角度
    const rotationSpeeds = new Float32Array(sphereCount);
    
    // 球体の間隔（ばらつきを持たせる）
    const baseSpacing = 1.2;
    
    // 球体を生成
    for (let i = 0; i < sphereCount; i++) {
        // 位置を設定（大きく散らばるように）
        const offset = i * baseSpacing * (0.8 + Math.random() * 0.4); // 間隔にもばらつき
        const spreadX = (Math.random() - 0.5) * 2.0; // 左右の広がりを増加
        const spreadY = (Math.random() - 0.5) * 1.5; // 上下の広がりを増加
        const spreadZ = (Math.random() - 0.5) * 0.5; // 前後の広がりを追加
        
        positions[i * 3] = beamOrigin.x + beamDirection.x * offset + spreadX;
        positions[i * 3 + 1] = beamOrigin.y + spreadY;
        positions[i * 3 + 2] = beamOrigin.z + beamDirection.z * offset + spreadX + spreadZ;
        
        // 速度を設定（よりダイナミックな動きに）
        const baseSpeed = 0.25 + Math.random() * 0.2; // 速度のばらつきを増加
        const spreadSpeed = (Math.random() - 0.5) * 0.15; // 広がりの速度を増加
        const verticalSpeed = (Math.random() - 0.5) * 0.08; // 上下の動きを増加
        
        velocities[i * 3] = beamDirection.x * baseSpeed + spreadSpeed;
        velocities[i * 3 + 1] = verticalSpeed;
        velocities[i * 3 + 2] = beamDirection.z * baseSpeed + spreadSpeed;
        
        // 寿命を設定（よりばらつきを持たせる）
        lifetimes[i] = 40 + Math.random() * 40;
        
        // サイズを設定（よりダイナミックなサイズ変化）
        const sizeVariation = Math.random();
        if (sizeVariation < 0.4) { // 40%の確率で小さい球体
            scales[i] = 0.8 + Math.random() * 0.4;
        } else if (sizeVariation < 0.9) { // 50%の確率で中くらいの球体
            scales[i] = 1.2 + Math.random() * 0.6;
        } else { // 10%の確率で大きい球体
            scales[i] = 1.8 + Math.random() * 0.8;
        }
        
        // 色を設定（青白いグラデーション）
        colors[i * 3] = 0.7 + Math.random() * 0.3; // R
        colors[i * 3 + 1] = 0.8 + Math.random() * 0.2; // G
        colors[i * 3 + 2] = 1.0; // B
        
        // 回転を設定
        rotations[i] = Math.random() * Math.PI * 2;
        rotationSpeeds[i] = (Math.random() - 0.5) * 0.1;
    }
    
    // ジオメトリに属性を設定
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    particleGeometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
    particleGeometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeometry.setAttribute('rotation', new THREE.BufferAttribute(rotations, 1));
    particleGeometry.setAttribute('rotationSpeed', new THREE.BufferAttribute(rotationSpeeds, 1));
    
    // ビームのテクスチャを生成
    const beamTexture = createBeamTexture();
    
    // ビームのテクスチャを使用したマテリアル
    const beamMaterial = new THREE.PointsMaterial({
        size: 2.5, // サイズを少し小さくしてシャープに
        map: beamTexture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true
    });
    
    // パーティクルシステムを作成
    const beamParticles = new THREE.Points(particleGeometry, beamMaterial);
    scene.add(beamParticles);
    
    // エフェクトオブジェクト
    const beamEffect = {
        particles: beamParticles,
        geometry: particleGeometry,
        material: beamMaterial,
        lifetime: 60, // エフェクト全体の寿命
        currentLife: 0,
        hasCollided: false, // 衝突フラグ
        collisionPosition: null, // 衝突位置
        
        // パーティクル位置を更新するメソッド
        updatePositions: function() {
            this.currentLife++;
            
            const positions = this.geometry.attributes.position.array;
            const velocities = this.geometry.attributes.velocity.array;
            const lifetimes = this.geometry.attributes.lifetime.array;
            const scales = this.geometry.attributes.scale.array;
            const rotations = this.geometry.attributes.rotation.array;
            const rotationSpeeds = this.geometry.attributes.rotationSpeed.array;
            
            // 衝突判定
            if (!this.hasCollided && gameState.dragonModel) {
                const dragonPos = gameState.dragonModel.position.clone();
                const dragonRadius = 3.0; // ドラゴンの当たり判定の半径
                
                // 各球体とドラゴンの衝突判定
                for (let i = 0; i < sphereCount; i++) {
                    const spherePos = new THREE.Vector3(
                        positions[i * 3],
                        positions[i * 3 + 1],
                        positions[i * 3 + 2]
                    );
                    
                    // 画面外に移動した球体は無視
                    if (spherePos.x > 1000 || spherePos.y > 1000 || spherePos.z > 1000) {
                        continue;
                    }
                    
                    // 球体とドラゴンの距離を計算
                    const distance = spherePos.distanceTo(dragonPos);
                    
                    // 衝突判定
                    if (distance < dragonRadius + scales[i]) {
                        // console.log(`ビームとドラゴンの衝突を検出！距離: ${distance.toFixed(2)}`);
                        
                        // 衝突フラグを立てる
                        this.hasCollided = true;
                        this.collisionPosition = spherePos.clone();
                        
                        // ドラゴンにダメージを与える
                        if (!gameState.isDragonInvincible) {
                            gameState.currentDragonHealth -= 20;
                            // console.log(`ドラゴンにダメージを与えた！ダメージ量: 20（強化）, 残り体力: ${gameState.currentDragonHealth}`);
                            
                            // 体力が0以下になったらドラゴン撃破
                            if (gameState.currentDragonHealth <= 0) {
                                gameState.currentDragonHealth = 0;
                                gameState.isDragonDefeated = true;
                                
                                // ドラゴン撃破時の処理
                                if (gameState.dragonModel) {
                                    // ドラゴンを非表示にする
                                    gameState.dragonModel.visible = false;
                                }
                                
                                // console.log("ドラゴンを撃破した！");
                            } else {
                                // 無敵状態にする
                                gameState.isDragonInvincible = true;
                                gameState.dragonInvincibleTimer = gameState.dragonInvincibleTime;
                                
                                // ダメージ点滅タイマーをセット
                                gameState.dragonDamageFlashTimer = 20; // 20フレーム間点滅
                            }
                        }
                        
                        // 複数の爆発エフェクトを生成
                        // メインの爆発
                        createExplosionEffect(spherePos, gameState, scene);
                        
                        // 周囲に小さな爆発をランダムに配置
                        const subExplosionCount = 3 + Math.floor(Math.random() * 3); // 3〜5個の追加爆発
                        for (let j = 0; j < subExplosionCount; j++) {
                            // ランダムな位置にずらす（ドラゴンの体表面付近）
                            const offset = new THREE.Vector3(
                                (Math.random() - 0.5) * 2.0,
                                (Math.random() - 0.5) * 2.0,
                                (Math.random() - 0.5) * 2.0
                            );
                            
                            // ドラゴンの体表面に近い位置を計算
                            const direction = offset.normalize();
                            const distance = 2.0 + Math.random() * 1.0; // ドラゴンの体表面からの距離
                            
                            const subExplosionPos = new THREE.Vector3(
                                dragonPos.x + direction.x * distance,
                                dragonPos.y + direction.y * distance,
                                dragonPos.z + direction.z * distance
                            );
                            
                            // 遅延して爆発を生成（連鎖爆発のように見せる）
                            setTimeout(() => {
                                // 小さめの爆発エフェクトを生成するための特殊パラメータ
                                const smallExplosionParams = {
                                    isSmallExplosion: true,
                                    sizeMultiplier: 0.6 + Math.random() * 0.2 // 0.6〜0.8倍のサイズ
                                };
                                createExplosionEffect(subExplosionPos, gameState, scene, smallExplosionParams);
                            }, j * 50); // 50msずつ遅延
                        }
                        
                        // 全ての球体を非表示にする
                        for (let j = 0; j < sphereCount; j++) {
                            positions[j * 3] = 2000; // 画面外に移動
                            positions[j * 3 + 1] = 2000;
                            positions[j * 3 + 2] = 2000;
                        }
                        
                        break;
                    }
                }
            }
            
            // 衝突していない場合は通常の更新
            if (!this.hasCollided) {
                // 各球体を更新
                for (let i = 0; i < sphereCount; i++) {
                    // 寿命を減らす
                    lifetimes[i] -= 1;
                    
                    // 寿命が切れた球体は非表示に
                    if (lifetimes[i] <= 0) {
                        positions[i * 3] = 2000; // 画面外に移動
                        positions[i * 3 + 1] = 2000;
                        positions[i * 3 + 2] = 2000;
                        continue;
                    }
                    
                    // 位置を更新
                    positions[i * 3] += velocities[i * 3];
                    positions[i * 3 + 1] += velocities[i * 3 + 1];
                    positions[i * 3 + 2] += velocities[i * 3 + 2];
                    
                    // 回転を更新
                    rotations[i] += rotationSpeeds[i];
                    
                    // 軌道の修正（広がりながら飛ぶように）
                    const spreadMaintain = (Math.random() - 0.5) * 0.08; // 広がりを増加
                    const verticalMaintain = (Math.random() - 0.5) * 0.05; // 上下の動きを維持
                    velocities[i * 3] = beamDirection.x * (0.25 + Math.random() * 0.2) + spreadMaintain;
                    velocities[i * 3 + 1] += verticalMaintain;
                    velocities[i * 3 + 2] = beamDirection.z * (0.25 + Math.random() * 0.2) + spreadMaintain;
                    
                    // より大きな脈動効果
                    const pulseFactor = 0.92 + 0.16 * Math.sin(this.currentLife * 0.3 + i);
                    scales[i] *= pulseFactor;
                }
            }
            
            // 更新した属性をGPUに通知
            this.geometry.attributes.position.needsUpdate = true;
            this.geometry.attributes.lifetime.needsUpdate = true;
            this.geometry.attributes.scale.needsUpdate = true;
            this.geometry.attributes.rotation.needsUpdate = true;
        }
    };
    
    // エフェクトを配列に追加
    gameState.beamEffects.push(beamEffect);
}

/**
 * ビームエフェクトを更新する関数
 * @param {Object} gameState - ゲームの状態オブジェクト
 * @param {THREE.Scene} scene - Three.jsのシーンオブジェクト
 */
export function updateBeamEffects(gameState, scene) {
    // 各ビームエフェクトを更新
    for (let i = gameState.beamEffects.length - 1; i >= 0; i--) {
        const beam = gameState.beamEffects[i];
        
        // パーティクル位置を更新
        beam.updatePositions();
        
        // エフェクトの寿命が切れたら削除
        if (beam.currentLife >= beam.lifetime) {
            scene.remove(beam.particles);
            beam.geometry.dispose();
            beam.material.dispose();
            gameState.beamEffects.splice(i, 1);
            // console.log("ビームエフェクト消滅");
        }
    }
    
    // 爆発エフェクトを更新
    if (gameState.explosionEffects) {
        for (let i = gameState.explosionEffects.length - 1; i >= 0; i--) {
            const explosion = gameState.explosionEffects[i];
            
            // パーティクル位置を更新
            explosion.updatePositions();
            
            // エフェクトの寿命が切れたら削除
            if (explosion.currentLife >= explosion.lifetime) {
                scene.remove(explosion.particles);
                explosion.geometry.dispose();
                explosion.material.dispose();
                gameState.explosionEffects.splice(i, 1);
                // console.log("爆発エフェクト消滅");
            }
        }
    }
} 