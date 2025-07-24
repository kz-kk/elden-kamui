/**
 * カメラ関連の機能を管理するモジュール
 */
import * as THREE from 'three';

/**
 * カメラモードを切り替える関数（シンプル化：2つの視点のみ）
 * @param {Object} gameState - ゲームの状態オブジェクト
 * @param {THREE.OrbitControls} controls - OrbitControlsオブジェクト
 * @param {THREE.Camera} camera - カメラオブジェクト
 * @param {HTMLElement} cameraInfo - カメラ情報表示用のHTML要素
 */
export function toggleCameraMode(gameState, controls, camera, cameraInfo) {
    // シネマティックモード中はCキーでの切り替えを無効化
    if (gameState.cinematicCamera) {
        return;
    }
    
    // 2つのモードを切り替え: キャラクター追随 ⇔ 自由視点（遠景）
    if (gameState.followPlayerCamera) {
        // キャラクター追随から自由視点（遠景）へ
        gameState.followPlayerCamera = false;
        gameState.freeCamera = true;
        controls.enabled = true;
        
        // 遠景用の位置に移動（さらに距離を短縮）
        camera.position.set(
            gameState.playerPosition.x + 5,
            gameState.playerPosition.y + 4,
            gameState.playerPosition.z + 5
        );
        controls.target.copy(gameState.playerPosition);
        
        if (cameraInfo) {
            cameraInfo.innerHTML = 'カメラモード: 自由視点（遠景） (Cキーで切替)';
        }
        console.log('カメラモード: 自由視点（遠景）');
    } else {
        // 自由視点からキャラクター追随へ
        gameState.freeCamera = false;
        gameState.followPlayerCamera = true;
        controls.enabled = true;
        
        // キャラクター追随位置に移動（より近い距離）
        const targetPosition = new THREE.Vector3(
            gameState.playerPosition.x - Math.sin(gameState.playerRotation) * 4,
            gameState.playerPosition.y + 2.5,  // 少し低く
            gameState.playerPosition.z - Math.cos(gameState.playerRotation) * 4
        );
        camera.position.copy(targetPosition);
        controls.target.copy(gameState.playerPosition);
        
        if (cameraInfo) {
            cameraInfo.innerHTML = 'カメラモード: キャラクター追随 (Cキーで切替)';
        }
        console.log('カメラモード: キャラクター追随');
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
 * カメラの更新を共通化する関数（シンプル化）
 * @param {Object} gameState - ゲームの状態オブジェクト
 * @param {THREE.OrbitControls} controls - OrbitControlsオブジェクト
 * @param {THREE.Camera} camera - カメラオブジェクト
 */
export function updateCamera(gameState, controls, camera) {
    // カメラモードに応じた更新
    if (gameState.cinematicCamera) {
        // シネマティックカメラモード
        gameState.cinematicRotation += gameState.cinematicSpeed;
        
        const x = gameState.playerPosition.x + Math.cos(gameState.cinematicRotation) * gameState.cinematicDistance;
        const y = gameState.playerPosition.y + gameState.cinematicHeight;
        const z = gameState.playerPosition.z + Math.sin(gameState.cinematicRotation) * gameState.cinematicDistance;
        
        camera.position.set(x, y, z);
        camera.lookAt(gameState.playerPosition.x, gameState.playerPosition.y + 1, gameState.playerPosition.z);
        
        controls.target.copy(gameState.playerPosition);
        controls.enabled = false;
    } else if (gameState.followPlayerCamera) {
        // キャラクター追随モード
        controls.enabled = true;
        controls.target.lerp(gameState.playerPosition, 0.1);
        
        // キャラクターの後ろに追随（より近い距離）
        const targetPosition = new THREE.Vector3(
            gameState.playerPosition.x - Math.sin(gameState.playerRotation) * 4,
            gameState.playerPosition.y + 2.5,  // 少し低く
            gameState.playerPosition.z - Math.cos(gameState.playerRotation) * 4
        );
        camera.position.lerp(targetPosition, 0.1);
        
        // カメラの注視点をキャラクターの少し上に設定（自然な視線）
        const lookAtTarget = new THREE.Vector3(
            gameState.playerPosition.x,
            gameState.playerPosition.y + 1.5,  // キャラクターの頭部あたりを注視
            gameState.playerPosition.z
        );
        camera.lookAt(lookAtTarget);
    } else if (gameState.freeCamera) {
        // 自由視点（遠景）モード
        controls.enabled = true;
        // プレイヤーを注視点として緩やかに追従
        controls.target.lerp(gameState.playerPosition, 0.02);
    }
} 