import * as THREE from 'three';

/**
 * 黄色い粒子エフェクトを生成する関数
 * @param {Object} gameState - ゲームの状態を管理するオブジェクト
 * @param {THREE.Scene} scene - Three.jsのシーンオブジェクト
 * @returns {void}
 */
export function createYellowParticleEffect(gameState, scene) {
    // 既存のエフェクトをクリア
    if (gameState.yellowParticleEffects) {
        gameState.yellowParticleEffects.forEach(effect => {
            if (effect.particles) {
                scene.remove(effect.particles);
                effect.geometry.dispose();
                effect.material.dispose();
            }
        });
    }
    gameState.yellowParticleEffects = [];
    
    // ドラゴンの位置を取得（安全に）
    let dragonPosition;
    if (gameState.dragonModel) {
        dragonPosition = gameState.dragonModel.position.clone();
        gameState.dragonPosition = dragonPosition.clone();
    } else {
        dragonPosition = new THREE.Vector3(0, 0, 0);
    }
    
    // 複数の柱を同時に生成
    for (let column = 0; column < gameState.yellowParticleColumns; column++) {
        // 配置場所を決定
        let particleOrigin;
        let columnHeight = 1000; // より自然な高さに調整
        
        // 4つの魔法陣エリアに対応する位置に配置
        switch (column) {
            case 0:
                particleOrigin = new THREE.Vector3(10, gameState.groundLevel, 0);   // area1
                break;
            case 1:
                particleOrigin = new THREE.Vector3(-10, gameState.groundLevel, 0);  // area2
                break;
            case 2:
                particleOrigin = new THREE.Vector3(0, gameState.groundLevel, 10);   // area3
                break;
            case 3:
                particleOrigin = new THREE.Vector3(0, gameState.groundLevel, -10);  // area4
                break;
            default:
                particleOrigin = new THREE.Vector3(0, gameState.groundLevel, 0);
                break;
        }
        
        // パーティクルのジオメトリ
        const particleGeometry = new THREE.BufferGeometry();
        const particlesPerColumn = Math.floor(gameState.yellowParticleCount / gameState.yellowParticleColumns);
        
        // パーティクルの初期化データ
        const positions = new Float32Array(particlesPerColumn * 3);
        const velocities = new Float32Array(particlesPerColumn * 3);
        const colors = new Float32Array(particlesPerColumn * 3);
        const scales = new Float32Array(particlesPerColumn);
        
        // 柱の設定
        const columnWidth = 1.0; // より太い柱
        
        // パーティクルの初期化
        for (let i = 0; i < particlesPerColumn; i++) {
            const i3 = i * 3;
            
            // 初期位置の設定（地面から）
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * columnWidth;
            
            positions[i3] = particleOrigin.x + Math.cos(angle) * radius;
            positions[i3 + 1] = particleOrigin.y;
            positions[i3 + 2] = particleOrigin.z + Math.sin(angle) * radius;
            
            // 速度の設定（上向きを基本に）
            const baseUpSpeed = 0.1 + Math.random() * 0.2;
            velocities[i3] = (Math.random() - 0.5) * 0.05;
            velocities[i3 + 1] = baseUpSpeed;
            velocities[i3 + 2] = (Math.random() - 0.5) * 0.05;
            
            // サイズの設定
            scales[i] = gameState.yellowParticleSize * (0.5 + Math.random() * 0.5);
            
            // 色の設定（黄色のグラデーション）
            colors[i3] = 1.0;     // R
            colors[i3 + 1] = 0.8; // G
            colors[i3 + 2] = 0.2; // B
        }
        
        // ジオメトリにアトリビュートを設定
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        particleGeometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
        
        // パーティクル用のテクスチャを作成
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const context = canvas.getContext('2d');
        
        // グラデーションの作成
        const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(255, 255, 128, 1)');
        gradient.addColorStop(0.4, 'rgba(255, 255, 0, 1)');
        gradient.addColorStop(0.6, 'rgba(255, 128, 0, 0.8)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(64, 64, 64, 0, Math.PI * 2);
        context.fill();
        
        // パーティクル用マテリアル
        const particleMaterial = new THREE.PointsMaterial({
            size: gameState.yellowParticleSize * 2,
            map: new THREE.CanvasTexture(canvas),
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false,
            vertexColors: true,
            opacity: 0.6
        });
        
        // パーティクルシステムを作成
        const particles = new THREE.Points(particleGeometry, particleMaterial);
        particles.frustumCulled = false;
        
        // エフェクトデータの保存
        const yellowEffect = {
            particles,
            geometry: particleGeometry,
            material: particleMaterial,
            maxHeight: columnHeight,
            particleCount: particlesPerColumn,
            origin: particleOrigin.clone(),
            
            // パーティクルデータ
            positions,
            velocities,
            colors,
            scales,
            
            // 更新関数
            updatePositions: function() {
                const positions = this.positions;
                const velocities = this.velocities;
                const colors = this.colors;
                
                for (let i = 0; i < this.particleCount; i++) {
                    const i3 = i * 3;
                    
                    // 高さが一定以上になったら地面に戻す
                    if (positions[i3 + 1] > this.origin.y + this.maxHeight) {
                        // 新しい開始位置を設定
                        const angle = Math.random() * Math.PI * 2;
                        const radius = Math.random() * columnWidth;
                        
                        positions[i3] = this.origin.x + Math.cos(angle) * radius;
                        positions[i3 + 1] = this.origin.y;
                        positions[i3 + 2] = this.origin.z + Math.sin(angle) * radius;
                        
                        // 新しい速度を設定
                        const baseUpSpeed = 0.1 + Math.random() * 0.2;
                        velocities[i3] = (Math.random() - 0.5) * 0.05;
                        velocities[i3 + 1] = baseUpSpeed;
                        velocities[i3 + 2] = (Math.random() - 0.5) * 0.05;
                        
                        // 色をリセット
                        colors[i3] = 1.0;
                        colors[i3 + 1] = 0.8;
                        colors[i3 + 2] = 0.2;
                        
                        continue;
                    }
                    
                    // 位置の更新
                    positions[i3] += velocities[i3];
                    positions[i3 + 1] += velocities[i3 + 1];
                    positions[i3 + 2] += velocities[i3 + 2];
                    
                    // 中心に向かう力を適用
                    const dx = positions[i3] - this.origin.x;
                    const dz = positions[i3 + 2] - this.origin.z;
                    const distanceFromCenter = Math.sqrt(dx * dx + dz * dz);
                    
                    if (distanceFromCenter > 0.1) {
                        const pullStrength = 0.02;
                        velocities[i3] -= (dx / distanceFromCenter) * pullStrength;
                        velocities[i3 + 2] -= (dz / distanceFromCenter) * pullStrength;
                    }
                    
                    // 上昇に伴う色の変化
                    const heightRatio = (positions[i3 + 1] - this.origin.y) / this.maxHeight;
                    const fade = Math.max(0.2, 1.0 - heightRatio);
                    colors[i3] = 1.0 * fade;
                    colors[i3 + 1] = 0.8 * fade;
                    colors[i3 + 2] = 0.2 * fade;
                }
                
                // ジオメトリの更新
                this.geometry.attributes.position.needsUpdate = true;
                this.geometry.attributes.color.needsUpdate = true;
                
                return true;
            }
        };
        
        // シーンに追加
        scene.add(particles);
        
        // エフェクトを管理リストに追加
        gameState.yellowParticleEffects.push(yellowEffect);
    }
} 