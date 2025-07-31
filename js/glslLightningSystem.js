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
    this.explosionDuration = 800; // 600から800ミリ秒に延長（アニメーションを見せるため）
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
    // console.log("time初期化:", this.time);

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
        // 強烈な黄色い稲妻のエフェクト
        vec3 electricCore = vec3(1.0, 0.9, 0.2); // コアの色（濃い黄色）
        vec3 electricGlow = vec3(1.0, 0.7, 0.0); // 外側のグロー（純黄色）
        vec3 electricOuter = vec3(0.8, 0.4, 0.0); // 最外側（オレンジ）
        
        // コアの強度計算
        float coreIntensity = pow(v_intensity, 0.5);
        float glowIntensity = pow(v_intensity, 2.0);
        
        // 時間ベースのアニメーション
        float timeNoise = sin(u_time * 300.0 + v_intensity * 500.0) * 0.5 + 0.5;
        float pulse = sin(u_time * 100.0) * 0.2 + 0.8;
        
        // 色のブレンド
        vec3 color = mix(electricOuter, electricGlow, glowIntensity);
        color = mix(color, electricCore, coreIntensity);
        
        // 超強力なHDR強度（黄色い光彩）
        float hdrIntensity = 35.0 + coreIntensity * 70.0; // 25.0→35.0, 50.0→70.0に増強
        color *= hdrIntensity * pulse;
        
        // 爆発的な黄色ブルーム効果
        vec3 bloom = electricGlow * glowIntensity * 60.0; // 40.0→60.0に増強
        color += bloom * timeNoise;
        
        // 眼がいたいほどの黄色光彩
        vec3 radiance = electricCore * coreIntensity * 50.0; // 35.0→50.0に増強
        color += radiance * pulse * 4.0; // 3.0→4.0に増強
        
        // 追加のスパークル効果（黄色）
        float sparkle = sin(u_time * 1000.0 + v_intensity * 2000.0) * 0.5 + 0.5;
        color += electricCore * sparkle * 25.0; // 15.0→25.0に増強
        
        // 外側グロー強化
        vec3 outerGlow = electricGlow * glowIntensity * 30.0;
        color += outerGlow * pulse * 2.0;
        
        // アルファ計算（中心は不透明、外側は半透明）
        float alpha = mix(0.3, 1.0, coreIntensity) * pulse;
        alpha = clamp(alpha, 0.0, 1.0);
        
        // 最終的な色出力
        gl_FragColor = vec4(color, alpha);
      }
    `;

    // console.log("シェーダーコンパイル開始");
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

    // console.log("シェーダープログラムリンク成功");
    this.gl.useProgram(this.program);
    
    this.uniforms = {
      projectionMatrix: this.gl.getUniformLocation(this.program, 'u_projectionMatrix'),
      viewMatrix: this.gl.getUniformLocation(this.program, 'u_viewMatrix'),
      time: this.gl.getUniformLocation(this.program, 'u_time'),
      color: this.gl.getUniformLocation(this.program, 'u_color')
    };
    
    // console.log("Uniform locations:", this.uniforms);
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
    
    // グロー効果強化のためのレンダリング設定
    this.gl.blendEquation(this.gl.FUNC_ADD);
    
    // Uniformの設定と確認
    this.gl.uniformMatrix4fv(this.uniforms.projectionMatrix, false, projectionMatrix);
    this.gl.uniformMatrix4fv(this.uniforms.viewMatrix, false, viewMatrix);
    this.gl.uniform1f(this.uniforms.time, this.time);
    this.gl.uniform3f(this.uniforms.color, 1.0, 0.7, 0.0); // 純黄色に変更

    // Uniform設定後のエラーチェック
    let error = this.gl.getError();
    if (error !== this.gl.NO_ERROR) {
      console.error("Uniform設定後のWebGLエラー:", error);
    }

    // 雷攻撃時のみログ出力
    if (this.currentPoints > 0) {
      console.log("雷描画実行 - 点数:", this.currentPoints, "時間:", this.time);
    }
    
    // ライン描画（WebGLの制限を考慮した太さ）
    // 多重描画でより強いグロー効果を演出
    
    // 最外側の大きなグロー（薄いオレンジ）
    this.gl.lineWidth(15.0); // 10.0→15.0に拡大
    this.gl.uniform3f(this.uniforms.color, 0.6, 0.2, 0.0);
    if (this.currentPoints > 0) {
      for (let i = 0; i < 2; i++) { // 2回描画でより強いグロー
        this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.currentPoints);
      }
    }
    
    // 外側のグロー（オレンジ）
    this.gl.lineWidth(12.0); // 8.0→12.0に拡大
    this.gl.uniform3f(this.uniforms.color, 0.8, 0.3, 0.0);
    if (this.currentPoints > 0) {
      for (let i = 0; i < 2; i++) {
        this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.currentPoints);
      }
    }
    
    // 中間のグロー（純黄色）
    this.gl.lineWidth(9.0); // 6.0→9.0に拡大
    this.gl.uniform3f(this.uniforms.color, 1.0, 0.6, 0.0);
    if (this.currentPoints > 0) {
      for (let i = 0; i < 3; i++) { // 3回描画でより強いグロー
        this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.currentPoints);
      }
    }
    
    // 内側のグロー（明るい黄色）
    this.gl.lineWidth(6.0);
    this.gl.uniform3f(this.uniforms.color, 1.0, 0.8, 0.1);
    if (this.currentPoints > 0) {
      for (let i = 0; i < 3; i++) {
        this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.currentPoints);
      }
    }
    
    // コアの雷（濃い黄色・最も明るい）
    this.gl.lineWidth(3.0); // 4.0→3.0に細く
    this.gl.uniform3f(this.uniforms.color, 1.0, 0.9, 0.2);
    if (this.currentPoints > 0) {
      for (let i = 0; i < 4; i++) { // 4回描画で強烈なコア
        this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.currentPoints);
      }
    }
    
    // 爆発エフェクトの描画
    this.renderExplosions(projectionMatrix, viewMatrix);
    
    // 爆発エフェクト描画前のエラーチェック
    error = this.gl.getError();
    if (error !== this.gl.NO_ERROR) {
      console.error("爆発エフェクト描画前のエラー:", error);
    }
    
    // 最終エラーチェック
    error = this.gl.getError();
    if (error !== this.gl.NO_ERROR) {
      console.error("render最後のエラー:", error);
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
        
        // 適度なジグザグな雷のパス
        if (i > 0 && i < segments) {
          const baseZigzag = distance * 0.015 * thickness; // 0.04から0.015に減少（自然な感じに）
          
          // 滑らかなノイズレイヤー
          const noiseScale = 0.08; // 0.15から0.08に減少
          const noise1 = Math.sin(t * Math.PI * 4 + i * noiseScale) * baseZigzag;
          const noise2 = Math.cos(t * Math.PI * 6 + i * noiseScale * 1.2) * baseZigzag * 0.6;
          const noise3 = Math.sin(t * Math.PI * 8 + i * noiseScale * 1.5) * baseZigzag * 0.4;
          
          // 自然なフラクタルノイズ
          const fractal = noise1 + noise2 * 0.5 + noise3 * 0.3;
          
          // 控えめな偶発的変化
          let spike = 0;
          if (Math.random() < 0.12) { // 0.25から0.12に減少
            spike = (Math.random() - 0.5) * baseZigzag * 2.0; // 3.5から2.0に減少
          }
          
          // 方向を調整
          const perpX = -dy / distance;
          const perpZ = dx / distance;
          
          x += (fractal + spike) * perpX;
          z += (fractal + spike) * perpZ;
          
          // Y方向は控えめに
          y += fractal * 0.08; // 0.15から0.08に減少
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
    const mainPath = generateThunderboltPath(startPosition, targetPosition, segmentCount, 0.05, 3.5);
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
      
      const subPath = generateThunderboltPath(offsetStart, offsetEnd, Math.floor(segmentCount * 0.5), 0.02, 1.5);
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
      
      const sparkPath = generateThunderboltPath(sparkStart, sparkEnd, Math.floor(segmentCount * 0.2), 0, 1.0);
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
      precision mediump float;
      
      attribute vec3 a_position;
      attribute vec3 a_velocity;
      attribute float a_life;
      attribute float a_size;
      attribute float a_angle;
      
      uniform mat4 u_projectionMatrix;
      uniform mat4 u_viewMatrix;
      uniform float u_time;
      uniform vec3 u_explosionCenter;
      
      varying float v_life;
      varying float v_intensity;
      varying float v_lineLength;
      
      void main() {
        // ライフタイムの計算を修正（a_lifeは開始時間）
        float age = u_time - a_life;
        float maxAge = 0.4; // 0.6から0.4秒に短縮（より速い放電）
        
        // 段階的な表示制御（age < 0の場合は表示しない）
        if (age < 0.0) {
          gl_Position = vec4(0.0, 0.0, 0.0, 0.0); // 画面外に移動
          v_life = 0.0;
          v_intensity = 0.0;
          v_lineLength = 0.0;
          return;
        }
        
        v_life = clamp(1.0 - (age / maxAge), 0.0, 1.0);
        
        // アニメーション効果：時間に応じて位置が動的に変化
        float animationTime = clamp(age * 8.0, 0.0, 1.0); // 放電の進行速度
        
        // ジグザグアニメーション（時間に応じて振幅が変化）
        float zigzagPhase = age * 15.0; // 高速なジグザグ
        float zigzagIntensity = sin(zigzagPhase) * 0.1 * (1.0 - animationTime * 0.7);
        
        // 基本位置にジグザグ効果を加える
        vec3 animatedPosition = a_position;
        animatedPosition.x += zigzagIntensity * cos(zigzagPhase * 1.3);
        animatedPosition.z += zigzagIntensity * sin(zigzagPhase * 0.8);
        
        // Y座標に応じた特別処理（上向き放電の強調）
        if (a_position.y > 0.2) {
          // 上向き放電の場合、より激しいアニメーション
          float upwardIntensity = (a_position.y - 0.2) * 2.0;
          animatedPosition.y += zigzagIntensity * upwardIntensity * 1.5;
          animatedPosition.x += sin(age * 20.0 + a_position.y * 10.0) * 0.05 * upwardIntensity;
          animatedPosition.z += cos(age * 18.0 + a_position.y * 8.0) * 0.05 * upwardIntensity;
        } else {
          // 地面放電の場合
          animatedPosition.y += abs(zigzagIntensity) * 0.5;
        }
        
        // 位置計算
        vec3 position = u_explosionCenter + animatedPosition;
        
        gl_Position = u_projectionMatrix * u_viewMatrix * vec4(position, 1.0);
        gl_PointSize = a_size * (0.8 + 0.4 * sin(age * 20.0)); // サイズもパルス
        
        // 距離に基づく強度計算
        float distance = length(animatedPosition);
        v_lineLength = distance;
        v_intensity = 1.0 - clamp(distance / 5.0, 0.0, 1.0);
        
        // アニメーション進行度を強度に反映
        v_intensity *= animationTime;
      }
    `;
    
    const fragmentShaderSource = `
      precision mediump float;
      
      varying float v_life;
      varying float v_intensity;
      varying float v_lineLength;
      uniform float u_time;
      
      void main() {
        // v_lifeが0以下の場合は描画しない
        if (v_life <= 0.0) {
          discard;
        }
        
        // より強烈な黄色い電撃の線
        vec3 electricCore = vec3(1.0, 0.85, 0.1); // 濃い黄色
        vec3 electricGlow = vec3(1.0, 0.6, 0.0); // 純黄色
        vec3 electricOuter = vec3(0.7, 0.3, 0.0); // 外側のオレンジ
        
        // より激しいアニメーション（ジグザグ放電に合わせて）
        float pulse = sin(u_time * 80.0 + v_lineLength * 12.0) * 0.5 + 0.5;
        float flicker = sin(u_time * 150.0 + v_lineLength * 20.0) * 0.4 + 0.6;
        float crackle = sin(u_time * 200.0 + v_lineLength * 25.0) * 0.3 + 0.7; // パチパチ音効果
        
        vec3 color;
        if (v_life > 0.8) {
          // 初期：爆発的な白い電撃（ジグザグ効果）
          color = electricCore;
          color *= 35.0 * pulse * flicker * crackle;
        } else if (v_life > 0.4) {
          // 中期：青白いグロー（パチパチ効果）
          float t = (v_life - 0.4) / 0.4;
          color = mix(electricGlow, electricCore, t);
          color *= 18.0 * flicker * crackle;
        } else {
          // 後期：薄い青（残光効果）
          float t = v_life / 0.4;
          color = mix(electricOuter, electricGlow, t);
          color *= 8.0 * pulse * crackle;
        }
        
        // 距離フェード
        float distanceFade = 1.0 - clamp(v_lineLength / 6.0, 0.0, 1.0); // 12.0から6.0に変更（より局地的）
        
        // アルファ計算
        float alpha = v_life * v_intensity * distanceFade;
        alpha = clamp(alpha, 0.0, 1.0);
        
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
    // 最大バッファーサイズを大きくして、複数の線を収容できるようにする
    const maxParticles = 1000; // 500から1000に増加
    const positions = new Float32Array(maxParticles * 3);
    const velocities = new Float32Array(maxParticles * 3);
    const lifetimes = new Float32Array(maxParticles);
    const sizes = new Float32Array(maxParticles);
    const angles = new Float32Array(maxParticles);
    
    this.explosionBuffers.position = this.createExplosionBuffer(positions, 'a_position', 3);
    this.explosionBuffers.velocity = this.createExplosionBuffer(velocities, 'a_velocity', 3);
    this.explosionBuffers.life = this.createExplosionBuffer(lifetimes, 'a_life', 1);
    this.explosionBuffers.size = this.createExplosionBuffer(sizes, 'a_size', 1);
    this.explosionBuffers.angle = this.createExplosionBuffer(angles, 'a_angle', 1);
    
    this.maxExplosionParticles = maxParticles;
  }
  
  createExplosionBuffer(data, attributeName, size) {
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.DYNAMIC_DRAW);
    
    // シェーダープログラムを使用してから属性ロケーションを取得
    this.gl.useProgram(this.explosionProgram);
    const location = this.gl.getAttribLocation(this.explosionProgram, attributeName);
    
    if (location === -1) {
      console.warn(`属性 ${attributeName} が見つかりません`);
    }
    
    return { buffer, location, size };
  }
  
  addExplosion(position) {
    console.log("addExplosion呼び出し - 位置:", position);
    
    const explosion = {
      position: [...position],
      startTime: this.time,
      lines: [] // particles の代わりに lines を使用
    };
    
    // 爆発音を再生
    if (window.gameState && window.audioLoader) {
      playLightningExplosionSound(window.gameState, window.audioLoader);
    }
    
    // 地面と上空に広がる電撃の線（3D的な全方向放電）
    const groundLineCount = 12; // 地面放電線を少し減らす
    const upwardLineCount = 8; // 上向き放電線を追加
    const pointsPerLine = 10;
    
    console.log(`${groundLineCount + upwardLineCount}本の放電線を生成中（地面${groundLineCount}本、上空${upwardLineCount}本）...`);
    
    // === 地面放電（既存の処理） ===
    for (let i = 0; i < groundLineCount; i++) {
      const baseAngle = (Math.PI * 2 * i) / groundLineCount;
      const line = { points: [] };
      
      // ランダムな曲がり具合（非常に控えめ）
      const curveFactor = (Math.random() - 0.5) * 0.15; // 0.2から0.15に減少
      const zigzagAmplitude = 0.2 + Math.random() * 0.15; // さらに控えめに
      const verticalVariation = 0.3 + Math.random() * 0.4; // 縦方向の変化量
      
      // 各線に沿って連続的なポイントを生成
      for (let j = 0; j < pointsPerLine; j++) {
        const t = j / (pointsPerLine - 1); // 0から1の進行度
        const distance = t * 3.5; // 6から3.5に縮小（非常に局地的）
        
        // 地面に沿った水平方向のジグザグ
        const zigzag1 = Math.sin(t * Math.PI * 5) * zigzagAmplitude * (1 - t * 0.8);
        const zigzag2 = Math.cos(t * Math.PI * 4) * zigzagAmplitude * 0.4 * (1 - t * 0.6);
        const curve = Math.sin(t * Math.PI * 1.2) * curveFactor * distance * 0.1;
        
        // 縦方向（Y軸）の変化を追加
        const verticalWave1 = Math.sin(t * Math.PI * 3 + i * 0.5) * verticalVariation * t;
        const verticalWave2 = Math.cos(t * Math.PI * 4 + i * 0.3) * verticalVariation * 0.5 * t;
        const verticalJitter = (Math.random() - 0.5) * 0.1 * t; // 細かいランダム変化
        
        // 最終的な角度
        const finalAngle = baseAngle + curve;
        
        // 実際の座標計算
        const actualDistance = distance + zigzag1 + zigzag2;
        const x = Math.cos(finalAngle) * actualDistance;
        const z = Math.sin(finalAngle) * actualDistance;
        
        // Y座標の計算（地面から上方向にも広がる）
        const baseY = 0.05;
        const upwardSpread = Math.abs(verticalWave1 + verticalWave2) + verticalJitter * 2;
        const maxHeight = 2.0 * t; // 外側に行くほど高く上がる
        const y = baseY + Math.min(upwardSpread, maxHeight);
        
        // アニメーション用の遅延時間を計算（線ごと、ポイントごとに時間差）
        const lineDelay = i * 0.02; // 線ごとの遅延（20ms間隔）
        const pointDelay = j * 0.015; // ポイントごとの遅延（15ms間隔）
        const totalDelay = lineDelay + pointDelay;
        
        line.points.push({
          position: [
            x, // 爆発の中心からのX距離
            y, // 地面から縦方向にも変化
            z  // 爆発の中心からのZ距離
          ],
          velocity: [0, 0, 0],
          life: this.time + totalDelay, // 遅延を加えた開始時間
          size: 16 * (1 - t * 0.2), // サイズをさらに小さく
          angle: finalAngle + j * distance * 0.004,
          segmentIndex: j, // セグメントインデックスを追加
          maxDelay: lineDelay + (pointsPerLine - 1) * 0.015 // 最大遅延時間
        });
      }
      
      explosion.lines.push(line);
      console.log(`地面線${i}: ${line.points.length}ポイント生成`);
    }
    
    // === 上向き放電（新規追加） ===
    for (let i = 0; i < upwardLineCount; i++) {
      const baseAngle = (Math.PI * 2 * i) / upwardLineCount;
      const line = { points: [] };
      
      // 上向き放電の特性
      const curveFactor = (Math.random() - 0.5) * 0.2; // より直線的
      const zigzagAmplitude = 0.15 + Math.random() * 0.1; // より控えめなジグザグ
      const upwardHeight = 1.5 + Math.random() * 2.0; // 1.5-3.5単位の高さ
      
      // 上向き放電のポイント生成
      for (let j = 0; j < pointsPerLine; j++) {
        const t = j / (pointsPerLine - 1); // 0から1の進行度
        const horizontalDistance = t * 2.0; // 水平方向は控えめ（2単位まで）
        const verticalDistance = t * upwardHeight; // 上方向に伸びる
        
        // ジグザグパターン（上向きなので重力に逆らう感じ）
        const zigzag1 = Math.sin(t * Math.PI * 4) * zigzagAmplitude * (1 - t * 0.5);
        const zigzag2 = Math.cos(t * Math.PI * 3) * zigzagAmplitude * 0.3;
        const curve = Math.sin(t * Math.PI * 1.5) * curveFactor * horizontalDistance * 0.1;
        
        // 縦方向の揺らぎ（雷が上に伸びる時の自然な動き）
        const verticalWave = Math.sin(t * Math.PI * 2 + i * 0.5) * 0.1 * t;
        
        // 最終的な角度と座標
        const finalAngle = baseAngle + curve;
        const actualHorizontalDistance = horizontalDistance + zigzag1 + zigzag2;
        
        const x = Math.cos(finalAngle) * actualHorizontalDistance;
        const y = 0.1 + verticalDistance + verticalWave; // 地面から上に向かって
        const z = Math.sin(finalAngle) * actualHorizontalDistance;
        
        // アニメーション遅延（上向き放電は地面放電より少し遅れて開始）
        const lineDelay = (groundLineCount * 0.02) + (i * 0.03); // 地面放電後に開始
        const pointDelay = j * 0.02; // ポイントごとの遅延
        const totalDelay = lineDelay + pointDelay;
        
        line.points.push({
          position: [x, y, z],
          velocity: [0, 0, 0],
          life: this.time + totalDelay,
          size: 18 * (1 - t * 0.3), // 外側に行くほど細くなる
          angle: finalAngle + j * horizontalDistance * 0.005,
          segmentIndex: j,
          maxDelay: lineDelay + (pointsPerLine - 1) * 0.02
        });
      }
      
      explosion.lines.push(line);
      console.log(`上向き線${i}: ${line.points.length}ポイント生成（高さ${upwardHeight.toFixed(2)}）`);
    }
    
    console.log(`爆発エフェクト生成完了 - 総線数: ${explosion.lines.length}`);
    
    // ダメージ判定の設定（範囲をさらに狭く）
    if (window.gameState) {
      window.gameState.lightningDamageActive = true;
      window.gameState.lightningDamagePosition = new THREE.Vector3(position[0], position[1], position[2]);
      window.gameState.lightningDamageTimer = window.gameState.lightningDamageDuration;
      window.gameState.lightningDamageRadius = 4.0; // 3.0から4.0に拡大（上向き放電も含めるため）
      console.log("雷ダメージ判定を有効化 - 拡散位置:", position, "範囲:", window.gameState.lightningDamageRadius);
    }
    
    this.explosions.push(explosion);
    
    // 古い爆発を削除
    if (this.explosions.length > this.maxExplosions) {
      this.explosions.shift();
    }
    
    console.log("地面拡散エフェクト追加:", position, "爆発配列サイズ:", this.explosions.length);
  }
  
  renderExplosions(projectionMatrix, viewMatrix) {
    if (this.explosions.length === 0 || !this.explosionProgram) {
      return;
    }
    
    console.log(`爆発エフェクト描画開始 - 爆発数: ${this.explosions.length}`);
    
    this.gl.useProgram(this.explosionProgram);
    
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);
    this.gl.disable(this.gl.DEPTH_TEST);
    
    // 線の太さを設定
    this.gl.lineWidth(10.0); // 6.0から10.0により太くしてグロー効果強化
    
    // Uniformを設定
    this.gl.uniformMatrix4fv(this.explosionUniforms.projectionMatrix, false, projectionMatrix);
    this.gl.uniformMatrix4fv(this.explosionUniforms.viewMatrix, false, viewMatrix);
    this.gl.uniform1f(this.explosionUniforms.time, this.time);
    
    let totalLinesDrawn = 0;
    
    // 各爆発を描画
    for (let expIdx = 0; expIdx < this.explosions.length; expIdx++) {
      const explosion = this.explosions[expIdx];
      const age = this.time - explosion.startTime;
      
      if (age > this.explosionDuration / 1000) {
        console.log(`爆発${expIdx}は期限切れ (age: ${age.toFixed(3)})`);
        continue;
      }
      
      console.log(`爆発${expIdx}描画中 - age: ${age.toFixed(3)}, 線数: ${explosion.lines.length}`);
      
      this.gl.uniform3fv(this.explosionUniforms.explosionCenter, explosion.position);
      
      // 各放射線を個別に描画
      for (let lineIdx = 0; lineIdx < explosion.lines.length; lineIdx++) {
        const line = explosion.lines[lineIdx];
        
        // バッファーサイズをチェック
        if (line.points.length > this.maxExplosionParticles) {
          console.warn(`線のポイント数 ${line.points.length} がバッファーサイズ ${this.maxExplosionParticles} を超えています`);
          continue;
        }
        
        // 線の頂点データを作成
        const linePositions = new Float32Array(line.points.length * 3);
        const lineVelocities = new Float32Array(line.points.length * 3);
        const lineLifetimes = new Float32Array(line.points.length);
        const lineSizes = new Float32Array(line.points.length);
        const lineAngles = new Float32Array(line.points.length);
        
        for (let i = 0; i < line.points.length; i++) {
          const p = line.points[i];
          linePositions[i * 3] = p.position[0];
          linePositions[i * 3 + 1] = p.position[1];
          linePositions[i * 3 + 2] = p.position[2];
          
          lineVelocities[i * 3] = p.velocity[0];
          lineVelocities[i * 3 + 1] = p.velocity[1];
          lineVelocities[i * 3 + 2] = p.velocity[2];
          
          lineLifetimes[i] = p.life;
          lineSizes[i] = p.size;
          lineAngles[i] = p.angle || 0;
        }
        
        // バッファーをバインドして更新（エラーチェック付き）
        try {
          this.bindExplosionBuffer(this.explosionBuffers.position, linePositions);
          this.bindExplosionBuffer(this.explosionBuffers.velocity, lineVelocities);
          this.bindExplosionBuffer(this.explosionBuffers.life, lineLifetimes);
          this.bindExplosionBuffer(this.explosionBuffers.size, lineSizes);
          this.bindExplosionBuffer(this.explosionBuffers.angle, lineAngles);
          
          // WebGLエラーチェック
          let error = this.gl.getError();
          if (error !== this.gl.NO_ERROR) {
            console.error("バッファー更新後のWebGLエラー:", error);
            continue;
          }
          
          // 線として描画（LINE_STRIP）
          this.gl.drawArrays(this.gl.LINE_STRIP, 0, line.points.length);
          totalLinesDrawn++;
          
          // 描画後のエラーチェック
          error = this.gl.getError();
          if (error !== this.gl.NO_ERROR) {
            console.error("描画後のWebGLエラー:", error);
          }
        } catch (e) {
          console.error("爆発エフェクト描画エラー:", e);
          continue;
        }
      }
    }
    
    console.log(`爆発エフェクト描画完了 - 描画した線数: ${totalLinesDrawn}`);
    
    // 古い爆発を削除
    this.explosions = this.explosions.filter(exp => {
      const age = this.time - exp.startTime;
      return age <= this.explosionDuration / 1000;
    });
    
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.disable(this.gl.BLEND);
  }
  
  bindExplosionBuffer(bufferInfo, data) {
    if (bufferInfo.location === -1) {
      return; // 無効な属性ロケーションをスキップ
    }
    
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, bufferInfo.buffer);
    
    // バッファーサイズをチェック
    if (data.byteLength > bufferInfo.buffer.size) {
      // バッファーサイズが不足している場合は、新しいバッファーを作成
      this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.DYNAMIC_DRAW);
    } else {
      this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, data);
    }
    
    this.gl.enableVertexAttribArray(bufferInfo.location);
    this.gl.vertexAttribPointer(bufferInfo.location, bufferInfo.size, this.gl.FLOAT, false, 0, 0);
  }
}