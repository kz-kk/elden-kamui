/**
 * サウンド関連の機能を管理するモジュール
 */

/**
 * 足音を再生する関数
 * @param {Object} gameState - ゲームの状態オブジェクト
 */
export function playFootstepSound(gameState) {
    if (gameState.sounds.footstep && gameState.sounds.footstep.buffer) {
        // 既に再生中なら停止して最初から再生
        if (gameState.sounds.footstep.isPlaying) {
            gameState.sounds.footstep.stop();
        }
        // ミュート状態の場合は音量を0に、そうでなければランダムに変化させる
        const volume = gameState.isMuted ? 0 : (0.4 + Math.random() * 0.2);
        gameState.sounds.footstep.setVolume(volume);
        // 再生速度も少しランダムに（ピッチ変化）
        gameState.sounds.footstep.setPlaybackRate(0.9 + Math.random() * 0.2);
        // 再生
        gameState.sounds.footstep.play();
    }
}

/**
 * ボタンクリック音を再生する関数
 * @param {Object} gameState - ゲームの状態オブジェクト
 */
export function playButtonClickSound(gameState) {
    // console.log('playButtonClickSound関数が呼び出されました');
    // console.log('gameState.sounds:', gameState.sounds);
    
    if (gameState.sounds.buttonClick && gameState.sounds.buttonClick.buffer) {
        // console.log('btn.mp3の再生を開始します');
        // 既に再生中なら停止して最初から再生
        if (gameState.sounds.buttonClick.isPlaying) {
            gameState.sounds.buttonClick.stop();
        }
        // ミュート状態の場合は音量を0に、そうでなければ固定音量
        const volume = gameState.isMuted ? 0 : 0.3;
        gameState.sounds.buttonClick.setVolume(volume);
        // console.log('btn.mp3の音量設定:', volume);
        // 再生
        gameState.sounds.buttonClick.play();
        // console.log('btn.mp3の再生コマンドを実行しました');
    } else {
        console.error('btn.mp3が読み込まれていないか、バッファが設定されていません:', {
            hasButtonClick: !!(gameState.sounds && gameState.sounds.buttonClick),
            hasBuffer: !!(gameState.sounds && gameState.sounds.buttonClick && gameState.sounds.buttonClick.buffer)
        });
    }
}

/**
 * 雷の爆発音を再生する関数
 * @param {Object} gameState - ゲームの状態オブジェクト
 * @param {THREE.Audio} audioLoader - THREE.jsのオーディオローダー
 */
export function playLightningExplosionSound(gameState, audioLoader) {
    if (!gameState.isMuted && audioLoader) {
        // 爆発音用のオーディオを作成
        const explosionSound = new THREE.Audio(audioLoader.listener);
        
        // 爆発音のバッファがない場合は作成
        if (!gameState.sounds.lightningExplosion) {
            // 低周波ノイズで爆発音を生成
            const audioContext = audioLoader.context;
            const duration = 1.5;
            const sampleRate = audioContext.sampleRate;
            const bufferSize = sampleRate * duration;
            
            const buffer = audioContext.createBuffer(1, bufferSize, sampleRate);
            const data = buffer.getChannelData(0);
            
            // 爆発音の生成
            for (let i = 0; i < bufferSize; i++) {
                const t = i / sampleRate;
                
                // 初期の爆発（低周波）
                const explosion = Math.random() * Math.exp(-t * 5) * 0.8;
                
                // 雷鳴のような低周波振動
                const thunder = Math.sin(t * 40) * Math.exp(-t * 2) * 0.5;
                
                // ランブル効果
                const rumble = (Math.random() - 0.5) * Math.exp(-t * 3) * 0.3;
                
                data[i] = explosion + thunder + rumble;
                
                // クリッピング防止
                data[i] = Math.max(-1, Math.min(1, data[i]));
            }
            
            gameState.sounds.lightningExplosion = buffer;
        }
        
        explosionSound.setBuffer(gameState.sounds.lightningExplosion);
        explosionSound.setVolume(0.6);
        explosionSound.play();
        
        // 再生終了後に自動的にクリーンアップ
        explosionSound.onEnded = () => {
            explosionSound.disconnect();
        };
    }
}

/**
 * 雷音を再生する関数
 * @param {Object} gameState - ゲームの状態オブジェクト
 * @param {THREE.AudioLoader} audioLoader - THREE.jsのオーディオローダー
 */
export function playThunderSound(gameState, audioLoader) {
    console.log('playThunderSound呼び出し:', {
        isMuted: gameState.isMuted,
        hasAudioLoader: !!audioLoader,
        hasThunder: !!(gameState.sounds && gameState.sounds.thunder),
        hasThunderBuffer: !!(gameState.sounds && gameState.sounds.thunder && gameState.sounds.thunder.buffer)
    });

    if (!gameState.isMuted && audioLoader) {
        // thunder_sequence.mp3を使用
        if (gameState.sounds.thunder && gameState.sounds.thunder.buffer) {
            console.log('雷音（thunder_sequence.mp3）を再生開始');
            // 既に再生中なら停止して最初から再生
            if (gameState.sounds.thunder.isPlaying) {
                gameState.sounds.thunder.stop();
            }
            gameState.sounds.thunder.setVolume(0.4); // 音量を調整
            gameState.sounds.thunder.play();
            console.log('雷音再生実行完了');
        } else if (gameState.sounds.fire && gameState.sounds.fire.buffer) {
            console.log('代替音として炎音を再生');
            if (gameState.sounds.fire.isPlaying) {
                gameState.sounds.fire.stop();
            }
            gameState.sounds.fire.setVolume(0.7);
            gameState.sounds.fire.play();
        } else {
            console.error('利用可能な音声がありません:', gameState.sounds);
        }
    } else {
        console.warn('雷音再生条件が満たされていません:', {
            isMuted: gameState.isMuted,
            hasAudioLoader: !!audioLoader
        });
    }
} 