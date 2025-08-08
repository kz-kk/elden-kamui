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
    
    // モバイルジョイスティックとアクションボタンを非表示
    const mobileJoystick = document.getElementById('mobileJoystick');
    if (mobileJoystick) {
        mobileJoystick.style.display = 'none';
    }
    
    const mobileActionButtons = document.getElementById('mobileActionButtons');
    if (mobileActionButtons) {
        mobileActionButtons.style.display = 'none';
    }
    
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
    
    // パーティクル柱エフェクトを安全に削除
    if (gameState.particleColumnEffects && gameState.particleColumnEffects.length) {
        for (let i = gameState.particleColumnEffects.length - 1; i >= 0; i--) {
            const column = gameState.particleColumnEffects[i];
            if (!column) continue;
            try {
                if (column.particles) scene.remove(column.particles);
                if (column.magicCircle) scene.remove(column.magicCircle);
                if (column.geometry && column.geometry.dispose) column.geometry.dispose();
                if (column.material && column.material.dispose) column.material.dispose();
                if (column.magicCircle && column.magicCircle.geometry && column.magicCircle.geometry.dispose) column.magicCircle.geometry.dispose();
                if (column.magicCircle && column.magicCircle.material && column.magicCircle.material.dispose) column.magicCircle.material.dispose();
            } catch (e) {
                console.warn('columnEffect dispose 中にエラー:', e);
            }
        }
    }
    gameState.particleColumnEffects = [];
    
    // 体力インジケーターを更新
    updateHealthBar(gameState);
    
    // ドラゴンの体力バーを再表示
    const dragonContainer = document.getElementById('dragonHealthContainer');
    if (dragonContainer) {
        dragonContainer.style.display = 'block';
    }
    
    // モバイルデバイスの場合、ジョイスティックとアクションボタンを再表示
    const isMobile = window.innerWidth <= 968 || window.matchMedia('(max-width: 968px)').matches;
    console.log('リスタート時のモバイル判定:', { 
        windowWidth: window.innerWidth, 
        mediaQuery: window.matchMedia('(max-width: 968px)').matches,
        isMobile 
    });
    
    // モバイルUI要素を取得
    const mobileJoystick = document.getElementById('mobileJoystick');
    const mobileActionButtons = document.getElementById('mobileActionButtons');
    
    if (isMobile) {
        if (mobileJoystick) {
            mobileJoystick.style.display = 'block';
            console.log('ジョイスティックを再表示しました');
        } else {
            console.log('ジョイスティック要素が見つかりません');
        }
        
        if (mobileActionButtons) {
            mobileActionButtons.style.display = 'flex';
            console.log('アクションボタンを再表示しました');
        } else {
            console.log('アクションボタン要素が見つかりません');
        }
    } else {
        console.log('デスクトップ環境のため、モバイルUIは表示しません');
        // デスクトップでもフォールバック: タッチ操作が可能な場合は表示
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            console.log('タッチデバイス検出、モバイルUIを表示します');
            if (mobileJoystick) {
                mobileJoystick.style.display = 'block';
            }
            if (mobileActionButtons) {
                mobileActionButtons.style.display = 'flex';
            }
        }
    }
    
    // console.log("ゲームをリスタートしました");
}

/**
 * リスタートボタンのイベントリスナーを設定する関数
 * @param {Object} gameState - ゲームの状態オブジェクト
 * @param {THREE.Scene} scene - Three.jsのシーンオブジェクト
 */
export function setupRestartButton(gameState, scene) {
    document.getElementById('restartButton').addEventListener('click', function() {
        // ボタンクリック音を再生
        import('./sound.js').then(module => {
            module.playButtonClickSound(gameState);
        });
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
    
    // モバイルジョイスティックとアクションボタンを非表示
    const mobileJoystick = document.getElementById('mobileJoystick');
    if (mobileJoystick) {
        mobileJoystick.style.display = 'none';
    }
    
    const mobileActionButtons = document.getElementById('mobileActionButtons');
    if (mobileActionButtons) {
        mobileActionButtons.style.display = 'none';
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
        // ボタンクリック音を再生
        import('./sound.js').then(module => {
            module.playButtonClickSound(gameState);
        });
        
        // 勝利画面を非表示
        document.getElementById('winScreen').style.display = 'none';
        
        // restartGame関数で全ての再表示処理を行う
        restartGame(gameState, scene);
    });
} 