/**
 * 衝突判定とダメージ処理を管理するモジュール
 */
import * as THREE from 'three';
import { applyDamage, applyDragonDamage } from './player.js';
import { gameOver } from './ui.js';

/**
 * ゲーム内の衝突判定を行う関数
 * @param {Object} gameState - ゲームの状態オブジェクト
 * @param {boolean} isRollingAnimationPlaying - ローリングアニメーション再生中かどうか
 */
export function checkCollisions(gameState, isRollingAnimationPlaying) {
    // プレイヤーの位置と当たり判定の半径を定義
    const playerPos = new THREE.Vector3(
        gameState.playerPosition.x,
        gameState.playerPosition.y,
        gameState.playerPosition.z
    );
    const playerRadius = 1.0; // プレイヤーの当たり判定の半径
    
    // プレイヤーと岩の衝突判定
    if (gameState.playerModel && gameState.rocks) {
        // 各岩との衝突をチェック
        for (const rock of gameState.rocks) {
            if (!rock.position) continue;
            
            // プレイヤーと岩の水平距離を計算
            const horizontalDistance = Math.sqrt(
                Math.pow(playerPos.x - rock.position.x, 2) +
                Math.pow(playerPos.z - rock.position.z, 2)
            );
            
            const collisionRadius = rock.collisionRadius || 1.5; // 衝突判定の距離
            
            // 岩の高さを計算（衝突半径に基づく概算）
            const rockHeight = gameState.groundLevel + (rock.scale || 1.0) * 1.5; // 高さを1.5倍に調整
            
            // 水平距離が近い場合の処理
            if (horizontalDistance < collisionRadius + 0.5) { // 判定を少し緩める
                // プレイヤーが岩の上にいるか下にいるかを判定
                if (playerPos.y >= rockHeight - 1.5) { // 判定範囲を広げる
                    // プレイヤーが岩の上にいる場合、着地判定
                    if (gameState.isJumping && gameState.verticalVelocity < 0) {
                        // 落下中の場合、岩の上に着地
                        gameState.playerPosition.y = rockHeight;
                        gameState.isJumping = false;
                        gameState.verticalVelocity = 0;
                        gameState.isOnRock = true; // 岩の上にいることを記録
                        // console.log("岩に着地しました"); // デバッグログを追加
                    }
                } else {
                    // プレイヤーが岩の下または側面にいる場合、押し戻す
                    const pushDirection = new THREE.Vector3(
                        playerPos.x - rock.position.x,
                        0,
                        playerPos.z - rock.position.z
                    ).normalize();
                    
                    // 距離に基づいて押し戻し強度を調整
                    const pushStrength = 0.2 * (1.0 - horizontalDistance / collisionRadius);
                    
                    // プレイヤーの位置を調整
                    gameState.playerPosition.x += pushDirection.x * pushStrength;
                    gameState.playerPosition.z += pushDirection.z * pushStrength;
                }
            }
        }
        
        // 岩から離れた場合、岩の上フラグをリセット
        // 全ての岩から離れているか確認
        let stillOnAnyRock = false;
        
        for (const otherRock of gameState.rocks) {
            if (!otherRock.position) continue;
            
            const otherDistance = Math.sqrt(
                Math.pow(playerPos.x - otherRock.position.x, 2) +
                Math.pow(playerPos.z - otherRock.position.z, 2)
            );
            
            const rockHeight = gameState.groundLevel + (otherRock.scale || 1.0) * 2.0;
            
            if (otherDistance < (otherRock.collisionRadius || 1.5) && 
                playerPos.y >= rockHeight - 1.0) {
                stillOnAnyRock = true;
                break;
            }
        }
        
        // どの岩の上にもいない場合
        if (!stillOnAnyRock && gameState.isOnRock) {
            gameState.isOnRock = false;
            // 空中に浮いた状態になるので、ジャンプ状態に戻す
            gameState.isJumping = true;
            gameState.verticalVelocity = 0; // 初速度はゼロから
        }
    }
    
    // プレイヤーとドラゴンの衝突判定
    if (gameState.playerModel && gameState.dragonModel && !gameState.isDragonDefeated) {
        const dragonPos = gameState.dragonModel.position.clone();
        const dragonRadius = 5.0; // ドラゴンの当たり判定の半径
        
        const distance = playerPos.distanceTo(dragonPos);
        
        if (distance < playerRadius + dragonRadius) {
            // 衝突時の処理（プレイヤーを押し戻す）
            const pushDirection = new THREE.Vector3(
                playerPos.x - dragonPos.x,
                0, // Y軸方向には押し戻さない
                playerPos.z - dragonPos.z
            ).normalize();
            
            // プレイヤーの位置を調整（より強く押し戻す）
            gameState.playerPosition.x += pushDirection.x * 0.3;
            gameState.playerPosition.z += pushDirection.z * 0.3;
        }
    }
    
    // プレイヤーのビームとドラゴンの衝突判定
    // 注意: 新しいビームエフェクトでは、衝突判定はbeamEffect.js内で行われるため、
    // ここでの処理は不要になりました。コメントアウトして残しておきます。
    /*
    if (gameState.dragonModel && gameState.beamEffects && gameState.beamEffects.length > 0) {
        const dragonPos = gameState.dragonModel.position.clone();
        const dragonRadius = 3.0; // ドラゴンの当たり判定の半径
        
        // 各ビームエフェクトをチェック
        for (const beam of gameState.beamEffects) {
            if (!beam.geometry || !beam.geometry.attributes || !beam.geometry.attributes.position) {
                console.warn('Invalid beam geometry for collision check');
                continue;
            }
            
            const positions = beam.geometry.attributes.position.array;
            const particleCount = positions.length / 3;
            
            // 各パーティクルとドラゴンの衝突をチェック
            for (let i = 0; i < particleCount; i++) {
                const particlePos = new THREE.Vector3(
                    positions[i * 3],
                    positions[i * 3 + 1],
                    positions[i * 3 + 2]
                );
                
                // 画面外に移動したパーティクルは無視
                if (particlePos.x > 1000 || particlePos.y > 1000 || particlePos.z > 1000) {
                    continue;
                }
                
                const distance = particlePos.distanceTo(dragonPos);
                
                // 衝突判定
                if (distance < dragonRadius) {
                    console.log(`ビームとドラゴンの衝突を検出！距離: ${distance.toFixed(2)}`);
                    
                    // ドラゴンにダメージを与える
                    if (typeof gameState.applyDragonDamage === 'function') {
                        gameState.applyDragonDamage(gameState, 5); // 5ダメージ
                    }
                    
                    // パーティクルを画面外に移動して非表示にする
                    for (let j = 0; j < particleCount; j++) {
                        positions[j * 3] = 2000;
                        positions[j * 3 + 1] = 2000;
                        positions[j * 3 + 2] = 2000;
                    }
                    
                    // 位置情報の更新をGPUに通知
                    beam.geometry.attributes.position.needsUpdate = true;
                    
                    // 一度衝突を検出したら、このビームの処理を終了
                    break;
                }
            }
        }
    }
    */
    
    // 無敵状態またはローリング中ならプレイヤーの衝突判定をスキップ
    if (gameState.isInvincible || gameState.isRolling || isRollingAnimationPlaying) {
        // console.log("無敵状態: ", gameState.isInvincible, "ローリング中: ", gameState.isRolling, "ローリングアニメーション中: ", isRollingAnimationPlaying);
        return;
    }
    
    // 地面の炎とプレイヤーの衝突判定（岩の上にいない場合のみ）
    if (!gameState.isOnRock) {
        // ドラゴンの炎エフェクトとの衝突判定
        for (let i = 0; i < gameState.dragonFlameEffects.length; i++) {
            const flame = gameState.dragonFlameEffects[i];
            
            // flame.geometryが存在するか確認
            if (!flame.geometry || !flame.geometry.attributes || !flame.geometry.attributes.position) {
                console.warn("炎エフェクトのジオメトリが不正です", flame);
                continue;
            }
            
            const positions = flame.geometry.attributes.position.array;
            const isGroundFlame = flame.geometry.attributes.isGroundFlame.array;
            
            // パーティクルの数を制限して処理を軽くする
            const checkStep = 20; // 20個おきにチェック
            
            // 各パーティクルとの距離をチェック
            for (let j = 0; j < positions.length; j += 3 * checkStep) {
                // 配列の範囲外アクセスを防止
                if (j >= positions.length) break;
                
                // 地面の炎パーティクルのみチェック
                const particleIndex = Math.floor(j / 3);
                if (particleIndex >= isGroundFlame.length) continue;
                
                // 地面の炎のみ衝突判定
                if (isGroundFlame[particleIndex] === 1) {
                    const particlePos = new THREE.Vector3(
                        positions[j],
                        positions[j + 1],
                        positions[j + 2]
                    );
                    
                    // 画面外に移動したパーティクル（2000,2000,2000）は無視
                    if (particlePos.x > 1000 || particlePos.y > 1000 || particlePos.z > 1000) {
                        continue;
                    }
                    
                    // 水平方向の距離のみを計算（プレイヤーは地面に立っているため）
                    const horizontalDistance = Math.sqrt(
                        Math.pow(particlePos.x - playerPos.x, 2) +
                        Math.pow(particlePos.z - playerPos.z, 2)
                    );
                    
                    // 地面の炎の衝突半径を設定（水平距離のみで判定）
                    const groundFlameRadius = 1.5; // 地面の炎の広がりを考慮
                    
                    // 衝突判定
                    if (horizontalDistance < playerRadius + groundFlameRadius) {
                        // console.log(`地面の炎との衝突を検出！距離: ${horizontalDistance.toFixed(2)}`);
                        
                        // ダメージを与える
                        applyDamage(gameState, gameState.groundFireDamage || 10, gameOver);
                        return; // 一度ダメージを受けたら処理を終了
                    }
                }
            }
        }
    }
    
    // 空中の炎とプレイヤーの衝突判定（ジャンプ中は当たらない）
    if (!gameState.isJumping) {
        for (let i = 0; i < gameState.dragonFlameEffects.length; i++) {
            const flame = gameState.dragonFlameEffects[i];
            
            // flame.geometryが存在するか確認
            if (!flame.geometry || !flame.geometry.attributes || !flame.geometry.attributes.position) {
                console.warn("炎エフェクトのジオメトリが不正です", flame);
                continue;
            }
            
            const positions = flame.geometry.attributes.position.array;
            const isGroundFlame = flame.geometry.attributes.isGroundFlame ? flame.geometry.attributes.isGroundFlame.array : null;
            
            // パーティクルの数を制限して処理を軽くする（全パーティクルをチェックすると重い）
            const checkStep = 30; // 30個おきにチェック
            const maxParticles = positions.length / 3;
            
            // 各パーティクルとの距離をチェック
            for (let j = 0; j < positions.length; j += 3 * checkStep) {
                // 配列の範囲外アクセスを防止
                if (j >= positions.length) break;
                
                // 地面の炎は別処理で判定するためスキップ
                const particleIndex = Math.floor(j / 3);
                if (isGroundFlame && isGroundFlame[particleIndex] === 1) continue;
                
                const particlePos = new THREE.Vector3(
                    positions[j],
                    positions[j + 1],
                    positions[j + 2]
                );
                
                // 画面外に移動したパーティクル（2000,2000,2000）は無視
                if (particlePos.x > 1000 || particlePos.y > 1000 || particlePos.z > 1000) {
                    continue;
                }
                
                // パーティクルとプレイヤーの距離を計算
                const distance = particlePos.distanceTo(playerPos);
                
                // 衝突判定（距離がプレイヤーの半径 + パーティクルサイズより小さい場合）
                if (distance < playerRadius + (gameState.dragonFlameSize || 1.0)) {
                    // console.log(`空中の炎との衝突を検出！距離: ${distance.toFixed(2)}`);
                    
                    // ダメージを与える
                    applyDamage(gameState, 35, gameOver); // 空中の炎のダメージを更に大幅に増加
                    return; // 一度ダメージを受けたら処理を終了
                }
            }
        }
    }
} 