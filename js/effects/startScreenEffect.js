// スタート画面のエフェクト管理
export class StartScreenEffect {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.lightning = [];
        this.time = 0;
        this.animationId = null;
    }

    init() {
        // キャンバスを作成
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'startEffectCanvas';
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '1';
        
        const startScreen = document.getElementById('startScreen');
        startScreen.appendChild(this.canvas);
        
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        
        // リサイズイベント
        window.addEventListener('resize', () => this.resize());
        
        // パーティクルを初期化
        this.initParticles();
        
        // アニメーション開始
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    initParticles() {
        // 火の粉パーティクル
        for (let i = 0; i < 100; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: this.canvas.height + Math.random() * 100,
                vx: (Math.random() - 0.5) * 2,
                vy: -Math.random() * 3 - 1,
                size: Math.random() * 3 + 1,
                life: 1,
                color: `hsl(${Math.random() * 60 + 10}, 100%, 50%)` // 黄色〜赤色
            });
        }
    }

    updateParticles() {
        // パーティクルを更新
        this.particles.forEach((particle, index) => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life -= 0.01;
            particle.size *= 0.99;
            
            // 画面外に出たら再生成
            if (particle.y < -10 || particle.life <= 0) {
                this.particles[index] = {
                    x: Math.random() * this.canvas.width,
                    y: this.canvas.height + Math.random() * 100,
                    vx: (Math.random() - 0.5) * 2,
                    vy: -Math.random() * 3 - 1,
                    size: Math.random() * 3 + 1,
                    life: 1,
                    color: `hsl(${Math.random() * 60 + 10}, 100%, 50%)`
                };
            }
        });
    }

    drawParticles() {
        this.particles.forEach(particle => {
            this.ctx.save();
            this.ctx.globalAlpha = particle.life;
            this.ctx.fillStyle = particle.color;
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = particle.color;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });
    }

    createLightning() {
        // ランダムに雷を生成
        if (Math.random() < 0.02 && this.lightning.length < 3) {
            const startX = Math.random() * this.canvas.width;
            const segments = [];
            let x = startX;
            let y = 0;
            
            // 雷の経路を生成
            while (y < this.canvas.height) {
                segments.push({ x, y });
                x += (Math.random() - 0.5) * 50;
                y += Math.random() * 30 + 10;
            }
            
            this.lightning.push({
                segments,
                life: 1,
                width: Math.random() * 3 + 2
            });
        }
    }

    updateLightning() {
        this.lightning = this.lightning.filter(bolt => {
            bolt.life -= 0.1;
            return bolt.life > 0;
        });
    }

    drawLightning() {
        this.lightning.forEach(bolt => {
            this.ctx.save();
            this.ctx.globalAlpha = bolt.life;
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = '#6495ed';
            this.ctx.lineWidth = bolt.width;
            
            this.ctx.beginPath();
            bolt.segments.forEach((segment, index) => {
                if (index === 0) {
                    this.ctx.moveTo(segment.x, segment.y);
                } else {
                    this.ctx.lineTo(segment.x, segment.y);
                }
            });
            this.ctx.stroke();
            this.ctx.restore();
        });
    }

    animate() {
        this.time++;
        
        // キャンバスをクリア
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 雷を生成・更新・描画
        this.createLightning();
        this.updateLightning();
        this.drawLightning();
        
        // パーティクルを更新・描画
        this.updateParticles();
        this.drawParticles();
        
        // アニメーションを継続
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}

// エクスポート
export function createStartScreenEffect() {
    const effect = new StartScreenEffect();
    effect.init();
    return effect;
}