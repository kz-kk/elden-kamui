import { GLSLLightningSystem } from './glslLightningSystem.js';

export class DragonLightningSystem extends GLSLLightningSystem {
  constructor(particleCount = 500) {
    super(particleCount);
    this.targetPosition = null;
    this.isActive = false;
    this.strikeTime = 0;
    this.strikeDuration = 1.5;
  }

  strike(dragonPosition, targetPosition) {
    this.targetPosition = targetPosition;
    this.isActive = true;
    this.strikeTime = 0;

    // 雷撃の開始位置をドラゴンの位置に設定
    for (let i = 0; i < this.particleCount; i++) {
      const spread = i / this.particleCount;
      const angle = spread * Math.PI * 2;
      const radius = Math.random() * 2;
      
      this.particles[i] = {
        position: [
          dragonPosition[0] + Math.cos(angle) * radius,
          dragonPosition[1] - 2, // ドラゴンの口元あたり
          dragonPosition[2] + Math.sin(angle) * radius
        ],
        velocity: [
          0,
          20 + Math.random() * 10, // 下向きの速度
          0
        ],
        life: this.strikeDuration,
        size: Math.random() * 20 + 15,
        type: Math.random(),
        startTime: this.time + Math.random() * 0.1 // わずかな遅延でばらつきを持たせる
      };
    }
    
    this.updateBuffers();
  }

  update(deltaTime) {
    if (!this.isActive) return;
    
    this.time += deltaTime;
    this.strikeTime += deltaTime;

    if (this.strikeTime > this.strikeDuration) {
      this.isActive = false;
      return;
    }

    // パーティクルの更新
    for (let i = 0; i < this.particleCount; i++) {
      const particle = this.particles[i];
      const age = this.time - particle.startTime;
      
      if (age > 0 && age < particle.life) {
        // ターゲットに向かって収束する動き
        if (this.targetPosition) {
          const t = age / particle.life;
          const targetOffsetX = (this.targetPosition[0] - particle.position[0]) * t * 0.5;
          const targetOffsetZ = (this.targetPosition[2] - particle.position[2]) * t * 0.5;
          
          particle.position[0] += targetOffsetX * deltaTime;
          particle.position[2] += targetOffsetZ * deltaTime;
        }
      }
    }
  }

  render(projectionMatrix, viewMatrix) {
    if (!this.isActive) return;
    super.render(projectionMatrix, viewMatrix);
  }
}