/**
 * ドラゴン関連の機能を管理するモジュール
 */
import * as THREE from 'three';

/**
 * ドラゴンの行動処理
 * @param {Object} gameState - ゲームの状態オブジェクト
 */
export function updateDragon(gameState) {
    if (!gameState.dragonModel || !gameState.playerModel) return;
    
    // ドラゴンが撃破されている場合は何もしない
    if (gameState.isDragonDefeated) return;

    // ドラゴンの状態管理の初期化
    if (!gameState.dragonState) {
        gameState.dragonState = {
            currentMode: 'fly',    // 'fly' または 'wait'
            flyCount: 0,           // 飛行回数カウンター
            waitCount: 0,          // 待機回数カウンター
            actionTimer: 0,        // アクション時間カウンター
            flyDuration: 300,      // 1回の飛行持続時間（フレーム）
            waitDuration: 180      // 1回の待機持続時間（フレーム）
        };
    }

    // プレイヤーの方向を向く
    const dragonPosition = gameState.dragonModel.position;
    // gameState.dragonPositionを更新
    gameState.dragonPosition = dragonPosition.clone();
    
    // 初期設定 - ドラゴンの周回パラメータ
    if (!gameState.dragonOrbitAngle) {
        gameState.dragonOrbitAngle = 0;
        gameState.dragonOrbitRadius = 15; // プレイヤーからの距離
        gameState.dragonOrbitSpeed = 0.005; // 周回速度を大幅に減少（0.02→0.005）
        gameState.dragonHoverHeight = -2.0; // 基本飛行高度
        gameState.dragonHoverAmplitude = 2.0; // 上下動の振幅を減少（2.0→1.0）
        gameState.dragonHoverFrequency = 0.1; // 上下動の周波数を減少（0.15→0.03）

        // 炎攻撃設定の初期化
        gameState.dragonFlameTargetPlayer = true; // デフォルトでプレイヤーを狙う
        gameState.dragonFlameMaxCooldown = 180; // クールダウン時間を延長（60→180フレーム）
        gameState.dragonFlameCooldown = 0; // 初期クールダウンを0に設定して早めに攻撃
        gameState.dragonFlameChance = 0.05; // 炎を吹き出す確率を低下（0.2→0.05）
        gameState.dragonFlameGroundTarget = true; // 地面を狙うフラグ
        gameState.dragonFlameTargetPlayerPosition = true; // プレイヤー位置を狙うフラグ
        gameState.dragonFlameAggressiveness = 0.4; // 攻撃性を低下（0.8→0.4）
    }
    
    // アクションタイマーの更新
    gameState.dragonState.actionTimer++;

    // モード切り替えの判定
    if (gameState.dragonState.currentMode === 'fly') {
        if (gameState.dragonState.actionTimer >= gameState.dragonState.flyDuration) {
            gameState.dragonState.flyCount++;
            gameState.dragonState.actionTimer = 0;

            // 2回の飛行が完了したら待機モードへ
            if (gameState.dragonState.flyCount >= 2) {
                gameState.dragonState.currentMode = 'wait';
                gameState.dragonState.flyCount = 0;
                gameState.dragonState.waitCount = 0;
                
                // 待機モードのアニメーションに切り替え
                if (gameState.dragonMixer) {
                    const waitAction = gameState.dragonMixer.clipAction(gameState.dragonAnimations.wait);
                    waitAction.reset();
                    waitAction.play();
                }
            }
        }
    } else { // wait mode
        if (gameState.dragonState.actionTimer >= gameState.dragonState.waitDuration) {
            gameState.dragonState.waitCount++;
            gameState.dragonState.actionTimer = 0;

            // 3回の待機が完了したら飛行モードへ
            if (gameState.dragonState.waitCount >= 3) {
                gameState.dragonState.currentMode = 'fly';
                gameState.dragonState.waitCount = 0;
                gameState.dragonState.flyCount = 0;
                
                // 飛行モードのアニメーションに切り替え
                if (gameState.dragonMixer) {
                    const flyAction = gameState.dragonMixer.clipAction(gameState.dragonAnimations.fly);
                    flyAction.reset();
                    flyAction.play();
                }
            }
        }
    }

    if (gameState.dragonState.currentMode === 'fly') {
        // 飛行モードの移動処理
        // 高度に応じて速度を調整（低空ほど速く）
        const heightFromGround = dragonPosition.y - gameState.groundLevel;
        const speedMultiplier = Math.max(1.0, 3.0 - heightFromGround * 1.5); // 高度が低いほど速度上昇
        gameState.dragonOrbitAngle += gameState.dragonOrbitSpeed * speedMultiplier;
        
        // 高度変化の計算（サインカーブで上下動）
        const hoverOffset = Math.sin(gameState.dragonOrbitAngle * 5) * gameState.dragonHoverAmplitude;
        
        // 新しい位置を計算（プレイヤーを中心とした円周上）
        // 低空時は旋回半径も小さくする
        const radiusMultiplier = Math.min(1.0, 0.7 + heightFromGround * 0.1);
        const currentRadius = gameState.dragonOrbitRadius * radiusMultiplier;
        
        const newX = gameState.playerPosition.x + Math.cos(gameState.dragonOrbitAngle) * currentRadius;
        const newY = gameState.dragonHoverHeight + hoverOffset;
        const newZ = gameState.playerPosition.z + Math.sin(gameState.dragonOrbitAngle) * currentRadius;
        
        // ドラゴンの位置を更新
        dragonPosition.set(newX, newY, newZ);

        // 低空飛行時は傾きを強める
        const baseTiltAmount = 0.25;
        const tiltMultiplier = Math.min(2.0, 1.0 + (3.0 - heightFromGround) * 0.2);
        const currentTiltAmount = baseTiltAmount * tiltMultiplier;
        
        // 移動方向に沿った傾きを計算
        const tangentX = -Math.sin(gameState.dragonOrbitAngle);
        const tangentZ = Math.cos(gameState.dragonOrbitAngle);
        
        // 傾きを適用
        gameState.dragonModel.rotation.z = tangentX * currentTiltAmount;
        gameState.dragonModel.rotation.x = -0.1 + tangentZ * currentTiltAmount * 0.6;
    } else {
        // 待機モードの処理（地面に着地）
        // 地面レベルにゆっくりと降下
        const targetY = gameState.groundLevel;
        const currentY = dragonPosition.y;
        const landingSpeed = 0.1;
        
        // 現在の高さと目標の高さの差を計算し、その差に応じて徐々に高度を調整
        const heightDiff = targetY - currentY;
        dragonPosition.y += heightDiff * landingSpeed;
    }
    
    // プレイヤーとドラゴンの方向ベクトルを計算
    const direction = new THREE.Vector3(
        gameState.playerPosition.x - dragonPosition.x,
        0, // Y軸方向は無視（水平方向のみ）
        gameState.playerPosition.z - dragonPosition.z
    ).normalize();

    // ドラゴンの向きを更新（プレイヤーに向ける）
    const angle = Math.atan2(direction.x, direction.z);
    
    // 現在の回転と目標の回転の差を計算
    let currentRotation = gameState.dragonModel.rotation.y;
    
    // 角度の正規化（-π〜πの範囲に収める）
    while (currentRotation < -Math.PI) currentRotation += Math.PI * 2;
    while (currentRotation > Math.PI) currentRotation -= Math.PI * 2;
    
    // 最短経路で回転するための調整
    let rotationDiff = angle - currentRotation;
    while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
    while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
    
    // 滑らかに回転させる（補間）
    const rotationSpeed = gameState.dragonState.currentMode === 'fly' ? 0.05 : 0.1;
    gameState.dragonModel.rotation.y += rotationDiff * rotationSpeed;
    
    // ドラゴンの炎吹き出し処理
    if (gameState.dragonFlameCooldown <= 0) {
        // 待機モード時は炎を吐かない
        if (gameState.dragonState.currentMode === 'wait') {
            return;
        }

        // プレイヤーとの距離を計算
        const distanceToPlayer = dragonPosition.distanceTo(gameState.playerPosition);
        
        // 距離が近いほど攻撃確率を上げる
        const distanceMultiplier = Math.max(0.5, Math.min(2.0, 30 / distanceToPlayer));
        const adjustedFlameChance = gameState.dragonFlameChance * distanceMultiplier;
        
        // より積極的に攻撃を行う
        if (Math.random() < adjustedFlameChance || distanceToPlayer < 10) {
            // プレイヤーの現在位置を狙う
            const targetPosition = gameState.playerPosition.clone();
            
            // プレイヤーの移動方向を予測
            if (gameState.playerVelocity) {
                // プレイヤーの0.3秒後の予測位置を計算
                targetPosition.x += gameState.playerVelocity.x * 0.3;
                targetPosition.z += gameState.playerVelocity.z * 0.3;
            }
            
            // 地面を狙うフラグが立っている場合は、プレイヤーの足元を狙う
            if (gameState.dragonFlameGroundTarget) {
                targetPosition.y = gameState.groundLevel + 0.1; // 地面レベルに設定
            }
            
            // ドラゴンの口の位置を計算
            const mouthPosition = new THREE.Vector3(
                dragonPosition.x + Math.sin(gameState.dragonModel.rotation.y) * 4,
                dragonPosition.y + 5,
                dragonPosition.z + Math.cos(gameState.dragonModel.rotation.y) * 4
            );
            
            // ドラゴンの口からターゲットへの方向を計算
            const playerDirection = new THREE.Vector3();
            playerDirection.subVectors(targetPosition, mouthPosition).normalize();
            
            // プレイヤー方向に炎を発射するための情報をセット
            gameState.dragonFlameTargetDirection = playerDirection.clone();
            gameState.dragonFlameOrigin = mouthPosition.clone();
            gameState.dragonFlameTargetPosition = targetPosition.clone();
            
            // 炎の効果音を再生
            if (gameState.sounds.fire && gameState.sounds.fire.buffer) {
                if (gameState.sounds.fire.isPlaying) {
                    gameState.sounds.fire.stop();
                }
                gameState.sounds.fire.play();
            }
            
            // パチパチ音を再生
            if (gameState.sounds.patipati && gameState.sounds.patipati.buffer) {
                if (gameState.sounds.patipati.isPlaying) {
                    gameState.sounds.patipati.stop();
                }
                gameState.sounds.patipati.play();
            }
            
            // クールダウンをリセット（距離に応じて調整）
            const cooldownMultiplier = Math.max(0.5, Math.min(1.5, distanceToPlayer / 15));
            // 待機モード時はクールダウンを短縮
            const baseCooldown = gameState.dragonState.currentMode === 'wait' ? 
                gameState.dragonFlameMaxCooldown * 0.7 : gameState.dragonFlameMaxCooldown;
            gameState.dragonFlameCooldown = Math.floor(baseCooldown * cooldownMultiplier);
            
            // console.log("ドラゴンがプレイヤーの現在位置めがけて炎を吹き出した！", 
            //             "目標位置:", targetPosition.x.toFixed(2), targetPosition.y.toFixed(2), targetPosition.z.toFixed(2),
            //             "距離:", distanceToPlayer.toFixed(2));
            
            // createDragonFlameEffect関数の呼び出しをmain.jsで行うためのフラグを設定
            gameState.shouldCreateDragonFlame = true;
            // 炎の目標がプレイヤーであることを明示
            gameState.dragonFlameTargetPlayer = true;
        }
    } else {
        // クールダウンを減少（プレイヤーが近いほど早く減少）
        const distanceToPlayer = dragonPosition.distanceTo(gameState.playerPosition);
        const cooldownReduction = Math.max(1, Math.min(2, 20 / distanceToPlayer));
        gameState.dragonFlameCooldown -= cooldownReduction;
    }
} 