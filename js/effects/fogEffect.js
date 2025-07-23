// 霧エフェクト関連の機能を提供するモジュール
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.137.0/build/three.module.js';

/**
 * 霧エフェクトを生成する関数
 * @param {Object} gameState - ゲームの状態オブジェクト
 * @param {THREE.Scene} scene - Three.jsのシーンオブジェクト
 * @returns {Object} 生成された霧エフェクトオブジェクト
 */
export function createFogEffect(gameState, scene) {
    // ランダムな位置を選択（シーン内のどこかに）
    const fogOrigin = new THREE.Vector3(
        (Math.random() - 0.5) * 80, // X座標の範囲を広げる
        0.02, // 地面により近く
        (Math.random() - 0.5) * 80  // Z座標の範囲を広げる
    );
    
    // パーティクルのジオメトリ
    const particleCount = gameState.fogParticleCount;
    const particleGeometry = new THREE.BufferGeometry();
    
    // パーティクルの初期位置
    const positions = new Float32Array(particleCount * 3); // xyz
    const velocities = new Float32Array(particleCount * 3); // xyz速度
    const lifetimes = new Float32Array(particleCount); // 寿命
    const scales = new Float32Array(particleCount); // サイズ
    const colors = new Float32Array(particleCount * 3);
    
    // 霧の広がり範囲
    const fogRadius = 15 + Math.random() * 20; // 15〜35の範囲に拡大
    
    // 霧のパーティクルを生成
    for (let i = 0; i < particleCount; i++) {
        // インデックス計算
        const i3 = i * 3;
        
        // ランダムな広がり（円形に）
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * fogRadius;
        
        // 位置を設定（中心から円形に広がる）
        positions[i3] = fogOrigin.x + Math.cos(angle) * radius;
        positions[i3 + 1] = fogOrigin.y + Math.random() * 0.2; // 高さをさらに低く抑える
        positions[i3 + 2] = fogOrigin.z + Math.sin(angle) * radius;
        
        // 速度を設定（非常にゆっくりと動く）
        const windDirection = Math.random() * Math.PI * 2; // ランダムな風向き
        const windSpeed = 0.0002 + Math.random() * 0.0005; // より遅い風速
        
        velocities[i3] = Math.cos(windDirection) * windSpeed;
        velocities[i3 + 1] = (Math.random() - 0.4) * 0.0001; // わずかな上下動、下方向に少し偏らせる
        velocities[i3 + 2] = Math.sin(windDirection) * windSpeed;
        
        // サイズを設定（ランダムに変化）
        scales[i] = gameState.fogSize * (0.5 + Math.random() * 0.8);
        
        // 寿命を設定（ランダムに変化）
        lifetimes[i] = gameState.fogLifetime * (0.7 + Math.random() * 0.6);
        
        // 色を設定（白〜薄い灰色）
        const whiteness = 0.85 + Math.random() * 0.15;
        
        colors[i3] = whiteness;     // R
        colors[i3 + 1] = whiteness; // G
        colors[i3 + 2] = whiteness; // B
    }
    
    // バッファーアトリビュートとしてジオメトリに追加
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    particleGeometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
    particleGeometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // 霧用のテクスチャを作成
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    
    // 霧のパーティクル用のグラデーション - より薄く
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.08)'); // 中心の透明度を上げる
    gradient.addColorStop(0.3, 'rgba(250, 250, 250, 0.06)'); // 内側
    gradient.addColorStop(0.6, 'rgba(240, 240, 240, 0.04)'); // 中間部分
    gradient.addColorStop(0.8, 'rgba(230, 230, 230, 0.02)'); // 外側
    gradient.addColorStop(1, 'rgba(220, 220, 220, 0)'); // 端は透明に
    
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(64, 64, 64, 0, Math.PI * 2);
    context.fill();
    
    // パーティクル用マテリアル
    const particleMaterial = new THREE.PointsMaterial({
        size: gameState.fogSize * 4, // より大きめのサイズ
        map: new THREE.CanvasTexture(canvas),
        blending: THREE.NormalBlending,
        transparent: true,
        depthWrite: false,
        vertexColors: true // 色を有効に
    });
    
    // パーティクルシステムを作成
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.frustumCulled = false;
    
    // 霧エフェクトの情報を保存
    const fogEffect = {
        particles: particles,
        geometry: particleGeometry,
        material: particleMaterial,
        lifetime: gameState.fogLifetime,
        currentLife: 0,
        updatePositions: function() {
            // パーティクルの位置を更新
            const positions = this.geometry.attributes.position.array;
            const velocities = this.geometry.attributes.velocity.array;
            const lifetimes = this.geometry.attributes.lifetime.array;
            const scales = this.geometry.attributes.scale.array;
            const colors = this.geometry.attributes.color.array;
            
            // パーティクルごとの更新
            for (let i = 0; i < particleCount; i++) {
                const i3 = i * 3;
                
                // 寿命を減らす
                lifetimes[i] -= 0.2; // よりゆっくり減少
                
                // 寿命が切れたパーティクルは非表示に
                if (lifetimes[i] <= 0) {
                    // 画面外に移動
                    positions[i3] = 2000;
                    positions[i3 + 1] = 2000;
                    positions[i3 + 2] = 2000;
                    continue;
                }
                
                // パーティクルの動きを更新（位置 += 速度）
                positions[i3] += velocities[i3];
                positions[i3 + 1] += velocities[i3 + 1];
                positions[i3 + 2] += velocities[i3 + 2];
                
                // 揺らめき効果を追加（速度に小さなランダム変動を加える）
                velocities[i3] += (Math.random() - 0.5) * 0.00005;
                velocities[i3 + 2] += (Math.random() - 0.5) * 0.00005;
                
                // 寿命に応じてサイズを調整
                const lifeRatio = lifetimes[i] / gameState.fogLifetime;
                if (lifeRatio > 0.9) {
                    // 初期段階ではゆっくり大きくなる
                    scales[i] *= 1.0005;
                } else if (lifeRatio < 0.1) {
                    // 消える際にゆっくり小さくなる
                    scales[i] *= 0.999;
                }
                
                // 寿命に応じて透明度を調整（色の明るさを下げる）
                if (lifeRatio < 0.2) {
                    // 徐々に薄くなる
                    colors[i3] *= 0.999;
                    colors[i3 + 1] *= 0.999;
                    colors[i3 + 2] *= 0.999;
                }
            }
            
            // バッファを更新
            this.geometry.attributes.position.needsUpdate = true;
            this.geometry.attributes.scale.needsUpdate = true;
            this.geometry.attributes.color.needsUpdate = true;
            
            // エフェクト全体の寿命を更新
            this.currentLife++;
            
            // エフェクト全体の寿命が尽きたら終了
            return this.currentLife < this.lifetime * 1.2;
        }
    };
    
    // シーンに追加
    scene.add(particles);
    
    // エフェクトを管理リストに追加
    gameState.fogEffects.push(fogEffect);
    
    return fogEffect;
}

/**
 * 霧エフェクトを更新する関数
 * @param {Object} gameState - ゲームの状態オブジェクト
 * @param {THREE.Scene} scene - Three.jsのシーンオブジェクト
 */
export function updateFogEffects(gameState, scene) {
    // 霧エフェクトの生成タイミング管理
    gameState.fogSpawnTimer++;
    if (gameState.fogSpawnTimer > gameState.fogSpawnInterval) {
        createFogEffect(gameState, scene);
        gameState.fogSpawnTimer = 0;
        // 次の霧生成までの間隔をランダムに変更（バリエーションを持たせる）
        gameState.fogSpawnInterval = 300 + Math.floor(Math.random() * 200);
    }
    
    // 既存の霧エフェクトを更新
    for (let i = 0; i < gameState.fogEffects.length; i++) {
        const isAlive = gameState.fogEffects[i].updatePositions();
        if (!isAlive) {
            // エフェクトの寿命が尽きたら削除
            scene.remove(gameState.fogEffects[i].particles);
            gameState.fogEffects[i].geometry.dispose();
            gameState.fogEffects[i].material.dispose();
            gameState.fogEffects.splice(i, 1);
            i--; // インデックスを調整
        }
    }
} 