/**
 * 足元の煙エフェクトを生成するモジュール
 */
import * as THREE from 'three';

/**
 * 足元の煙エフェクトを生成する関数
 * @param {Object} gameState - ゲームの状態オブジェクト
 * @param {THREE.Scene} scene - Three.jsのシーンオブジェクト
 * @returns {Object} 生成された煙エフェクトオブジェクト
 */
export function createDustEffect(gameState, scene) {
    if (!gameState.playerModel) return;
    
    // プレイヤーの位置を取得
    const playerPosition = gameState.playerPosition.clone();
    
    // 煙の発生位置（プレイヤーの足元）
    const dustOrigin = new THREE.Vector3(
        playerPosition.x,
        playerPosition.y + 0.02, // 地面のわずかに上（より低く）
        playerPosition.z
    );
    
    // パーティクルのジオメトリ
    const particleCount = gameState.dustParticleCount;
    const particleGeometry = new THREE.BufferGeometry();
    
    // パーティクルの初期位置
    const positions = new Float32Array(particleCount * 3); // xyz
    const velocities = new Float32Array(particleCount * 3); // xyz速度
    const lifetimes = new Float32Array(particleCount); // 寿命
    const scales = new Float32Array(particleCount); // サイズ
    const colors = new Float32Array(particleCount * 3); // RGB色
    
    // 煙のパーティクルを生成
    for (let i = 0; i < particleCount; i++) {
        // インデックス計算
        const i3 = i * 3;
        
        // ランダムな広がり（円形に）- 範囲を小さく
        const angle = Math.random() * Math.PI * 2; // 全方向に広がるように修正
        const radius = Math.random() * 0.1; // 広がりの半径を小さく
        
        // 位置を設定（プレイヤーの足元を中心に円形に広がる）
        positions[i3] = dustOrigin.x + Math.cos(angle) * radius;
        positions[i3 + 1] = dustOrigin.y;
        positions[i3 + 2] = dustOrigin.z + Math.sin(angle) * radius;
        
        // 速度を設定（上方向と横方向にランダムに広がる）- 速度を抑える
        const upSpeed = 0.005 + Math.random() * 0.01; // 上昇速度を遅く
        const sideSpeed = 0.002 + Math.random() * 0.005; // 横方向の速度を遅く
        
        velocities[i3] = Math.cos(angle) * sideSpeed;
        velocities[i3 + 1] = upSpeed;
        velocities[i3 + 2] = Math.sin(angle) * sideSpeed;
        
        // サイズを設定（ランダムに変化）
        scales[i] = gameState.dustSize * (0.6 + Math.random() * 0.4);
        
        // 寿命を設定（ランダムに変化）
        lifetimes[i] = gameState.dustLifetime * (0.6 + Math.random() * 0.4);
        
        // 色を設定（薄い灰色〜茶色）- よりはっきりした色に
        const grayness = 0.75 + Math.random() * 0.15; // 灰色の度合い
        const brownness = Math.random() * 0.15; // 茶色の度合い
        
        colors[i3] = grayness + brownness * 0.3; // R
        colors[i3 + 1] = grayness + brownness * 0.2; // G
        colors[i3 + 2] = grayness; // B
    }
    
    // バッファーアトリビュートとしてジオメトリに追加
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    particleGeometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
    particleGeometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // 煙用のテクスチャを作成
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    
    // 煙のパーティクル用のグラデーション - よりシャープに
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)'); // 中心はより不透明に
    gradient.addColorStop(0.2, 'rgba(240, 240, 240, 0.8)'); // 内側はより不透明に
    gradient.addColorStop(0.5, 'rgba(220, 220, 220, 0.5)'); // 中間部分
    gradient.addColorStop(0.8, 'rgba(200, 200, 200, 0.2)'); // 外側
    gradient.addColorStop(1, 'rgba(180, 180, 180, 0)'); // 端は透明に
    
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(32, 32, 32, 0, Math.PI * 2);
    context.fill();
    
    // パーティクル用マテリアル
    const particleMaterial = new THREE.PointsMaterial({
        size: gameState.dustSize,
        map: new THREE.CanvasTexture(canvas),
        blending: THREE.NormalBlending,
        transparent: true,
        depthWrite: false,
        vertexColors: true // 色を有効に
    });
    
    // パーティクルシステムを作成
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.frustumCulled = false;
    
    // 煙エフェクトの情報を保存
    const dustEffect = {
        particles: particles,
        geometry: particleGeometry,
        material: particleMaterial,
        lifetime: gameState.dustLifetime,
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
                lifetimes[i] -= 1;
                
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
                
                // 揺らめき効果を追加（速度に小さなランダム変動を加える）- より小さく
                velocities[i3] += (Math.random() - 0.5) * 0.0005;
                velocities[i3 + 2] += (Math.random() - 0.5) * 0.0005;
                
                // 寿命に応じてサイズを調整（時間経過で大きくなり、消える際に小さくなる）
                const lifeRatio = lifetimes[i] / gameState.dustLifetime;
                if (lifeRatio > 0.8) {
                    // 初期段階では少しだけ大きくなる
                    scales[i] *= 1.005;
                } else if (lifeRatio < 0.3) {
                    // 消える際に小さくなる
                    scales[i] *= 0.97;
                }
                
                // 寿命に応じて透明度を調整（色の明るさを下げる）
                if (lifeRatio < 0.5) {
                    // 徐々に薄くなる
                    colors[i3] *= 0.99;
                    colors[i3 + 1] *= 0.99;
                    colors[i3 + 2] *= 0.99;
                }
            }
            
            // バッファを更新
            this.geometry.attributes.position.needsUpdate = true;
            this.geometry.attributes.scale.needsUpdate = true;
            this.geometry.attributes.color.needsUpdate = true;
            
            // エフェクト全体の寿命を更新
            this.currentLife++;
        }
    };
    
    // シーンに追加
    scene.add(particles);
    
    // エフェクトを管理リストに追加
    gameState.dustEffects.push(dustEffect);
    
    return dustEffect;
} 