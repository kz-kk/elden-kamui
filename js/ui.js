// UIに関連する機能を実装するモジュール

/**
 * プレイヤーの体力インジケーターを更新する関数
 * @param {Object} gameState - ゲームの状態オブジェクト
 */
export function updateHealthBar(gameState) {
    const healthPercent = (gameState.currentHealth / gameState.playerHealth) * 100;
    const healthBar = document.getElementById('healthBar');
    
    if (healthBar) {
        healthBar.style.width = `${healthPercent}%`;
        // 回復中は深い緑色、通常時は赤色
        if (gameState.isHealing) {
            healthBar.style.backgroundColor = '#006400'; // 深い緑色
        } else {
            healthBar.style.backgroundColor = '#9b000f'; // 赤色
        }
    }
    
    // ダメージを受けた時の点滅効果
    if (gameState.damageFlashTimer > 0) {
        gameState.damageFlashTimer--;
        
        // 点滅効果（偶数フレームで表示、奇数フレームで非表示）
        if (gameState.damageFlashTimer % 2 === 0) {
            healthBar.style.opacity = '1.0';
        } else {
            healthBar.style.opacity = '0.5';
        }
    } else {
        healthBar.style.opacity = '1.0';
    }
    
    // ドラゴンの体力インジケーターも更新
    updateDragonHealthBar(gameState);
}

/**
 * ドラゴンの体力インジケーターを更新する関数
 * @param {Object} gameState - ゲームの状態オブジェクト
 */
export function updateDragonHealthBar(gameState) {
    const healthPercent = (gameState.currentDragonHealth / gameState.dragonHealth) * 100;
    const healthBar = document.getElementById('dragonHealthBar');
    
    if (healthBar) {
        healthBar.style.width = `${healthPercent}%`;
        
        // 色は常に#9b000fに固定
        healthBar.style.backgroundColor = '#9b000f';
        
        // ダメージを受けた時の点滅効果
        if (gameState.dragonDamageFlashTimer > 0) {
            gameState.dragonDamageFlashTimer--;
            
            // 点滅効果（偶数フレームで表示、奇数フレームで非表示）
            if (gameState.dragonDamageFlashTimer % 2 === 0) {
                healthBar.style.opacity = '1.0';
            } else {
                healthBar.style.opacity = '0.5';
            }
        } else {
            healthBar.style.opacity = '1.0';
        }
    }
    
    // ドラゴンが倒されたら非表示
    if (gameState.isDragonDefeated) {
        const dragonContainer = document.getElementById('dragonHealthContainer');
        if (dragonContainer) {
            dragonContainer.style.display = 'none';
        }
    }
}

/**
 * ゲームオーバー画面を表示する関数
 * @param {Object} gameState - ゲームの状態オブジェクト
 */
export function gameOver(gameState) {
    gameState.isGameOver = true;
    
    // ゲームオーバー画面を表示
    const gameOverScreen = document.getElementById('gameOverScreen');
    gameOverScreen.style.display = 'flex';
    
    // console.log("ゲームオーバー！");
}

/**
 * ゲームをリスタートする関数
 * @param {Object} gameState - ゲームの状態オブジェクト
 * @param {THREE.Scene} scene - Three.jsのシーンオブジェクト
 */
export function restartGame(gameState, scene) {
    // ゲームオーバー画面を非表示
    document.getElementById('gameOverScreen').style.display = 'none';
    
    // ゲーム状態をリセット
    gameState.currentHealth = gameState.playerHealth;
    gameState.isGameOver = false;
    gameState.isInvincible = false;
    gameState.invincibleTimer = 0;
    gameState.damageFlashTimer = 0;
    
    // ドラゴンの状態をリセット
    gameState.currentDragonHealth = gameState.dragonHealth;
    gameState.isDragonInvincible = false;
    gameState.dragonInvincibleTimer = 0;
    gameState.dragonDamageFlashTimer = 0;
    gameState.isDragonDefeated = false;
    
    // ドラゴンを再表示
    if (gameState.dragonModel) {
        gameState.dragonModel.visible = true;
    }
    
    // プレイヤーの位置をリセット
    gameState.playerPosition.set(0, gameState.groundLevel, 0);
    
    // 炎エフェクトをすべて削除
    for (let i = gameState.dragonFlameEffects.length - 1; i >= 0; i--) {
        const flame = gameState.dragonFlameEffects[i];
        scene.remove(flame.particles);
        flame.geometry.dispose();
        flame.material.dispose();
    }
    gameState.dragonFlameEffects = [];
    
    // ビームエフェクトをすべて削除
    for (let i = gameState.beamEffects.length - 1; i >= 0; i--) {
        const beam = gameState.beamEffects[i];
        scene.remove(beam.particles);
        beam.geometry.dispose();
        beam.material.dispose();
    }
    gameState.beamEffects = [];
    
    // 黄色いパーティクルエフェクトをすべて削除
    for (let i = gameState.yellowParticleEffects.length - 1; i >= 0; i--) {
        const yellowEffect = gameState.yellowParticleEffects[i];
        scene.remove(yellowEffect.particles);
        yellowEffect.geometry.dispose();
        yellowEffect.material.dispose();
    }
    gameState.yellowParticleEffects = [];
    
    // パーティクル柱エフェクトをすべて削除
    for (let i = gameState.particleColumnEffects.length - 1; i >= 0; i--) {
        const column = gameState.particleColumnEffects[i];
        scene.remove(column.particles);
        scene.remove(column.magicCircle);
        column.geometry.dispose();
        column.material.dispose();
        column.magicCircleMaterial.dispose();
    }
    gameState.particleColumnEffects = [];
    
    // 体力インジケーターを更新
    updateHealthBar(gameState);
    
    // console.log("ゲームをリスタートしました");
}

/**
 * リスタートボタンのイベントリスナーを設定する関数
 * @param {Object} gameState - ゲームの状態オブジェクト
 * @param {THREE.Scene} scene - Three.jsのシーンオブジェクト
 */
export function setupRestartButton(gameState, scene) {
    document.getElementById('restartButton').addEventListener('click', function() {
        restartGame(gameState, scene);
    });
}

/**
 * 勝利画面を表示する関数
 * @param {Object} gameState - ゲームの状態オブジェクト
 */
export function showWinScreen(gameState) {
    console.log('showWinScreen関数が呼び出されました');
    // 勝利画面を表示
    const winScreen = document.getElementById('winScreen');
    console.log('winScreen element:', winScreen);
    if (winScreen) {
        winScreen.style.display = 'flex';
        console.log('勝利画面を表示しました');
    } else {
        console.error('winScreen要素が見つかりません');
    }
    
    // ドラゴンの体力バーを非表示
    const dragonContainer = document.getElementById('dragonHealthContainer');
    if (dragonContainer) {
        dragonContainer.style.display = 'none';
    }
    
    console.log("You Win!");
}

/**
 * 勝利画面のリスタートボタンのイベントリスナーを設定する関数
 * @param {Object} gameState - ゲームの状態オブジェクト
 * @param {THREE.Scene} scene - Three.jsのシーンオブジェクト
 */
export function setupWinButton(gameState, scene) {
    document.getElementById('winButton').addEventListener('click', function() {
        // 勝利画面を非表示
        document.getElementById('winScreen').style.display = 'none';
        
        // ドラゴンの体力バーを再表示
        const dragonContainer = document.getElementById('dragonHealthContainer');
        if (dragonContainer) {
            dragonContainer.style.display = 'block';
        }
        
        restartGame(gameState, scene);
    });
} 