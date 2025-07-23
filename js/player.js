/**
 * プレイヤーとドラゴンの無敵時間を管理するモジュール
 */

/**
 * 無敵時間を更新する関数
 * @param {Object} gameState - ゲームの状態オブジェクト
 */
export function updateInvincibility(gameState) {
    // プレイヤーの無敵時間更新
    if (gameState.isInvincible) {
        gameState.invincibleTimer--;
        
        // プレイヤーモデルの点滅効果
        if (gameState.playerModel) {
            // 偶数フレームで表示、奇数フレームで半透明
            if (gameState.invincibleTimer % 6 < 3) {
                gameState.playerModel.traverse(function(child) {
                    if (child.isMesh) {
                        child.material.opacity = 0.5;
                        child.material.transparent = true;
                    }
                });
            } else {
                gameState.playerModel.traverse(function(child) {
                    if (child.isMesh) {
                        child.material.opacity = 1.0;
                        child.material.transparent = false;
                    }
                });
            }
        }
        
        // 無敵時間が終了したら
        if (gameState.invincibleTimer <= 0) {
            gameState.isInvincible = false;
            
            // プレイヤーモデルを通常の表示に戻す
            if (gameState.playerModel) {
                gameState.playerModel.traverse(function(child) {
                    if (child.isMesh) {
                        child.material.opacity = 1.0;
                        child.material.transparent = false;
                    }
                });
            }
        }
    }
    
    // ドラゴンの無敵時間更新
    if (gameState.isDragonInvincible) {
        gameState.dragonInvincibleTimer--;
        
        // ドラゴンモデルの点滅効果
        if (gameState.dragonModel) {
            // 偶数フレームで表示、奇数フレームで半透明
            if (gameState.dragonInvincibleTimer % 6 < 3) {
                gameState.dragonModel.traverse(function(child) {
                    if (child.isMesh) {
                        child.material.opacity = 0.5;
                        child.material.transparent = true;
                    }
                });
            } else {
                gameState.dragonModel.traverse(function(child) {
                    if (child.isMesh) {
                        child.material.opacity = 1.0;
                        child.material.transparent = false;
                    }
                });
            }
        }
        
        // 無敵時間が終了したら
        if (gameState.dragonInvincibleTimer <= 0) {
            gameState.isDragonInvincible = false;
            
            // ドラゴンモデルを通常の表示に戻す
            if (gameState.dragonModel) {
                gameState.dragonModel.traverse(function(child) {
                    if (child.isMesh) {
                        child.material.opacity = 1.0;
                        child.material.transparent = false;
                    }
                });
            }
        }
    }
}

/**
 * プレイヤーにダメージを適用する関数
 * @param {Object} gameState - ゲームの状態オブジェクト
 * @param {number} amount - ダメージ量
 * @param {Function} gameOverCallback - ゲームオーバー時に呼び出すコールバック関数
 */
export function applyDamage(gameState, amount, gameOverCallback) {
    // 体力を減らす
    gameState.currentHealth -= amount;
    console.log(`ダメージを受けた！ダメージ量: ${amount}, 残り体力: ${gameState.currentHealth}`);
    
    // 体力が0以下になったらゲームオーバー
    if (gameState.currentHealth <= 0) {
        gameState.currentHealth = 0;
        gameOverCallback(gameState);
        return;
    }
    
    // ダメージ効果音を再生
    if (gameState.sounds.attack && gameState.sounds.attack.buffer) {
        if (gameState.sounds.attack.isPlaying) {
            gameState.sounds.attack.stop();
        }
        gameState.sounds.attack.play();
    }
    
    // 無敵状態にする
    gameState.isInvincible = true;
    gameState.invincibleTimer = gameState.invincibleTime;
    
    // ダメージ点滅タイマーをセット
    gameState.damageFlashTimer = 20; // 20フレーム間点滅
}

/**
 * ドラゴンにダメージを適用する関数
 * @param {Object} gameState - ゲームの状態オブジェクト
 * @param {number} amount - ダメージ量
 */
export function applyDragonDamage(gameState, amount) {
    // ドラゴンが無敵状態ならダメージを与えない
    if (gameState.isDragonInvincible) return;
    
    // 体力を減らす
    gameState.currentDragonHealth -= amount;
    console.log(`ドラゴンにダメージを与えた！ダメージ量: ${amount}, 残り体力: ${gameState.currentDragonHealth}`);
    
    // 体力が0以下になったらドラゴン撃破
    if (gameState.currentDragonHealth <= 0) {
        gameState.currentDragonHealth = 0;
        gameState.isDragonDefeated = true;
        
        // ドラゴン撃破時の処理
        if (gameState.dragonModel) {
            // ドラゴンを非表示にする（または撃破アニメーションを再生）
            gameState.dragonModel.visible = false;
        }
        
        console.log("ドラゴンを撃破した！");
        return;
    }
    
    // ダメージ効果音を再生
    if (gameState.sounds.attack && gameState.sounds.attack.buffer) {
        if (gameState.sounds.attack.isPlaying) {
            gameState.sounds.attack.stop();
        }
        gameState.sounds.attack.play();
    }
    
    // 無敵状態にする
    gameState.isDragonInvincible = true;
    gameState.dragonInvincibleTimer = gameState.dragonInvincibleTime;
    
    // ダメージ点滅タイマーをセット
    gameState.dragonDamageFlashTimer = 20; // 20フレーム間点滅
} 