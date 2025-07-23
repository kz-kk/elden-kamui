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
        // 音量をランダムに少し変化させる（自然な感じに）
        gameState.sounds.footstep.setVolume(0.4 + Math.random() * 0.2);
        // 再生速度も少しランダムに（ピッチ変化）
        gameState.sounds.footstep.setPlaybackRate(0.9 + Math.random() * 0.2);
        // 再生
        gameState.sounds.footstep.play();
    }
} 