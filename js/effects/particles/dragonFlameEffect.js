// ドラゴンの炎エフェクト関連の機能を提供するモジュール
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.137.0/build/three.module.js';

/**
 * 炎用のテクスチャを生成する関数
 * @returns {THREE.Texture} 生成されたテクスチャ
 */
function createFlameTexture() {
    // 炎用のテクスチャを作成
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    
    // 炎のパーティクル用のグラデーション
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)'); // 中心の透明度を少し下げる
    gradient.addColorStop(0.2, 'rgba(255, 250, 200, 0.85)'); // 内側の透明度を下げる
    gradient.addColorStop(0.4, 'rgba(255, 150, 50, 0.7)'); // 中間の透明度を下げる
    gradient.addColorStop(0.7, 'rgba(255, 50, 0, 0.4)'); // 外側の透明度を下げる
    gradient.addColorStop(1, 'rgba(100, 0, 0, 0)'); // 端は完全な透明
    
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(32, 32, 32, 0, Math.PI * 2);
    context.fill();
    
    // より自然な炎のテクスチャにするためのノイズ追加（ノイズを減らす）
    context.globalCompositeOperation = 'overlay';
    for (let i = 0; i < 10; i++) { // ノイズの数を半分に
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        const radius = 1 + Math.random() * 3; // ノイズ粒子をより小さく
        const glow = context.createRadialGradient(x, y, 0, x, y, radius);
        glow.addColorStop(0, 'rgba(255, 230, 150, 0.2)'); // ノイズの透明度を下げる
        glow.addColorStop(1, 'rgba(255, 120, 20, 0)');
        context.fillStyle = glow;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
    }
    
    return new THREE.CanvasTexture(canvas);
}

/**
 * ドラゴンの炎エフェクトを生成する関数
 * @param {Object} gameState - ゲームの状態オブジェクト
 * @param {THREE.Scene} scene - Three.jsのシーンオブジェクト
 * @returns {void}
 */
export function createDragonFlameEffect(gameState, scene) {
    if (!gameState.dragonModel) return;
    
    // ドラゴンの位置と向きを取得
    const dragonPosition = gameState.dragonModel.position.clone();
    const dragonRotation = gameState.dragonModel.rotation.y;
    
    // 炎の発射位置（ドラゴンの口の位置に合わせる）
    let flameOrigin;
    
    // dragon.jsで設定された発射位置がある場合はそれを使用
    if (gameState.dragonFlameOrigin) {
        flameOrigin = gameState.dragonFlameOrigin.clone();
    } else {
        flameOrigin = new THREE.Vector3(
            dragonPosition.x + Math.sin(dragonRotation) * 4,
            dragonPosition.y + 5,
            dragonPosition.z + Math.cos(dragonRotation) * 4
        );
    }
    
    // プレイヤーの位置を取得
    const playerPosition = gameState.playerModel ? gameState.playerModel.position.clone() : null;
    
    // 炎の方向ベクトルを計算
    let flameDirection;
    let targetPosition;
    
    // dragon.jsで設定された方向がある場合はそれを使用
    if (gameState.dragonFlameTargetDirection) {
        flameDirection = gameState.dragonFlameTargetDirection.clone();
        targetPosition = gameState.dragonFlameTargetPosition ? gameState.dragonFlameTargetPosition.clone() : null;
    } else if (playerPosition && gameState.dragonFlameTargetPlayer) {
        // プレイヤーの位置をターゲットにする
        targetPosition = playerPosition.clone();
        targetPosition.y = gameState.groundLevel; // 地面レベルに設定
        
        flameDirection = new THREE.Vector3();
        flameDirection.subVectors(targetPosition, flameOrigin);
        flameDirection.normalize();
    } else {
        // デフォルト：前方に向かって発射
        flameDirection = new THREE.Vector3(Math.sin(dragonRotation), -0.5, Math.cos(dragonRotation)).normalize();
    }
    
    // ドラゴンの横方向と上方向のベクトルを計算（口の形状のため）
    // 横方向ベクトルはflameDirectionに直交するベクトル
    const upDirection = new THREE.Vector3(0, 1, 0);
    const sideDirection = new THREE.Vector3();
    sideDirection.crossVectors(upDirection, flameDirection).normalize();
    
    // 上方向ベクトルを再計算（正確な直交座標系を得るため）
    const adjustedUpDirection = new THREE.Vector3();
    adjustedUpDirection.crossVectors(flameDirection, sideDirection).normalize();
    
    // ドラゴンの移動速度と方向を記録（パーティクルの慣性に使用）
    const lastDragonPosition = gameState.lastDragonPosition || dragonPosition.clone();
    const dragonVelocity = new THREE.Vector3();
    dragonVelocity.subVectors(dragonPosition, lastDragonPosition);
    gameState.lastDragonPosition = dragonPosition.clone();
    
    // パーティクル数を設定
    const particleCount = Math.min(gameState.dragonFlameParticleCount || 1000, 2000);
    gameState.dragonFlameParticleCount = particleCount;
    
    const particleGeometry = new THREE.BufferGeometry();
    
    // パーティクルの初期位置
    const positions = new Float32Array(particleCount * 3); // xyz
    const velocities = new Float32Array(particleCount * 3); // xyz速度
    const accelerations = new Float32Array(particleCount * 3); // xyz加速度
    const lifetimes = new Float32Array(particleCount); // 寿命
    const maxLifetimes = new Float32Array(particleCount); // 最大寿命
    const scales = new Float32Array(particleCount); // サイズ
    const colors = new Float32Array(particleCount * 3); // RGB色
    const rotations = new Float32Array(particleCount); // 回転角度
    const rotationSpeeds = new Float32Array(particleCount);
    const isGroundFlame = new Float32Array(particleCount); // 地面に広がる炎かどうか
    const initialDelays = new Float32Array(particleCount); // 初期遅延
    
    // パーティクル生成の補助関数
    const initializeParticle = (i, targetDir, targetPos) => {
        const i3 = i * 3;
        
        // ドラゴンの口の形状に合わせた初期位置
        // 楕円形の口からのランダムな位置
        const t = Math.random() * Math.PI * 2;
        const u = Math.random() + Math.random();
        const r = u > 1 ? 2 - u : u;
        
        const offsetX = r * Math.cos(t) * 0.5;
        const offsetY = r * Math.sin(t) * 0.5;
        
        // 現在の方向ベクトルに対応した口の形状からのオフセット計算
        const currentSideDirection = new THREE.Vector3();
        currentSideDirection.crossVectors(upDirection, targetDir).normalize();
        
        const currentUpDirection = new THREE.Vector3();
        currentUpDirection.crossVectors(targetDir, currentSideDirection).normalize();
        
        // 口の形状に合わせた初期位置の計算
        const mouthOffset = new THREE.Vector3()
            .addScaledVector(currentSideDirection, offsetX)
            .addScaledVector(currentUpDirection, offsetY);
        
        // 初期位置をドラゴンの口の形状に合わせて設定
        positions[i3] = flameOrigin.x + mouthOffset.x;
        positions[i3 + 1] = flameOrigin.y + mouthOffset.y;
        positions[i3 + 2] = flameOrigin.z + mouthOffset.z;
        
        // パーティクルごとに少し異なる向きを持つ（より自然な炎の広がり）
        const coneAngle = Math.PI / 16; // より狭い角度に設定（1/16π ≈ 11.25度）
        const randomConeAngle = Math.random() * coneAngle;
        const azimuth = Math.random() * Math.PI * 2;
        
        // 基本方向からのランダムな角度のずれを計算
        let dirX = targetDir.x;
        let dirY = targetDir.y;
        let dirZ = targetDir.z;
        
        // 目標位置がある場合、そこへの到達を考慮した速度を設定
        if (targetPos) {
            const distanceToTarget = flameOrigin.distanceTo(targetPos);
            const timeToTarget = Math.sqrt(2 * distanceToTarget / 0.1); // 適度な到達時間を計算
            
            // 初速を調整して目標に到達しやすくする
            const initialSpeed = distanceToTarget / timeToTarget;
            velocities[i3] = dirX * initialSpeed * (0.8 + Math.random() * 0.4);
            velocities[i3 + 1] = dirY * initialSpeed * (0.8 + Math.random() * 0.4);
            velocities[i3 + 2] = dirZ * initialSpeed * (0.8 + Math.random() * 0.4);
            
            // 重力の影響を考慮した放物線の初期速度調整
            velocities[i3 + 1] += 0.1; // 上向きの初速を少し加える
            
        } else {
            // 通常の速度設定
            const speed = 0.2 + Math.random() * 0.3;
            velocities[i3] = dirX * speed;
            velocities[i3 + 1] = dirY * speed;
            velocities[i3 + 2] = dirZ * speed;
        }
        
        // 加速度設定（重力と空気抵抗）
        accelerations[i3] = 0;
        accelerations[i3 + 1] = -0.015; // 重力をより強く
        accelerations[i3 + 2] = 0;
        
        // 寿命設定
        const baseDuration = 60 + Math.random() * 30;
        maxLifetimes[i] = baseDuration;
        lifetimes[i] = baseDuration;
        
        // 初期遅延を短く設定
        initialDelays[i] = Math.random() * 3;
        
        // 地面の炎かどうかのフラグ
        isGroundFlame[i] = 0;
        
        // サイズ設定
        scales[i] = 0.2 + Math.random() * 0.6;
        
        // 色設定
        const colorRandom = Math.random();
        if (colorRandom < 0.2) { // より少ない割合で黄色い炎
            // 白っぽい黄色（中心部分）
            colors[i3] = 1.0;        // R
            colors[i3 + 1] = 0.95;   // G
            colors[i3 + 2] = 0.7;    // B
        } else if (colorRandom < 0.6) {
            // オレンジっぽい（中間部分）
            colors[i3] = 1.0;        // R
            colors[i3 + 1] = 0.6;    // G
            colors[i3 + 2] = 0.2;    // B
        } else {
            // 赤っぽい（外側部分）
            colors[i3] = 1.0;        // R
            colors[i3 + 1] = 0.3;    // G
            colors[i3 + 2] = 0.05;   // B
        }
        
        // 回転と回転速度
        rotations[i] = Math.random() * Math.PI * 2;
        rotationSpeeds[i] = (Math.random() - 0.5) * 0.12;
    };
    
    // パーティクルの更新関数内で地面に到達した炎の処理を修正
    const updateParticle = (i, positions, velocities, lifetimes, isGroundFlame) => {
        const i3 = i * 3;
        
        // 地面に到達した場合の処理
        if (!isGroundFlame[i] && positions[i3 + 1] <= gameState.groundLevel + 0.2) {
            isGroundFlame[i] = 1;
            positions[i3 + 1] = gameState.groundLevel + 0.1;
            
            // プレイヤーの方向を考慮した速度の設定
            if (gameState.playerModel) {
                const toPlayer = new THREE.Vector3(
                    gameState.playerPosition.x - positions[i3],
                    0,
                    gameState.playerPosition.z - positions[i3 + 2]
                ).normalize();
                
                // プレイヤー方向への速度を強める
                const spreadSpeed = 0.2 + Math.random() * 0.1; // 速度を上げる
                velocities[i3] = toPlayer.x * spreadSpeed;
                velocities[i3 + 1] = 0.01; // わずかな上向きの速度
                velocities[i3 + 2] = toPlayer.z * spreadSpeed;
                
                // プレイヤーに近いほど速度を上げる
                const distToPlayer = Math.sqrt(
                    Math.pow(positions[i3] - gameState.playerPosition.x, 2) +
                    Math.pow(positions[i3 + 2] - gameState.playerPosition.z, 2)
                );
                
                if (distToPlayer < 6.0) { // 検知距離を縮小
                    const speedMultiplier = 1.0 + (6.0 - distToPlayer) / 8.0; // 速度増加を抑制
                    velocities[i3] *= speedMultiplier;
                    velocities[i3 + 2] *= speedMultiplier;
                    
                    // プレイヤーが近い場合の速度も制限
                    if (distToPlayer < 3.0) {
                        velocities[i3] = toPlayer.x * (0.15 + Math.random() * 0.1); // 速度を大幅に抑制
                        velocities[i3 + 2] = toPlayer.z * (0.15 + Math.random() * 0.1);
                    }
                }
                
                // 炎の広がりを制御（プレイヤー方向に集中）
                if (Math.random() < 0.7) { // 70%の確率でプレイヤー方向に向かう
                    const randomAngle = (Math.random() - 0.5) * Math.PI / 4; // ±45度の範囲でランダム
                    const cos = Math.cos(randomAngle);
                    const sin = Math.sin(randomAngle);
                    const speed = Math.sqrt(velocities[i3] * velocities[i3] + velocities[i3 + 2] * velocities[i3 + 2]);
                    velocities[i3] = (toPlayer.x * cos - toPlayer.z * sin) * speed;
                    velocities[i3 + 2] = (toPlayer.x * sin + toPlayer.z * cos) * speed;
                }
            }
            
            // 寿命を延長（地面の炎をより長く持続）
            lifetimes[i] *= 3.0;
            
            // 地面の炎のサイズを大きくする
            scales[i] = Math.max(scales[i] * 3.0, 8.0);
            
            // 地面の炎の色を強化（より明るく、見やすく）
            colors[i3] = 1.0;     // 赤を最大に
            colors[i3 + 1] = 0.8; // 緑を強化（オレンジ色）
            colors[i3 + 2] = 0.1; // 青を少し
            
            // 加速度を調整（地面に沿った動きに）
            accelerations[i3] = 0;
            accelerations[i3 + 1] = 0;
            accelerations[i3 + 2] = 0;
        }
    };
    
    // 炎のパーティクルを生成
    for (let i = 0; i < particleCount; i++) {
        initializeParticle(i, flameDirection, targetPosition);
    }
    
    // ジオメトリに属性を設定
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    particleGeometry.setAttribute('acceleration', new THREE.BufferAttribute(accelerations, 3));
    particleGeometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
    particleGeometry.setAttribute('maxLifetime', new THREE.BufferAttribute(maxLifetimes, 1));
    particleGeometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeometry.setAttribute('rotation', new THREE.BufferAttribute(rotations, 1));
    particleGeometry.setAttribute('rotationSpeed', new THREE.BufferAttribute(rotationSpeeds, 1));
    particleGeometry.setAttribute('isGroundFlame', new THREE.BufferAttribute(isGroundFlame, 1));
    particleGeometry.setAttribute('initialDelay', new THREE.BufferAttribute(initialDelays, 1));
    
    // 炎のテクスチャを生成
    const flameTexture = createFlameTexture();
    
    // 炎のテクスチャを使用したマテリアル
    const flameMaterial = new THREE.PointsMaterial({
        size: 0.6, // パーティクルサイズをさらに小さく
        map: flameTexture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        opacity: 0.8 // 全体の透明度を少し下げる
    });
    
    // パーティクルシステムを作成
    const flameParticles = new THREE.Points(particleGeometry, flameMaterial);
    
    // フラスタムカリングを無効化して画面外からの炎も描画
    flameParticles.frustumCulled = false;
    
    scene.add(flameParticles);
    
    // エフェクトオブジェクト
    const flameEffect = {
        particles: flameParticles,
        geometry: particleGeometry,
        material: flameMaterial,
        lifetime: 120, // エフェクト全体の寿命
        groundReachTime: null, // 地面到達時刻を記録
        currentLife: 0,
        originPosition: dragonPosition.clone(), // 元のドラゴン位置を保持
        originRotation: dragonRotation, // 元のドラゴン向きを保持
        initializeParticle: initializeParticle, // パーティクル初期化関数を保存
        initialDirection: flameDirection.clone(), // 初期の炎の方向を保存
        
        // パーティクル位置を更新するメソッド
        updatePositions: function() {
            this.currentLife++;
            
            const positions = this.geometry.attributes.position.array;
            const velocities = this.geometry.attributes.velocity.array;
            const accelerations = this.geometry.attributes.acceleration.array;
            const lifetimes = this.geometry.attributes.lifetime.array;
            const maxLifetimes = this.geometry.attributes.maxLifetime.array;
            const scales = this.geometry.attributes.scale.array;
            const colors = this.geometry.attributes.color.array;
            const rotations = this.geometry.attributes.rotation.array;
            const rotationSpeeds = this.geometry.attributes.rotationSpeed.array;
            const isGroundFlame = this.geometry.attributes.isGroundFlame.array;
            const initialDelays = this.geometry.attributes.initialDelay.array;
            
            // ドラゴンの現在の位置と向きを取得（移動に追尾するため）
            const currentDragonPosition = gameState.dragonModel.position.clone();
            const currentDragonRotation = gameState.dragonModel.rotation.y;
            
            // ドラゴンの前方向を計算
            const forwardX = Math.sin(currentDragonRotation);
            const forwardZ = Math.cos(currentDragonRotation);
            
            // 炎の発射位置を更新（ドラゴンの口の位置）
            const updatedFlameOrigin = new THREE.Vector3(
                currentDragonPosition.x + forwardX * 4, // ドラゴンの頭部前方
                currentDragonPosition.y + 5, // ドラゴンの口の高さ
                currentDragonPosition.z + forwardZ * 4
            );
            
            // プレイヤーの現在位置を取得
            const currentPlayerPosition = gameState.playerModel ? gameState.playerModel.position.clone() : null;
            
            // 炎の方向ベクトルを更新（プレイヤーに向けて）
            let updatedFlameDirection;
            
            if (currentPlayerPosition) {
                // ドラゴンの口からプレイヤーへのベクトルを計算
                updatedFlameDirection = new THREE.Vector3();
                updatedFlameDirection.subVectors(currentPlayerPosition, updatedFlameOrigin);
                
                // ベクトルを正規化
                updatedFlameDirection.normalize();
                
                // 確実にプレイヤーを狙うように調整（下向き成分を小さくする）
                updatedFlameDirection.y -= 0.05; // 少しだけ下向きにして自然に見せる
                updatedFlameDirection.normalize();
            } else {
                // プレイヤーが見つからない場合は初期方向を使用
                updatedFlameDirection = this.initialDirection.clone();
            }
            
            // 横方向ベクトルの更新
            const upVector = new THREE.Vector3(0, 1, 0);
            const updatedSideDirection = new THREE.Vector3();
            updatedSideDirection.crossVectors(upVector, updatedFlameDirection).normalize();
            
            // 上方向ベクトルの更新
            const updatedUpDirection = new THREE.Vector3();
            updatedUpDirection.crossVectors(updatedFlameDirection, updatedSideDirection).normalize();
            
            // ドラゴンの移動速度（パーティクルの空気抵抗計算に使用）
            const lastDragonPosition = gameState.lastDragonPosition || currentDragonPosition.clone();
            const dragonVelocity = new THREE.Vector3();
            dragonVelocity.subVectors(currentDragonPosition, lastDragonPosition);
            gameState.lastDragonPosition = currentDragonPosition.clone();
            
            // 空気抵抗係数（ドラゴンの動きでパーティクルが流される強さ）
            const dragCoefficient = 0.08; // 少し強化
            
            // 各パーティクルを更新
            for (let i = 0; i < gameState.dragonFlameParticleCount; i++) {
                const i3 = i * 3;
                
                // 初期遅延の処理
                if (initialDelays[i] > 0) {
                    initialDelays[i]--;
                    continue;
                }
                
                // 寿命の更新
                lifetimes[i] -= 1;
                
                // 寿命が切れたパーティクルの再利用
                if (lifetimes[i] <= 0) {
                    initializeParticle(i, updatedFlameDirection, gameState.dragonFlameTargetPosition);
                    continue;
                }
                
                // パーティクルの位置更新
                positions[i3] += velocities[i3];
                positions[i3 + 1] += velocities[i3 + 1];
                positions[i3 + 2] += velocities[i3 + 2];
                
                // 速度の更新（加速度を適用）
                velocities[i3] += accelerations[i3];
                velocities[i3 + 1] += accelerations[i3 + 1];
                velocities[i3 + 2] += accelerations[i3 + 2];
                
                // 地面との衝突判定と処理
                updateParticle(i, positions, velocities, lifetimes, isGroundFlame);
            }
            
            // 更新した属性をGPUに通知
            this.geometry.attributes.position.needsUpdate = true;
            this.geometry.attributes.velocity.needsUpdate = true;
            this.geometry.attributes.acceleration.needsUpdate = true;
            this.geometry.attributes.lifetime.needsUpdate = true;
            this.geometry.attributes.maxLifetime.needsUpdate = true;
            this.geometry.attributes.scale.needsUpdate = true;
            this.geometry.attributes.color.needsUpdate = true;
            this.geometry.attributes.rotation.needsUpdate = true;
            this.geometry.attributes.isGroundFlame.needsUpdate = true;
            this.geometry.attributes.initialDelay.needsUpdate = true;
            
            // 地面到達から一定時間経過後にfrustumCulledを元に戻す
            let hasGroundFlames = false;
            for (let i = 0; i < particleCount; i++) {
                if (isGroundFlame[i] > 0) {
                    hasGroundFlames = true;
                    break;
                }
            }
            
            if (hasGroundFlames && !this.groundReachTime) {
                this.groundReachTime = this.currentLife;
            }
            
            // 地面到達から60フレーム（1秒）経過後にfrustumCulledを戻す
            if (this.groundReachTime && (this.currentLife - this.groundReachTime) > 60) {
                this.particles.frustumCulled = true;
                // console.log("地面の炎が安定、frustumCulled復元");
            }
        }
    };
    
    // エフェクトを配列に追加
    gameState.dragonFlameEffects.push(flameEffect);
}

/**
 * 炎エフェクトを更新する関数
 * @param {Object} gameState - ゲームの状態オブジェクト
 * @param {THREE.Scene} scene - Three.jsのシーンオブジェクト
 */
export function updateDragonFlameEffects(gameState, scene) {
    // 各ドラゴンの炎エフェクトを更新
    for (let i = gameState.dragonFlameEffects.length - 1; i >= 0; i--) {
        const flame = gameState.dragonFlameEffects[i];
        
        // パーティクル位置を更新
        flame.updatePositions();
        
        // エフェクトの寿命が切れたら削除
        if (flame.currentLife >= flame.lifetime) {
            // frustumCulledを元に戻してから削除
            flame.particles.frustumCulled = true;
            scene.remove(flame.particles);
            flame.geometry.dispose();
            flame.material.dispose();
            gameState.dragonFlameEffects.splice(i, 1);
            // console.log("ドラゴン炎エフェクト消滅、frustumCulledリセット");
        }
    }
} 