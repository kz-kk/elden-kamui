/**
 * カメラ関連の機能を管理するモジュール
 */
import * as THREE from 'three';

/**
 * カメラモードを切り替える関数
 * @param {Object} gameState - ゲームの状態オブジェクト
 * @param {THREE.OrbitControls} controls - OrbitControlsオブジェクト
 * @param {THREE.Camera} camera - カメラオブジェクト
 * @param {HTMLElement} cameraInfo - カメラ情報表示用のHTML要素
 */
export function toggleCameraMode(gameState, controls, camera, cameraInfo) {
    // カメラモードを循環させる: プレイヤー軌道 -> プレイヤー追随（ドラッグ可能） -> 自由カメラ -> プレイヤー軌道...
    if (gameState.orbitPlayerCamera) {
        // プレイヤー軌道カメラからプレイヤー追随カメラ（ドラッグ可能）へ
        gameState.orbitPlayerCamera = false;
        gameState.followPlayerCamera = true;
        gameState.freeCamera = false;
        controls.enabled = true; // OrbitControlsを有効化（ドラッグ操作用）
        cameraInfo.innerHTML = 'カメラモード: プレイヤー追随（ドラッグ可能）(Cキーで切替)';
        // ターゲットをプレイヤーに設定
        controls.target.copy(gameState.playerPosition);
        // カメラ位置を追随位置に初期化
        updateFollowCameraPosition(gameState, camera);
        // 即座にカメラを正しい位置に配置するため、lerp効果をスキップ
        const targetPosition = new THREE.Vector3(
            gameState.playerPosition.x - Math.sin(gameState.playerRotation) * gameState.cameraOffset.z,
            gameState.playerPosition.y + gameState.cameraOffset.y,
            gameState.playerPosition.z - Math.cos(gameState.playerRotation) * gameState.cameraOffset.z
        );
        camera.position.copy(targetPosition);
    } else if (gameState.followPlayerCamera) {
        // プレイヤー追随カメラから自由カメラへ
        gameState.followPlayerCamera = false;
        gameState.freeCamera = true;
        gameState.orbitPlayerCamera = false;
        controls.enabled = true;
        cameraInfo.innerHTML = 'カメラモード: 自由カメラ (Cキーで切替)';
        // 現在のカメラ位置を維持
        controls.target.copy(gameState.playerPosition);
    } else {
        // 自由カメラからプレイヤー軌道カメラへ
        gameState.freeCamera = false;
        gameState.followPlayerCamera = false;
        gameState.orbitPlayerCamera = true;
        controls.enabled = true;
        cameraInfo.innerHTML = 'カメラモード: プレイヤー軌道 (Cキーで切替)';
        controls.target.copy(gameState.playerPosition);
    }
}

/**
 * プレイヤー追随カメラの位置更新（ドラッグ可能モード用）
 * @param {Object} gameState - ゲームの状態オブジェクト
 * @param {THREE.Camera} camera - カメラオブジェクト
 */
export function updateFollowCameraPosition(gameState, camera) {
    // プレイヤーの後ろに配置する目標位置を計算
    const cameraDistance = 5.0; // カメラの距離を大幅に増加
    const cameraHeight = 5.0;   // カメラの高さも増加
    
    const targetPosition = new THREE.Vector3(
        gameState.playerPosition.x - Math.sin(gameState.playerRotation) * cameraDistance,
        gameState.playerPosition.y + cameraHeight,
        gameState.playerPosition.z - Math.cos(gameState.playerRotation) * cameraDistance
    );
    
    // カメラ位置を目標位置に設定（より素早い追従のために補間値を調整）
    camera.position.lerp(targetPosition, 0.2);
    
    // カメラの注視点をプレイヤーの前方に設定して、より広い視野を確保
    const lookAtPoint = new THREE.Vector3(
        gameState.playerPosition.x + Math.sin(gameState.playerRotation) * 10.0, // 前方注視距離を増加
        gameState.playerPosition.y,
        gameState.playerPosition.z + Math.cos(gameState.playerRotation) * 10.0
    );
    
    camera.lookAt(lookAtPoint);
}

/**
 * 従来のプレイヤー追随カメラ（レガシー用に残しておく）
 * @param {Object} gameState - ゲームの状態オブジェクト
 * @param {THREE.Camera} camera - カメラオブジェクト
 */
export function updateFollowCamera(gameState, camera) {
    // カメラの位置を更新（プレイヤーの後ろに配置）
    const cameraTargetPosition = new THREE.Vector3(
        gameState.playerPosition.x - Math.sin(gameState.playerRotation) * gameState.cameraOffset.z,
        // プレイヤーの実際の位置に基づいてカメラの高さを調整
        gameState.playerPosition.y + gameState.cameraOffset.y,
        gameState.playerPosition.z - Math.cos(gameState.playerRotation) * gameState.cameraOffset.z
    );
    
    camera.position.copy(cameraTargetPosition);
    
    // カメラの注視点をプレイヤーの実際の位置に設定
    const lookAtPoint = new THREE.Vector3(
        gameState.playerPosition.x,
        // プレイヤーの実際の位置に基づいて注視点の高さを調整
        gameState.playerPosition.y + 1.0,
        gameState.playerPosition.z
    );
    camera.lookAt(lookAtPoint);
}

/**
 * カメラの更新を共通化する関数
 * @param {Object} gameState - ゲームの状態オブジェクト
 * @param {THREE.OrbitControls} controls - OrbitControlsオブジェクト
 * @param {THREE.Camera} camera - カメラオブジェクト
 */
export function updateCamera(gameState, controls, camera) {
    // カメラモードに応じた更新
    if (gameState.followPlayerCamera) {
        // プレイヤー追随カメラモード（ドラッグ可能）
        // ターゲットはプレイヤーに常に追従
        controls.target.copy(gameState.playerPosition);
        
        // カメラ位置を更新
        updateFollowCameraPosition(gameState, camera);
    } else if (gameState.freeCamera || gameState.orbitPlayerCamera) {
        // 自由カメラモードとプレイヤー軌道カメラモードでは、
        // プレイヤーが移動したらOrbitControlsのターゲットを更新
        controls.target.copy(gameState.playerPosition);
    }
} 