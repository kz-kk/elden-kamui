/**
 * 地形対応ドラゴン炎エフェクト
 * 地面の凹凸に沿って広がる炎エフェクトを実装
 */
import * as THREE from 'three';

/**
 * 地形対応炎エフェクトを生成する関数
 * @param {Object} gameState - ゲームの状態を管理するオブジェクト
 * @param {THREE.Scene} scene - Three.jsのシーンオブジェクト
 * @param {THREE.Vector3} origin - 炎の発生源の位置
 * @param {THREE.Vector3} targetPos - 炎の飛行先の位置
 * @returns {Object} 生成された炎エフェクトオブジェクト
 */
export function createTerrainAwareDragonFlame(gameState, scene, origin, targetPos) {
    const particleCount = gameState.groundFireParticleCount || 120;
    const particleGeometry = new THREE.BufferGeometry();
    
    // パーティクルの初期化データ
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);
    const lifetimes = new Float32Array(particleCount);
    const isGroundFlame = new Float32Array(particleCount); // 地面に到達した炎かどうか
    const groundHeights = new Float32Array(particleCount); // 地面高度をキャッシュ
    const terrainUpdateTimers = new Float32Array(particleCount); // 地形更新タイマー
    
    // 発射元から目標までの方向ベクトルを計算
    const direction = new THREE.Vector3().subVectors(targetPos, origin).normalize();
    const distance = origin.distanceTo(targetPos);
    
    // パーティクルの初期化
    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        
        // 発射元からわずかにずらした位置に配置
        const spread = 0.8;
        positions[i3] = origin.x + (Math.random() - 0.5) * spread;
        positions[i3 + 1] = origin.y + (Math.random() - 0.5) * spread;
        positions[i3 + 2] = origin.z + (Math.random() - 0.5) * spread;
        
        // 目標方向に向かう速度を設定
        const speed = 0.15 + Math.random() * 0.1; // 速度のランダム化
        const directionVariation = 0.3; // 方向のばらつき
        
        velocities[i3] = direction.x * speed + (Math.random() - 0.5) * directionVariation;
        velocities[i3 + 1] = direction.y * speed + (Math.random() - 0.5) * directionVariation;
        velocities[i3 + 2] = direction.z * speed + (Math.random() - 0.5) * directionVariation;
        
        // サイズの設定
        scales[i] = gameState.groundFireSize * (0.8 + Math.random() * 0.4);
        
        // 色の設定（赤からオレンジのグラデーション）
        colors[i3] = 1.0;     // R
        colors[i3 + 1] = 0.3 + Math.random() * 0.4; // G
        colors[i3 + 2] = 0.0; // B
        
        // ライフタイムの設定
        lifetimes[i] = gameState.groundFireLifetime * (0.8 + Math.random() * 0.4);
        
        // 初期状態は空中の炎
        isGroundFlame[i] = 0;
        groundHeights[i] = gameState.groundLevel; // 初期値は固定地面
        terrainUpdateTimers[i] = 0;
    }
    
    // ジオメトリにアトリビュートを設定
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
    
    // パーティクル用のテクスチャを作成（炎のような形状）
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    
    // 炎のような形のグラデーション
    const gradient = context.createRadialGradient(32, 48, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, 'rgba(255, 200, 100, 1)');
    gradient.addColorStop(0.4, 'rgba(255, 100, 50, 0.8)');
    gradient.addColorStop(0.8, 'rgba(200, 50, 0, 0.4)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(32, 48, 32, 0, Math.PI * 2); // 下の方が中心になるような円
    context.fill();
    
    // パーティクル用マテリアル
    const particleMaterial = new THREE.PointsMaterial({
        size: gameState.groundFireSize * 10,
        map: new THREE.CanvasTexture(canvas),
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        vertexColors: true,
        opacity: 0.8
    });
    
    // パーティクルシステムを作成
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.frustumCulled = false; // 画面外でも更新を続行
    scene.add(particles);
    
    // エフェクトデータの保存
    const flameEffect = {
        particles,
        geometry: particleGeometry,
        material: particleMaterial,
        particleCount,
        origin: origin.clone(),
        target: targetPos.clone(),
        lifetime: gameState.groundFireLifetime || 180,
        maxLifetime: gameState.groundFireLifetime || 180,
        
        // パーティクルデータ
        positions,
        velocities,
        colors,
        scales,
        lifetimes,
        isGroundFlame,
        groundHeights,
        terrainUpdateTimers,
        
        // 地形対応更新関数
        updatePositions: function() {
            this.lifetime--;
            
            for (let i = 0; i < this.particleCount; i++) {
                const i3 = i * 3;
                this.lifetimes[i]--;
                
                if (this.lifetimes[i] <= 0) {
                    // 寿命が尽きた場合は再初期化
                    this.resetParticle(i);
                    continue;
                }
                
                // 地面に到達していない炎の処理
                if (!this.isGroundFlame[i]) {
                    // 通常の移動
                    this.positions[i3] += this.velocities[i3];
                    this.positions[i3 + 1] += this.velocities[i3 + 1];
                    this.positions[i3 + 2] += this.velocities[i3 + 2];
                    
                    // 重力の適用
                    this.velocities[i3 + 1] -= 0.008;
                    
                    // 地面到達判定（地形高度を取得）
                    const terrainHeight = gameState.chunkManager ? 
                        gameState.chunkManager.getHeightAtPosition(this.positions[i3], this.positions[i3 + 2]) : 0;
                    const groundY = -5.0 + terrainHeight;
                    
                    if (this.positions[i3 + 1] <= groundY + 0.2) {
                        // 地面に到達
                        this.isGroundFlame[i] = 1;
                        this.positions[i3 + 1] = groundY + 0.1;
                        this.groundHeights[i] = groundY; // 高度をキャッシュ
                        this.terrainUpdateTimers[i] = 0; // 更新タイマーリセット
                        
                        // 地面での横方向の広がり速度を設定
                        this.velocities[i3] = (Math.random() - 0.5) * 0.08;
                        this.velocities[i3 + 1] = Math.random() * 0.02;
                        this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.08;
                    }
                } else {
                    // 地面に到達した炎の処理
                    // 地形高度の定期的な更新（パフォーマンス考慮で3フレームごと）
                    this.terrainUpdateTimers[i]++;
                    if (this.terrainUpdateTimers[i] >= 3) {
                        if (gameState.chunkManager) {
                            const terrainHeight = gameState.chunkManager.getHeightAtPosition(
                                this.positions[i3], this.positions[i3 + 2]
                            );
                            this.groundHeights[i] = -5.0 + terrainHeight;
                        }
                        this.terrainUpdateTimers[i] = 0;
                    }
                    
                    // 地面に沿った移動
                    this.positions[i3] += this.velocities[i3];
                    this.positions[i3 + 2] += this.velocities[i3 + 2];
                    
                    // Y座標を地面高度に合わせる
                    this.positions[i3 + 1] = this.groundHeights[i] + 0.1 + Math.random() * 0.05;
                    
                    // 減速効果
                    this.velocities[i3] *= 0.98;
                    this.velocities[i3 + 2] *= 0.98;
                }
                
                // 色のフェード効果
                const lifeRatio = this.lifetimes[i] / (gameState.groundFireLifetime || 180);
                this.colors[i3] = 1.0 * lifeRatio;
                this.colors[i3 + 1] = (0.3 + Math.random() * 0.4) * lifeRatio;
                this.colors[i3 + 2] = 0.0;
            }
            
            // アトリビュートの更新
            this.geometry.attributes.position.needsUpdate = true;
            this.geometry.attributes.color.needsUpdate = true;
            
            return this.lifetime > 0;
        },
        
        // パーティクルリセット関数
        resetParticle: function(index) {
            const i3 = index * 3;
            const spread = 0.8;
            
            this.positions[i3] = this.origin.x + (Math.random() - 0.5) * spread;
            this.positions[i3 + 1] = this.origin.y + (Math.random() - 0.5) * spread;
            this.positions[i3 + 2] = this.origin.z + (Math.random() - 0.5) * spread;
            
            const direction = new THREE.Vector3().subVectors(this.target, this.origin).normalize();
            const speed = 0.15 + Math.random() * 0.1;
            const directionVariation = 0.3;
            
            this.velocities[i3] = direction.x * speed + (Math.random() - 0.5) * directionVariation;
            this.velocities[i3 + 1] = direction.y * speed + (Math.random() - 0.5) * directionVariation;
            this.velocities[i3 + 2] = direction.z * speed + (Math.random() - 0.5) * directionVariation;
            
            this.lifetimes[index] = gameState.groundFireLifetime * (0.8 + Math.random() * 0.4);
            this.isGroundFlame[index] = 0;
            this.terrainUpdateTimers[index] = 0;
        },
        
        // 破棄関数
        dispose: function() {
            scene.remove(this.particles);
            this.geometry.dispose();
            this.material.dispose();
        }
    };
    
    return flameEffect;
}

/**
 * 地形対応炎エフェクト配列を更新する関数
 * @param {Array} flameEffects - 炎エフェクトの配列
 * @param {THREE.Scene} scene - Three.jsのシーンオブジェクト
 */
export function updateTerrainAwareDragonFlames(flameEffects, scene) {
    for (let i = flameEffects.length - 1; i >= 0; i--) {
        const flame = flameEffects[i];
        
        // 炎エフェクトを更新
        const isAlive = flame.updatePositions();
        
        if (!isAlive) {
            // 寿命が尽きた炎エフェクトを削除
            flame.dispose();
            flameEffects.splice(i, 1);
        }
    }
}