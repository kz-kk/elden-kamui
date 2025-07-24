import * as THREE from 'three';

/**
 * 魔法陣のテクスチャを生成する関数
 * @returns {THREE.Texture} 生成されたテクスチャ
 */
function createMagicCircleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    
    // 背景を透明に
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // 中心点
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // 外側の円
    context.strokeStyle = 'rgba(255, 215, 0, 0.8)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(centerX, centerY, 120, 0, Math.PI * 2);
    context.stroke();
    
    // 内側の円
    context.strokeStyle = 'rgba(255, 200, 0, 0.6)';
    context.beginPath();
    context.arc(centerX, centerY, 90, 0, Math.PI * 2);
    context.stroke();
    
    // 最内円
    context.strokeStyle = 'rgba(255, 180, 0, 0.4)';
    context.beginPath();
    context.arc(centerX, centerY, 60, 0, Math.PI * 2);
    context.stroke();
    
    // 魔法陣の模様（六芒星）
    context.strokeStyle = 'rgba(255, 230, 0, 0.5)';
    context.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI * 2) / 6;
        const x = centerX + Math.cos(angle) * 110;
        const y = centerY + Math.sin(angle) * 110;
        if (i === 0) {
            context.moveTo(x, y);
        } else {
            context.lineTo(x, y);
        }
    }
    context.closePath();
    context.stroke();
    
    // 魔法文字（ランダムな記号）
    context.fillStyle = 'rgba(255, 200, 0, 0.7)';
    context.font = '12px Arial';
    for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI * 2) / 12;
        const x = centerX + Math.cos(angle) * 105;
        const y = centerY + Math.sin(angle) * 105;
        const symbol = String.fromCharCode(0x2600 + Math.floor(Math.random() * 32));
        context.fillText(symbol, x - 6, y + 6);
    }
    
    return new THREE.CanvasTexture(canvas);
}

/**
 * 粒子の柱エフェクトを生成する関数
 * @param {Object} gameState - ゲームの状態を管理するオブジェクト
 * @param {THREE.Scene} scene - Three.jsのシーンオブジェクト
 * @returns {Object} 生成された柱エフェクトオブジェクト
 */
export function createParticleColumn(gameState, scene) {
    // 固定位置に配置（4つの回復エリア）
    if (!gameState.healingPositions) {
        gameState.healingPositions = [
            new THREE.Vector3(10, gameState.groundLevel, 0),   // area1
            new THREE.Vector3(-10, gameState.groundLevel, 0),  // area2
            new THREE.Vector3(0, gameState.groundLevel, 10),   // area3
            new THREE.Vector3(0, gameState.groundLevel, -10)   // area4
        ];
        gameState.currentHealingIndex = 0;
    }
    
    const columnOrigin = gameState.healingPositions[gameState.currentHealingIndex].clone();
    gameState.currentHealingIndex = (gameState.currentHealingIndex + 1) % 4;
    
    // 魔法陣を生成
    const magicCircleTexture = createMagicCircleTexture();
    const magicCircleGeometry = new THREE.PlaneGeometry(6, 6);
    const magicCircleMaterial = new THREE.MeshBasicMaterial({
        map: magicCircleTexture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });
    
    const magicCircle = new THREE.Mesh(magicCircleGeometry, magicCircleMaterial);
    magicCircle.position.copy(columnOrigin);
    magicCircle.position.y += 0.1; // 地面からわずかに浮かせる
    magicCircle.rotation.x = -Math.PI / 2; // 地面に平行に
    scene.add(magicCircle);
    
    // 魔法陣のアニメーション用の変数
    let magicCircleRotation = 0;
    let magicCircleScale = 0;
    const magicCircleMaxScale = 1;
    
    // パーティクルのジオメトリ
    const particleCount = Math.floor(gameState.columnParticleCount * 0.5);
    const particleGeometry = new THREE.BufferGeometry();
    
    // パーティクルの初期化データ
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);
    const lifetimes = new Float32Array(particleCount);
    const delays = new Float32Array(particleCount);
    
    // 柱の設定
    const columnHeight = 1000;
    const columnWidth = 1.5;
    
    // パーティクルの初期化
    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        
        // 初期位置の設定（魔法陣の円周上から）
        const angle = Math.random() * Math.PI * 2;
        const radius = (Math.random() * 0.5 + 0.5) * columnWidth; // 外側により多くのパーティクル
        
        positions[i3] = columnOrigin.x + Math.cos(angle) * radius;
        positions[i3 + 1] = columnOrigin.y;
        positions[i3 + 2] = columnOrigin.z + Math.sin(angle) * radius;
        
        // 速度の設定（上向きを基本に）
        const baseUpSpeed = 0.05 + Math.random() * 0.08;
        velocities[i3] = (Math.random() - 0.5) * 0.03;
        velocities[i3 + 1] = baseUpSpeed;
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.03;
        
        // サイズの設定
        scales[i] = gameState.columnSize * (0.3 + Math.random() * 0.3);
        
        // 色の設定（金色）
        colors[i3] = 1.0;     // R
        colors[i3 + 1] = 0.8; // G
        colors[i3 + 2] = 0.2; // B
        
        // ライフタイムと遅延の設定
        lifetimes[i] = 150 + Math.random() * 250;
        delays[i] = Math.random() * 200;
    }
    
    // ジオメトリにアトリビュートを設定
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
    
    // パーティクル用のテクスチャを作成
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    
    // グラデーションの作成（金色のグラデーション）
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, 'rgba(255, 240, 150, 1)');
    gradient.addColorStop(0.4, 'rgba(255, 220, 100, 1)');
    gradient.addColorStop(0.6, 'rgba(255, 200, 50, 0.8)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(32, 32, 32, 0, Math.PI * 2);
    context.fill();
    
    // パーティクル用マテリアル
    const particleMaterial = new THREE.PointsMaterial({
        size: gameState.columnSize * 1.0,
        map: new THREE.CanvasTexture(canvas),
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        vertexColors: true,
        opacity: 0.8
    });
    
    // パーティクルシステムを作成
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.frustumCulled = false;
    scene.add(particles);
    
    // エフェクトデータの保存
    const columnEffect = {
        particles,
        geometry: particleGeometry,
        material: particleMaterial,
        magicCircle,
        maxHeight: columnHeight,
        particleCount,
        origin: columnOrigin.clone(),
        time: 0,
        
        // パーティクルデータ
        positions,
        velocities,
        colors,
        scales,
        lifetimes,
        delays,
        
        // 更新関数
        updatePositions: function() {
            const positions = this.positions;
            const velocities = this.velocities;
            const colors = this.colors;
            this.time++;
            
            // 魔法陣のアニメーション
            magicCircleRotation += 0.01;
            if (magicCircleScale < magicCircleMaxScale) {
                magicCircleScale = Math.min(magicCircleMaxScale, magicCircleScale + 0.05);
            }
            this.magicCircle.rotation.z = magicCircleRotation;
            this.magicCircle.scale.set(magicCircleScale, magicCircleScale, 1);
            
            // パーティクルのアニメーション
            for (let i = 0; i < this.particleCount; i++) {
                const i3 = i * 3;
                
                if (this.delays[i] > 0) {
                    this.delays[i]--;
                    continue;
                }
                
                this.lifetimes[i]--;
                
                if (this.lifetimes[i] <= 0 || positions[i3 + 1] > this.origin.y + this.maxHeight) {
                    // 新しい開始位置を設定（魔法陣の円周上）
                    const angle = Math.random() * Math.PI * 2;
                    const radius = (Math.random() * 0.5 + 0.5) * columnWidth;
                    
                    positions[i3] = this.origin.x + Math.cos(angle) * radius;
                    positions[i3 + 1] = this.origin.y;
                    positions[i3 + 2] = this.origin.z + Math.sin(angle) * radius;
                    
                    const baseUpSpeed = 0.05 + Math.random() * 0.08;
                    velocities[i3] = (Math.random() - 0.5) * 0.03;
                    velocities[i3 + 1] = baseUpSpeed;
                    velocities[i3 + 2] = (Math.random() - 0.5) * 0.03;
                    
                    colors[i3] = 1.0;
                    colors[i3 + 1] = 0.8;
                    colors[i3 + 2] = 0.2;
                    
                    this.lifetimes[i] = 150 + Math.random() * 250;
                    this.delays[i] = Math.random() * 100;
                    
                    continue;
                }
                
                positions[i3] += velocities[i3] * 0.8;
                positions[i3 + 1] += velocities[i3 + 1] * 0.8;
                positions[i3 + 2] += velocities[i3 + 2] * 0.8;
                
                const dx = positions[i3] - this.origin.x;
                const dz = positions[i3 + 2] - this.origin.z;
                const distanceFromCenter = Math.sqrt(dx * dx + dz * dz);
                
                if (distanceFromCenter > 0.1) {
                    const pullStrength = 0.01;
                    velocities[i3] -= (dx / distanceFromCenter) * pullStrength;
                    velocities[i3 + 2] -= (dz / distanceFromCenter) * pullStrength;
                }
                
                const heightRatio = (positions[i3 + 1] - this.origin.y) / this.maxHeight;
                const fade = Math.max(0.2, 1.0 - heightRatio);
                colors[i3] = 1.0 * fade;
                colors[i3 + 1] = 0.8 * fade;
                colors[i3 + 2] = 0.2 * fade;
            }
            
            this.geometry.attributes.position.needsUpdate = true;
            this.geometry.attributes.color.needsUpdate = true;
            
            return true;
        },
        
        // 破棄関数
        dispose: function() {
            scene.remove(this.particles);
            scene.remove(this.magicCircle);
            this.geometry.dispose();
            this.material.dispose();
            this.magicCircle.geometry.dispose();
            this.magicCircle.material.dispose();
        }
    };
    
    // エフェクトを管理リストに追加
    gameState.particleColumnEffects.push(columnEffect);
    
    return columnEffect;
} 