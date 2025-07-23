import * as THREE from 'three';

/**
 * 地面の炎エフェクトを生成する関数
 * @param {Object} gameState - ゲームの状態を管理するオブジェクト
 * @param {THREE.Scene} scene - Three.jsのシーンオブジェクト
 * @param {THREE.Vector3} position - 炎エフェクトの生成位置
 * @returns {Object} 生成された炎エフェクトオブジェクト
 */
export function createGroundFireEffect(gameState, scene, position) {
    // 炎の発生位置（地面の高さに合わせる）
    const fireOrigin = new THREE.Vector3(
        position.x,
        gameState.groundLevel + 0.05, // 地面のわずかに上
        position.z
    );
    
    // パーティクルのジオメトリ
    const particleCount = gameState.groundFireParticleCount;
    const particleGeometry = new THREE.BufferGeometry();
    
    // パーティクルの初期位置
    const positions = new Float32Array(particleCount * 3); // xyz
    const velocities = new Float32Array(particleCount * 3); // xyz速度
    const lifetimes = new Float32Array(particleCount); // 寿命
    const scales = new Float32Array(particleCount); // サイズ
    const colors = new Float32Array(particleCount * 3); // RGB色
    const rotations = new Float32Array(particleCount); // 回転角度
    const rotationSpeeds = new Float32Array(particleCount); // 回転速度
    
    // 炎のパーティクルを生成
    for (let i = 0; i < particleCount; i++) {
        // インデックス計算
        const i3 = i * 3;
        
        // 地面の炎は円形に広がる
        const radius = Math.random() * gameState.groundFireSpreadRadius;
        const angle = Math.random() * Math.PI * 2;
        
        // 位置を設定（円形に分布）
        positions[i3] = fireOrigin.x + Math.cos(angle) * radius;
        positions[i3 + 1] = fireOrigin.y + Math.random() * gameState.groundFireHeight; // 高さはランダム
        positions[i3 + 2] = fireOrigin.z + Math.sin(angle) * radius;
        
        // 速度は上向きを基本に、わずかにランダム性を持たせる
        velocities[i3] = (Math.random() - 0.5) * 0.03; // X方向
        velocities[i3 + 1] = 0.01 + Math.random() * 0.04; // Y方向（上向き）
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.03; // Z方向
        
        // サイズはランダム
        scales[i] = gameState.groundFireSize * (0.5 + Math.random() * 0.8);
        
        // 寿命もランダム
        lifetimes[i] = gameState.groundFireLifetime * (0.3 + Math.random() * 0.7);
        
        // 回転角度と回転速度を設定
        rotations[i] = Math.random() * Math.PI * 2;
        rotationSpeeds[i] = (Math.random() - 0.5) * 0.05;
        
        // 炎の色（赤〜オレンジ〜黄色）
        const colorRandom = Math.random();
        if (colorRandom < 0.3) {
            // 赤っぽい色
            colors[i3] = 0.95;     // R
            colors[i3 + 1] = 0.1 + Math.random() * 0.2;  // G
            colors[i3 + 2] = 0.0;  // B
        } else if (colorRandom < 0.7) {
            // オレンジっぽい色
            colors[i3] = 0.95;     // R
            colors[i3 + 1] = 0.3 + Math.random() * 0.3;  // G
            colors[i3 + 2] = 0.0 + Math.random() * 0.1;  // B
        } else {
            // 黄色っぽい色
            colors[i3] = 0.95;  // R
            colors[i3 + 1] = 0.6 + Math.random() * 0.3;  // G
            colors[i3 + 2] = 0.1 + Math.random() * 0.2;  // B
        }
    }
    
    // バッファーアトリビュートとしてジオメトリに追加
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    particleGeometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
    particleGeometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeometry.setAttribute('rotation', new THREE.BufferAttribute(rotations, 1));
    particleGeometry.setAttribute('rotationSpeed', new THREE.BufferAttribute(rotationSpeeds, 1));
    
    // 炎用のテクスチャを作成
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    
    // 炎のパーティクル用のグラデーション
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)'); // 中心は白
    gradient.addColorStop(0.1, 'rgba(255, 255, 220, 1)'); // 内側は明るい黄色
    gradient.addColorStop(0.3, 'rgba(255, 200, 50, 0.9)'); // 黄色
    gradient.addColorStop(0.5, 'rgba(255, 120, 20, 0.8)'); // オレンジ
    gradient.addColorStop(0.7, 'rgba(255, 60, 0, 0.6)'); // 赤
    gradient.addColorStop(1, 'rgba(180, 30, 0, 0)'); // 端は透明に
    
    // 基本の円形グラデーション
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(64, 64, 64, 0, Math.PI * 2);
    context.fill();
    
    // 炎の形状を強調するためのノイズパターンを追加
    context.globalCompositeOperation = 'overlay';
    for (let i = 0; i < 15; i++) {
        const x = Math.random() * 128;
        const y = Math.random() * 128;
        const radius = 5 + Math.random() * 15;
        const glow = context.createRadialGradient(x, y, 0, x, y, radius);
        glow.addColorStop(0, 'rgba(255, 200, 50, 0.4)');
        glow.addColorStop(1, 'rgba(255, 100, 0, 0)');
        context.fillStyle = glow;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
    }
    
    // パーティクル用マテリアル
    const particleMaterial = new THREE.PointsMaterial({
        size: gameState.groundFireSize,
        map: new THREE.CanvasTexture(canvas),
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        vertexColors: true // 色を有効に
    });
    
    // パーティクルシステムを作成
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.frustumCulled = false;
    
    // 炎エフェクトの情報を保存
    const fireEffect = {
        particles: particles,
        geometry: particleGeometry,
        material: particleMaterial,
        lifetime: gameState.groundFireLifetime,
        currentLife: 0,
        position: fireOrigin.clone(),
        updatePositions: function() {
            // パーティクルの位置を更新
            const positions = this.geometry.attributes.position.array;
            const velocities = this.geometry.attributes.velocity.array;
            const lifetimes = this.geometry.attributes.lifetime.array;
            const scales = this.geometry.attributes.scale.array;
            const colors = this.geometry.attributes.color.array;
            const rotations = this.geometry.attributes.rotation.array;
            const rotationSpeeds = this.geometry.attributes.rotationSpeed.array;
            
            // エフェクト全体の寿命に応じた強度係数
            let lifeRatio = this.currentLife / this.lifetime;
            lifeRatio = Math.min(1, lifeRatio);
            
            // ライフサイクルに基づく強度曲線
            let intensityFactor;
            if (lifeRatio < 0.1) {
                // 素早く現れる（0-10%）
                intensityFactor = lifeRatio * 10;
            } else if (lifeRatio > 0.8) {
                // ゆっくりフェードアウト（80-100%）
                intensityFactor = 1 - ((lifeRatio - 0.8) / 0.2);
            } else {
                // 最大強度を維持（10-80%）
                intensityFactor = 1;
            }
            
            // パーティクルごとの更新
            for (let i = 0; i < particleCount; i++) {
                const i3 = i * 3;
                
                // 寿命を減らす
                lifetimes[i] -= 1;
                
                // 寿命が切れたパーティクルは再利用
                if (lifetimes[i] <= 0) {
                    // 新しいパーティクルとして再生成
                    this.resetParticle(i, i3);
                    continue;
                }
                
                // パーティクルの動きを更新（位置 += 速度）
                positions[i3] += velocities[i3];
                positions[i3 + 1] += velocities[i3 + 1];
                positions[i3 + 2] += velocities[i3 + 2];
                
                // 回転を更新
                rotations[i] += rotationSpeeds[i];
                
                // 揺らめき効果を追加
                const flicker = Math.sin(this.currentLife * 0.1 + i * 0.5) * 0.01;
                velocities[i3] += (Math.random() - 0.5) * 0.01 + flicker;
                velocities[i3 + 2] += (Math.random() - 0.5) * 0.01 + flicker;
                
                // 上昇する炎の動きを表現（熱による上昇）
                const heatRise = Math.random() * 0.003;
                velocities[i3 + 1] += heatRise;
                
                // 炎の渦巻き効果（螺旋状の動き）
                const swirl = 0.003;
                const swirlX = -velocities[i3 + 2] * swirl;
                const swirlZ = velocities[i3] * swirl;
                velocities[i3] += swirlX;
                velocities[i3 + 2] += swirlZ;
                
                // 寿命に応じてサイズと色を調整
                const particleLifeRatio = lifetimes[i] / (gameState.groundFireLifetime * 0.7);
                
                // 消える際にサイズを小さく
                if (particleLifeRatio < 0.3) {
                    scales[i] *= 0.97;
                    
                    // 消える際に色も変化（より暗く、赤みを増す）
                    colors[i3] *= 0.99; // R
                    colors[i3 + 1] *= 0.95; // G（緑が早く減少）
                    colors[i3 + 2] *= 0.95; // B（青も早く減少）
                }
                
                // 炎の脈動効果（サイズが周期的に変化）
                const pulseFactor = 1.0 + Math.sin(this.currentLife * 0.05 + i * 0.2) * 0.05;
                scales[i] *= pulseFactor;
            }
            
            // バッファを更新
            this.geometry.attributes.position.needsUpdate = true;
            this.geometry.attributes.scale.needsUpdate = true;
            this.geometry.attributes.lifetime.needsUpdate = true;
            this.geometry.attributes.color.needsUpdate = true;
            this.geometry.attributes.rotation.needsUpdate = true;
            
            // エフェクト全体の寿命を更新
            this.currentLife++;
        },
        
        // パーティクルを初期状態にリセットする関数
        resetParticle: function(i, i3) {
            // 全体のライフサイクルが70%を超えたら再生成しない（自然に消えていくため）
            if (this.currentLife / this.lifetime > 0.7) {
                // 画面外に移動
                this.geometry.attributes.position.array[i3] = 2000;
                this.geometry.attributes.position.array[i3 + 1] = 2000;
                this.geometry.attributes.position.array[i3 + 2] = 2000;
                return;
            }
            
            // ドラゴンの位置と向きを取得
            const dragonPosition = gameState.dragonModel.position.clone();
            const dragonRotation = gameState.dragonModel.rotation.y;
            
            // ドラゴンの前方向を計算
            const forwardX = Math.sin(dragonRotation);
            const forwardZ = Math.cos(dragonRotation);
            
            // 炎の発射位置（ドラゴンの口の位置）
            const flameOrigin = new THREE.Vector3(
                dragonPosition.x + forwardX * 3, // ドラゴンの頭部前方
                dragonPosition.y + 5, // ドラゴンの口の高さ
                dragonPosition.z + forwardZ * 3
            );
            
            // 炎の方向ベクトル（口から前方下向きに）
            const flameDirection = new THREE.Vector3(forwardX * 0.7, -0.5, forwardZ * 0.7).normalize();
            
            // 横方向のベクトル
            const sideDirection = new THREE.Vector3(-flameDirection.z, 0, flameDirection.x);
            
            // セグメント情報を取得
            const segment = this.geometry.attributes.segment.array[i];
            
            // セグメントに基づく角度を計算
            const segmentAngle = (segment / 8) * Math.PI * 2;
            const angleVariation = (Math.PI * 2) / 16;
            const angle = segmentAngle + (Math.random() * angleVariation * 2 - angleVariation);
            
            // 初期位置を再設定（炎の根元付近）- より集中した噴出口
            const width = Math.random() * 0.6; // 根元は狭め
            const offsetX = Math.cos(angle) * width;
            
            // Y方向のオフセットを小さくする（地面に沿った帯状の炎に）
            const offsetY = Math.sin(angle) * width * 0.2;
            
            // 位置を設定
            this.geometry.attributes.position.array[i3] = flameOrigin.x + sideDirection.x * offsetX;
            this.geometry.attributes.position.array[i3 + 1] = flameOrigin.y + offsetY;
            this.geometry.attributes.position.array[i3 + 2] = flameOrigin.z + sideDirection.z * offsetX;
            
            // 速度を再設定 - セグメントに基づく一貫性
            const forwardSpeed = gameState.dragonFlameSpeed * (0.8 + Math.random() * 0.4);
            
            // 下方向への速度（重力効果）- 地面に沿って広がるように調整
            const downSpeed = 0.1 * (0.4 + Math.random() * 0.6);
            
            // 地面に沿って広がるための水平方向の速度ブースト
            const horizontalBoost = 0.05;
            
            // 速度にわずかなランダム性を追加
            this.geometry.attributes.velocity.array[i3] = flameDirection.x * (forwardSpeed + horizontalBoost) + (Math.random() - 0.5) * 0.04;
            this.geometry.attributes.velocity.array[i3 + 1] = flameDirection.y * downSpeed;
            this.geometry.attributes.velocity.array[i3 + 2] = flameDirection.z * (forwardSpeed + horizontalBoost) + (Math.random() - 0.5) * 0.04;
            
            // 寿命を再設定 - より変動のある寿命
            this.geometry.attributes.lifetime.array[i] = gameState.dragonFlameLifetime * (0.3 + Math.random() * 0.7);
            
            // サイズを再設定 - より変動のあるサイズ
            this.geometry.attributes.scale.array[i] = gameState.dragonFlameSize * (0.7 + Math.random() * 0.6);
            
            // 回転を再設定
            this.geometry.attributes.rotation.array[i] = segmentAngle + Math.random() * 0.2;
            this.geometry.attributes.rotationSpeed.array[i] = (Math.random() - 0.5) * 0.03;
            
            // 色を設定（根元は濃い赤）
            this.geometry.attributes.color.array[i3] = 0.95; // R
            this.geometry.attributes.color.array[i3 + 1] = 0.05 + Math.random() * 0.1; // G
            this.geometry.attributes.color.array[i3 + 2] = 0.0; // B
        }
    };
    
    // シーンに追加
    scene.add(particles);
    
    // エフェクトを管理リストに追加
    gameState.groundFireEffects.push(fireEffect);
    
    return fireEffect;
} 