import { GLContext } from './glContext.js';

import { playLightningExplosionSound } from './sound.js';

export class GLSLLightningSystem {
  constructor(maxPoints = 200) {
    this.maxPoints = maxPoints;
    this.currentPoints = 0;
    this.gl = null;
    this.program = null;
    this.buffers = {};
    this.uniforms = {};
    this.time = 0.0;
    
    // 雷の状態管理
    this.lightningVisible = false;
    this.lightningStartTime = 0;
    this.lightningDuration = 200; // ミリ秒（即座に消える）
    this.lightningTargetPosition = null;
    
    // 爆発エフェクト管理
    this.explosions = [];
    this.maxExplosions = 10;
    this.explosionDuration = 400; // ミリ秒（短い爆発）
    this.explosionProgram = null;
    this.explosionBuffers = {};
    this.explosionUniforms = {};
    
    this.init();
  }

  init() {
    this.gl = GLContext.getContext();
    if (!this.gl) {
      console.error('WebGL context not available');
      return;
    }

    // timeを確実に初期化
    this.time = 0.0;
    console.log("time初期化:", this.time);

    this.createShaderProgram();
    this.createExplosionShaderProgram();
    this.createBuffers();
    this.createExplosionBuffers();
    this.initParticles();
  }

  createShaderProgram() {
    // ライン用のシェーダー
    const vertexShaderSource = `
      attribute vec3 a_position;
      attribute float a_intensity;
      
      uniform mat4 u_projectionMatrix;
      uniform mat4 u_viewMatrix;
      uniform float u_time;
      
      varying float v_intensity;
      
      void main() {
        vec3 position = a_position;
        
        gl_Position = u_projectionMatrix * u_viewMatrix * vec4(position, 1.0);
        
        v_intensity = a_intensity;
      }
    `;

    // ライン用のフラグメントシェーダー
    const fragmentShaderSource = `
      precision mediump float;
      
      varying float v_intensity;
      uniform vec3 u_color;
      uniform float u_time;
      
      void main() {
        // 青白い稲妻のエフェクト
        vec3 electricCore = vec3(0.9, 0.95, 1.0); // コアの色（青白）
        vec3 electricGlow = vec3(0.4, 0.7, 1.0); // 外側のグロー（青）
        vec3 electricOuter = vec3(0.2, 0.4, 0.8); // 最外側（深い青）
        
        // コアの強度計算
        float coreIntensity = pow(v_intensity, 0.5);
        float glowIntensity = pow(v_intensity, 2.0);
        
        // 時間ベースのアニメーション
        float timeNoise = sin(u_time * 300.0 + v_intensity * 500.0) * 0.5 + 0.5;
        float pulse = sin(u_time * 100.0) * 0.2 + 0.8;
        
        // 色のブレンド
        vec3 color = mix(electricOuter, electricGlow, glowIntensity);
        color = mix(color, electricCore, coreIntensity);
        
        // 超強力なHDR強度（青白い光彩）
        float hdrIntensity = 25.0 + coreIntensity * 50.0;
        color *= hdrIntensity * pulse;
        
        // 爆発的な青白ブルーム効果
        vec3 bloom = electricGlow * glowIntensity * 40.0;
        color += bloom * timeNoise;
        
        // 眼がいたいほどの青白光彩
        vec3 radiance = electricCore * coreIntensity * 35.0;
        color += radiance * pulse * 3.0;
        
        // 追加のスパークル効果
        float sparkle = sin(u_time * 1000.0 + v_intensity * 2000.0) * 0.5 + 0.5;
        color += electricCore * sparkle * 15.0;
        
        // アルファ計算（中心は不透明、外側は半透明）
        float alpha = mix(0.3, 1.0, coreIntensity) * pulse;
        alpha = clamp(alpha, 0.0, 1.0);
        
        // 最終的な色出力
        gl_FragColor = vec4(color, alpha);
      }
    `;

    console.log("シェーダーコンパイル開始");
    const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) {
      console.error("シェーダーコンパイルに失敗");
      return;
    }

    this.program = this.gl.createProgram();
    this.gl.attachShader(this.program, vertexShader);
    this.gl.attachShader(this.program, fragmentShader);
    this.gl.linkProgram(this.program);

    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      console.error('Unable to initialize the shader program:', this.gl.getProgramInfoLog(this.program));
      return;
    }

    console.log("シェーダープログラムリンク成功");
    this.gl.useProgram(this.program);
    
    this.uniforms = {
      projectionMatrix: this.gl.getUniformLocation(this.program, 'u_projectionMatrix'),
      viewMatrix: this.gl.getUniformLocation(this.program, 'u_viewMatrix'),
      time: this.gl.getUniformLocation(this.program, 'u_time'),
      color: this.gl.getUniformLocation(this.program, 'u_color')
    };
    
    console.log("Uniform locations:", this.uniforms);
  }

  compileShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('An error occurred compiling the shaders:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  createBuffers() {
    // ライン用のバッファー（激しい稲妻用の大容量）
    const maxPoints = 2000;
    const positions = new Float32Array(maxPoints * 3);
    const intensities = new Float32Array(maxPoints);

    this.buffers.position = this.createBuffer(positions, 'a_position', 3);
    this.buffers.intensity = this.createBuffer(intensities, 'a_intensity', 1);
    
    this.maxPoints = maxPoints;
    this.currentPoints = 0;
  }

  createBuffer(data, attributeName, size) {
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.DYNAMIC_DRAW);

    const location = this.gl.getAttribLocation(this.program, attributeName);
    this.gl.enableVertexAttribArray(location);
    this.gl.vertexAttribPointer(location, size, this.gl.FLOAT, false, 0, 0);

    return { buffer, location, size };
  }

  initParticles() {
    // ライン用なので初期化は不要
    this.currentPoints = 0;
  }

  update(deltaTime = 0.016) {
    // time が NaN になることを防ぐ
    if (isNaN(this.time)) {
      this.time = 0.0;
      console.log("time が NaN だったため、0にリセット");
    }
    this.time += deltaTime; // アニメーション用の時間更新
    
    // 雷の表示時間管理
    if (this.lightningVisible) {
      const currentTime = performance.now();
      const elapsed = currentTime - this.lightningStartTime;
      
      if (elapsed >= this.lightningDuration) {
        // 雷を消して即座に爆発を発生
        this.lightningVisible = false;
        this.currentPoints = 0;
        
        // 着地点に爆発を追加
        if (this.lightningTargetPosition) {
          this.addExplosion(this.lightningTargetPosition);
        }
        
        console.log("雷が消えて爆発発生 - 経過時間:", elapsed);
      }
    }
  }



  updateBuffers() {
    const positions = new Float32Array(this.particleCount * 3);
    const velocities = new Float32Array(this.particleCount * 3);
    const lifetimes = new Float32Array(this.particleCount);
    const sizes = new Float32Array(this.particleCount);
    const types = new Float32Array(this.particleCount);

    for (let i = 0; i < this.particleCount; i++) {
      const particle = this.particles[i];
      positions[i * 3] = particle.position[0];
      positions[i * 3 + 1] = particle.position[1];
      positions[i * 3 + 2] = particle.position[2];

      velocities[i * 3] = particle.velocity[0];
      velocities[i * 3 + 1] = particle.velocity[1];
      velocities[i * 3 + 2] = particle.velocity[2];

      lifetimes[i] = particle.life;
      sizes[i] = particle.size;
      types[i] = particle.type;
    }

    this.updateBuffer(this.buffers.position, positions);
    this.updateBuffer(this.buffers.velocity, velocities);
    this.updateBuffer(this.buffers.life, lifetimes);
    this.updateBuffer(this.buffers.size, sizes);
    this.updateBuffer(this.buffers.type, types);
  }

  updateBuffer(bufferInfo, data) {
    try {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, bufferInfo.buffer);
      this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, data);
    } catch (error) {
      console.error("バッファ更新エラー:", error);
      throw error;
    }
  }


  render(projectionMatrix, viewMatrix) {
    if (!this.gl || !this.program) {
      console.log("GLまたはプログラムが未初期化");
      return;
    }

    // console.log("render開始:", {
    //   hasGL: !!this.gl,
    //   hasProgram: !!this.program,
    //   currentPoints: this.currentPoints,
    //   time: this.time
    // });

    // ビューポートをクリア（透明に）
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    
    this.gl.useProgram(this.program);
    
    // バッファー属性を再設定
    this.bindBuffers();
    
    // デプステストを無効にして確実に描画
    this.gl.disable(this.gl.DEPTH_TEST);
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE); // より強い光彩のためにAdditiveブレンド
    
    // Uniformの設定と確認
    this.gl.uniformMatrix4fv(this.uniforms.projectionMatrix, false, projectionMatrix);
    this.gl.uniformMatrix4fv(this.uniforms.viewMatrix, false, viewMatrix);
    this.gl.uniform1f(this.uniforms.time, this.time);
    this.gl.uniform3f(this.uniforms.color, 0.7, 0.85, 1.0);

    // WebGLエラーチェック
    const error = this.gl.getError();
    if (error !== this.gl.NO_ERROR) {
      console.error("WebGLエラー:", error);
    }

    // 雷攻撃時のみログ出力
    if (this.currentPoints > 0) {
      console.log("雷描画実行 - 点数:", this.currentPoints, "時間:", this.time);
    }
    
    // ライン描画（超極太稲妻）
    this.gl.lineWidth(100.0);
    
    // 多重描画でグロー効果を演出
    // 最外側の光彩（深い青）
    this.gl.lineWidth(200.0);
    this.gl.uniform3f(this.uniforms.color, 0.2, 0.4, 0.8);
    this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.currentPoints);
    
    // 外側のグロー（青）
    this.gl.lineWidth(120.0);
    this.gl.uniform3f(this.uniforms.color, 0.4, 0.7, 1.0);
    this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.currentPoints);
    
    // 中間のグロー（明るい青白）
    this.gl.lineWidth(70.0);
    this.gl.uniform3f(this.uniforms.color, 0.7, 0.8, 1.0);
    this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.currentPoints);
    
    // コアの雷（青白）
    this.gl.lineWidth(35.0);
    this.gl.uniform3f(this.uniforms.color, 0.9, 0.95, 1.0);
    for (let i = 0; i < 2; i++) {
      this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.currentPoints);
    }
    
    // 爆発エフェクトの描画
    this.renderExplosions(projectionMatrix, viewMatrix);
    
    // 描画後のエラーチェック
    const drawError = this.gl.getError();
    if (drawError !== this.gl.NO_ERROR) {
      console.error("描画エラー:", drawError);
    }
    
    this.gl.disable(this.gl.BLEND);
    this.gl.enable(this.gl.DEPTH_TEST);
    
    console.log("render完了");
  }

  bindBuffers() {
    // 各バッファーを再バインドして属性を設定
    Object.keys(this.buffers).forEach(key => {
      const bufferInfo = this.buffers[key];
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, bufferInfo.buffer);
      this.gl.enableVertexAttribArray(bufferInfo.location);
      this.gl.vertexAttribPointer(bufferInfo.location, bufferInfo.size, this.gl.FLOAT, false, 0, 0);
    });
  }

  emit(position, count = 10) {
    console.log("GLSLLightningSystem.emit呼び出し:", position, count);
    for (let i = 0; i < count && i < this.particleCount; i++) {
      const particle = this.particles[i];
      particle.position = [
        position[0] + (Math.random() - 0.5) * 5,
        position[1] + Math.random() * 3,
        position[2] + (Math.random() - 0.5) * 5
      ];
      particle.velocity = [
        (Math.random() - 0.5) * 8,
        -15 - Math.random() * 10,
        (Math.random() - 0.5) * 8
      ];
      particle.life = Math.random() * 3 + 2;
      particle.size = Math.random() * 50 + 30;
      particle.type = Math.random();
      particle.startTime = this.time;
    }
    this.updateBuffers();
  }

  strikeTarget(startPosition, targetPosition, segmentCount = 60) {
    console.log("========== strikeTarget関数開始 ==========");
    console.log("激しい落雷開始:", startPosition, "→", targetPosition);
    
    // 距離と方向を計算
    const dx = targetPosition[0] - startPosition[0];
    const dy = targetPosition[1] - startPosition[1];
    const dz = targetPosition[2] - startPosition[2];
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    console.log("落雷の距離:", distance);
    
    const positions = [];
    const intensities = [];
    
    // 激しい稲妻の生成関数
    const generateThunderboltPath = (startPos, endPos, segments, branchProbability = 0, thickness = 1) => {
      const pathPositions = [];
      const pathIntensities = [];
      
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        
        // 基本の直線位置
        let x = startPos[0] + (endPos[0] - startPos[0]) * t;
        let y = startPos[1] + (endPos[1] - startPos[1]) * t;
        let z = startPos[2] + (endPos[2] - startPos[2]) * t;
        
        // Unityライクな自然な雷のパス
        if (i > 0 && i < segments) {
          const baseZigzag = distance * 0.02 * thickness; // 非常に狭い幅で落雷
          
          // Perlinノイズ風の滑らかな変化
          const noiseScale = 0.1;
          const noise1 = Math.sin(t * Math.PI * 4 + i * noiseScale) * baseZigzag;
          const noise2 = Math.cos(t * Math.PI * 6 + i * noiseScale * 1.5) * baseZigzag * 0.7;
          const noise3 = Math.sin(t * Math.PI * 8 + i * noiseScale * 2) * baseZigzag * 0.5;
          
          // フラクタルノイズ
          const fractal = noise1 + noise2 * 0.5 + noise3 * 0.25;
          
          // 偶発的な大きな変化
          let spike = 0;
          if (Math.random() < 0.15) {
            spike = (Math.random() - 0.5) * baseZigzag * 2.5;
          }
          
          // 方向を調整
          const perpX = -dy / distance;
          const perpZ = dx / distance;
          
          x += (fractal + spike) * perpX;
          z += (fractal + spike) * perpZ;
          
          // Y方向は控えめに
          y += fractal * 0.1;
        }
        
        pathPositions.push(x, y, z);
        
        // より強い強度変化
        const baseIntensity = 1.0 - Math.abs(t - 0.5) * 1.2;
        const randomFlicker = 0.6 + Math.random() * 0.7;
        const thicknessMultiplier = thickness;
        pathIntensities.push(Math.max(0.5, baseIntensity * randomFlicker * thicknessMultiplier));
        
        // 自然な分岐（非常に稀）
        if (branchProbability > 0 && Math.random() < branchProbability * 0.3 && i > segments * 0.4 && i < segments * 0.7) {
          const branchLength = segments * (0.15 + Math.random() * 0.2);
          const branchDistance = distance * (0.03 + Math.random() * 0.03); // 分岐を非常に短く
          
          // 主雷の方向に対して適度な角度で分岐
          const mainAngle = Math.atan2(dz, dx);
          const branchAngle = mainAngle + (Math.random() - 0.5) * Math.PI * 0.6;
          const branchElevation = (Math.random() - 0.7) * 0.3; // 下向き傾向
          
          const branchEnd = [
            x + Math.cos(branchAngle) * branchDistance,
            y + branchDistance * branchElevation,
            z + Math.sin(branchAngle) * branchDistance
          ];
          
          // 分岐を生成（細くなる）
          const branchPath = generateThunderboltPath([x, y, z], branchEnd, Math.floor(branchLength), 0, thickness * 0.5);
          pathPositions.push(...branchPath.positions);
          pathIntensities.push(...branchPath.intensities.map(intensity => intensity * 0.7));
        }
      }
      
      return { positions: pathPositions, intensities: pathIntensities };
    };
    
    // メイン稲妻（極太で明るい）
    const mainPath = generateThunderboltPath(startPosition, targetPosition, segmentCount, 0.05, 2.0);
    positions.push(...mainPath.positions);
    intensities.push(...mainPath.intensities);
    
    // 複数のサブ稲妻（周囲に散らばる）
    for (let subBolt = 0; subBolt < 1; subBolt++) {
      const offset = distance * (0.01 + Math.random() * 0.01); // 極めて狭く
      const offsetStart = [
        startPosition[0] + (Math.random() - 0.5) * offset,
        startPosition[1] + (Math.random() - 0.5) * offset * 0.3,
        startPosition[2] + (Math.random() - 0.5) * offset
      ];
      const offsetEnd = [
        targetPosition[0] + (Math.random() - 0.5) * offset,
        targetPosition[1] + (Math.random() - 0.5) * offset * 0.3,
        targetPosition[2] + (Math.random() - 0.5) * offset
      ];
      
      const subPath = generateThunderboltPath(offsetStart, offsetEnd, Math.floor(segmentCount * 0.5), 0.02, 0.8);
      positions.push(...subPath.positions);
      // サブ稲妻は暇く
      intensities.push(...subPath.intensities.map(i => i * 0.6));
    }
    
    // 周辺放電効果（小さな稲妻がランダムに）
    for (let spark = 0; spark < 1; spark++) {
      const sparkRadius = distance * 0.05; // 放電効果も極めて犭く
      const sparkStart = [
        startPosition[0] + (Math.random() - 0.5) * sparkRadius,
        startPosition[1] + Math.random() * distance * 0.3,
        startPosition[2] + (Math.random() - 0.5) * sparkRadius
      ];
      const sparkEnd = [
        sparkStart[0] + (Math.random() - 0.5) * sparkRadius * 0.5,
        sparkStart[1] + (Math.random() - 0.5) * sparkRadius * 0.3,
        sparkStart[2] + (Math.random() - 0.5) * sparkRadius * 0.5
      ];
      
      const sparkPath = generateThunderboltPath(sparkStart, sparkEnd, Math.floor(segmentCount * 0.2), 0, 0.5);
      positions.push(...sparkPath.positions);
      intensities.push(...sparkPath.intensities.map(i => i * 0.4));
    }
    
    // バッファーを即座に更新（以前の動作方式に戻す）
    this.currentPoints = Math.min(positions.length / 3, this.maxPoints);
    
    const positionArray = new Float32Array(this.maxPoints * 3);
    const intensityArray = new Float32Array(this.maxPoints);
    
    for (let i = 0; i < Math.min(positions.length, this.maxPoints * 3); i++) {
      positionArray[i] = positions[i];
    }
    for (let i = 0; i < Math.min(intensities.length, this.maxPoints); i++) {
      intensityArray[i] = intensities[i];
    }
    
    console.log("バッファ更新前");
    this.updateBuffer(this.buffers.position, positionArray);
    this.updateBuffer(this.buffers.intensity, intensityArray);
    console.log("バッファ更新完了");
    
    // 雷音再生はmain.jsで処理される
    
    // 雷の表示開始
    this.lightningVisible = true;
    this.lightningStartTime = performance.now();
    this.lightningTargetPosition = targetPosition;
    
    console.log("激しい稲妻生成完了 - 点数:", this.currentPoints, "表示開始時刻:", this.lightningStartTime);
  }
  
  createExplosionShaderProgram() {
    const vertexShaderSource = `
      attribute vec3 a_position;
      attribute vec3 a_velocity;
      attribute float a_life;
      attribute float a_size;
      
      uniform mat4 u_projectionMatrix;
      uniform mat4 u_viewMatrix;
      uniform float u_time;
      uniform vec3 u_explosionCenter;
      
      varying float v_life;
      varying float v_intensity;
      
      void main() {
        float age = u_time - a_life;
        vec3 position = u_explosionCenter + a_position + a_velocity * age;
        
        gl_Position = u_projectionMatrix * u_viewMatrix * vec4(position, 1.0);
        gl_PointSize = a_size * (1.0 - age * 0.8);
        
        v_life = 1.0 - age;
        v_intensity = a_size / 30.0;
      }
    `;
    
    const fragmentShaderSource = `
      precision mediump float;
      
      varying float v_life;
      varying float v_intensity;
      uniform float u_time;
      
      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        
        if (dist > 0.5) {
          discard;
        }
        
        // 爆発の色（青白い→オレンジ→黒煙）
        vec3 groundGlow = vec3(0.5, 0.8, 1.0); // 青白い地面グロー
        vec3 dust = vec3(0.4, 0.4, 0.3);
        vec3 smoke = vec3(0.2, 0.2, 0.2);
        
        vec3 color;
        if (v_life > 0.8) {
          // 初期：爆発的な青白爆発
          color = groundGlow;
          color *= 15.0; // 眼がいたい光彩
        } else if (v_life > 0.3) {
          // 中期：土埃
          color = mix(dust, groundGlow, (v_life - 0.3) * 2.0);
          color *= 1.0;
        } else {
          // 後期：煙
          color = smoke;
          color *= 0.5;
        }
        
        float alpha = (1.0 - dist * 2.0) * v_life * v_intensity;
        gl_FragColor = vec4(color, alpha);
      }
    `;
    
    const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (!vertexShader || !fragmentShader) {
      console.error("爆発シェーダーコンパイルに失敗");
      return;
    }
    
    this.explosionProgram = this.gl.createProgram();
    this.gl.attachShader(this.explosionProgram, vertexShader);
    this.gl.attachShader(this.explosionProgram, fragmentShader);
    this.gl.linkProgram(this.explosionProgram);
    
    if (!this.gl.getProgramParameter(this.explosionProgram, this.gl.LINK_STATUS)) {
      console.error('爆発シェーダープログラムのリンクに失敗:', this.gl.getProgramInfoLog(this.explosionProgram));
      return;
    }
    
    this.explosionUniforms = {
      projectionMatrix: this.gl.getUniformLocation(this.explosionProgram, 'u_projectionMatrix'),
      viewMatrix: this.gl.getUniformLocation(this.explosionProgram, 'u_viewMatrix'),
      time: this.gl.getUniformLocation(this.explosionProgram, 'u_time'),
      explosionCenter: this.gl.getUniformLocation(this.explosionProgram, 'u_explosionCenter')
    };
  }
  
  createExplosionBuffers() {
    const maxParticles = 300;
    const positions = new Float32Array(maxParticles * 3);
    const velocities = new Float32Array(maxParticles * 3);
    const lifetimes = new Float32Array(maxParticles);
    const sizes = new Float32Array(maxParticles);
    
    this.explosionBuffers.position = this.createExplosionBuffer(positions, 'a_position', 3);
    this.explosionBuffers.velocity = this.createExplosionBuffer(velocities, 'a_velocity', 3);
    this.explosionBuffers.life = this.createExplosionBuffer(lifetimes, 'a_life', 1);
    this.explosionBuffers.size = this.createExplosionBuffer(sizes, 'a_size', 1);
    
    this.maxExplosionParticles = maxParticles;
  }
  
  createExplosionBuffer(data, attributeName, size) {
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.DYNAMIC_DRAW);
    
    const location = this.gl.getAttribLocation(this.explosionProgram, attributeName);
    
    return { buffer, location, size };
  }
  
  addExplosion(position) {
    const explosion = {
      position: [...position],
      startTime: this.time,
      particles: []
    };
    
    // 爆発音を再生
    if (window.gameState && window.audioLoader) {
      playLightningExplosionSound(window.gameState, window.audioLoader);
    }
    
    // 即座の青白爆発
    const particleCount = 60;
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 8 + Math.random() * 12;
      
      explosion.particles.push({
        position: [
          (Math.random() - 0.5) * 0.8,
          0, // 地面から開始
          (Math.random() - 0.5) * 0.8
        ],
        velocity: [
          Math.cos(angle) * speed,
          Math.random() * 8 + 3, // 適度な高さ
          Math.sin(angle) * speed
        ],
        life: this.time,
        size: 6 + Math.random() * 18
      });
    }
    
    this.explosions.push(explosion);
    
    // 古い爆発を削除
    if (this.explosions.length > this.maxExplosions) {
      this.explosions.shift();
    }
    
    console.log("爆発エフェクト追加:", position);
  }
  
  renderExplosions(projectionMatrix, viewMatrix) {
    if (this.explosions.length === 0 || !this.explosionProgram) return;
    
    this.gl.useProgram(this.explosionProgram);
    
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE); // より強い光彩のためにAdditiveブレンド
    this.gl.disable(this.gl.DEPTH_TEST);
    
    // Uniformを設定
    this.gl.uniformMatrix4fv(this.explosionUniforms.projectionMatrix, false, projectionMatrix);
    this.gl.uniformMatrix4fv(this.explosionUniforms.viewMatrix, false, viewMatrix);
    
    // 各爆発を描画
    for (const explosion of this.explosions) {
      const age = this.time - explosion.startTime;
      if (age > this.explosionDuration / 1000) continue;
      
      this.gl.uniform1f(this.explosionUniforms.time, this.time);
      this.gl.uniform3fv(this.explosionUniforms.explosionCenter, explosion.position);
      
      // バッファーを更新
      const positions = new Float32Array(explosion.particles.length * 3);
      const velocities = new Float32Array(explosion.particles.length * 3);
      const lifetimes = new Float32Array(explosion.particles.length);
      const sizes = new Float32Array(explosion.particles.length);
      
      for (let i = 0; i < explosion.particles.length; i++) {
        const p = explosion.particles[i];
        positions[i * 3] = p.position[0];
        positions[i * 3 + 1] = p.position[1];
        positions[i * 3 + 2] = p.position[2];
        
        velocities[i * 3] = p.velocity[0];
        velocities[i * 3 + 1] = p.velocity[1];
        velocities[i * 3 + 2] = p.velocity[2];
        
        lifetimes[i] = p.life;
        sizes[i] = p.size;
      }
      
      // バッファーをバインドして更新
      this.bindExplosionBuffer(this.explosionBuffers.position, positions);
      this.bindExplosionBuffer(this.explosionBuffers.velocity, velocities);
      this.bindExplosionBuffer(this.explosionBuffers.life, lifetimes);
      this.bindExplosionBuffer(this.explosionBuffers.size, sizes);
      
      // 描画
      this.gl.drawArrays(this.gl.POINTS, 0, explosion.particles.length);
    }
    
    // 古い爆発を削除
    this.explosions = this.explosions.filter(exp => {
      const age = this.time - exp.startTime;
      return age <= this.explosionDuration / 1000;
    });
    
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.disable(this.gl.BLEND);
  }
  
  bindExplosionBuffer(bufferInfo, data) {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, bufferInfo.buffer);
    this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, data);
    this.gl.enableVertexAttribArray(bufferInfo.location);
    this.gl.vertexAttribPointer(bufferInfo.location, bufferInfo.size, this.gl.FLOAT, false, 0, 0);
  }
}