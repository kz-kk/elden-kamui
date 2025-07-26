// Three.jsのインポート
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AudioListener, Audio, AudioLoader } from 'three';
import { PMREMGenerator, CubeTextureLoader } from 'three';

// 環境関連のインポート
import { addGrass, addRocks, updateGrassWind, createDefaultEnvMap } from './js/environment.js';

// アニメーション関連のインポート
import { analyzeAnimation } from './js/animation.js';

// UI関連のインポート
import { updateHealthBar, updateDragonHealthBar, gameOver, restartGame, setupRestartButton, showWinScreen, setupWinButton } from './js/ui.js';
import { updateInvincibility, applyDamage, applyDragonDamage } from './js/player.js';
import { checkCollisions } from './js/collision.js';

// カメラ関連のインポート
import { toggleCameraMode, updateFollowCameraPosition, updateFollowCamera, updateCamera } from './js/camera.js';

// サウンド関連のインポート
import { playFootstepSound } from './js/sound.js';

// ドラゴン関連のインポート
import { updateDragon } from './js/dragon.js';

// 霧エフェクトモジュールをインポート
import { createFogEffect } from './js/effects/fogEffect.js';
import { 
    createYellowParticleEffect, 
    createParticleColumn, 
    createGroundFireEffect,
    createDustEffect,
    createDragonFlameEffect,
    createBeamEffect
} from './js/effects/particles/index.js';

// エフェクト管理モジュールをインポート
import { updateAllEffects } from './js/effects/effectsManager.js';

// ゲームの状態管理
const gameState = {
    playerSpeed: 0.1,
    playerRotationSpeed: 0.05,
    playerModel: null,
    dragonModel: null,
    isLoading: true,
    gameStarted: false,
    videoPlaying: false,
    loadingProgress: 0,
    totalAssets: 0,
    loadedAssets: 0,
    keysPressed: {},
    playerPosition: new THREE.Vector3(0, -5.0, 0), // プレイヤーの位置を地面に合わせて調整（地面は-5.0）
    playerRotation: 0,
    dragonPosition: new THREE.Vector3(0, -5.0, 20), // ドラゴンの初期位置を設定
    cameraOffset: new THREE.Vector3(0, 2, 5), // カメラの相対位置
    // モデルの向き調整用オフセット（GLTFモデルの初期向きによる）
    playerModelRotationOffset: -Math.PI / 2, // 90度（左向きから前向きに調整）
    // カメラモード（シンプル化：2つのモードのみ）
    freeCamera: false, // 自由視点（遠景）モード
    followPlayerCamera: true, // キャラクター追随モード
    cinematicCamera: false, // シネマティックカメラモード
    cinematicRotation: 0, // シネマティックカメラの回転角度
    cinematicDistance: 15, // シネマティックカメラの距離（近づけた）
    cinematicHeight: 2.5, // シネマティックカメラの高さをより低くして水平に
    cinematicSpeed: 0.003, // シネマティックカメラの回転速度をさらに高速化
    gameStartTime: null, // ゲーム開始時刻を記録
    
    // アニメーション関連
    animations: {}, // アニメーションを保存するオブジェクト
    isAttacking: false, // 攻撃中かどうか
    attackDuration: 1000, // 攻撃アニメーションの持続時間（ミリ秒）
    
    // 草のアニメーション関連
    grassSprites: [], // 草のスプライトを保存する配列
    windStrength: 0.3, // 風の強さ
    windFrequency: 0.5, // 風の周期
    useShaderGrass: true, // シェーダーベースの草を使用するかどうか
    grassShaderMaterial: null, // 草のシェーダーマテリアル
    
    // プレイヤーの体力関連
    playerHealth: 100, // 最大体力
    currentHealth: 100, // 現在の体力（最大値で開始）
    isInvincible: false, // 無敵状態かどうか
    invincibleTime: 60, // 無敵時間（フレーム単位）
    invincibleTimer: 0, // 無敵タイマー
    damageFlashTimer: 0, // ダメージ時の点滅タイマー
    isGameOver: false, // ゲームオーバーフラグ
    // ドラゴンの体力関連
    dragonHealth: 500, // ドラゴンの最大体力
    currentDragonHealth: 500, // ドラゴンの現在の体力
    isDragonInvincible: false, // ドラゴンの無敵状態
    dragonInvincibleTime: 5, // ドラゴンの無敵時間（フレーム単位）を短縮
    dragonInvincibleTimer: 0, // ドラゴンの無敵タイマー
    dragonDamageFlashTimer: 0, // ドラゴンのダメージ時の点滅タイマー
    isDragonDefeated: false, // ドラゴン撃破フラグ
    // ジャンプ関連のパラメータ
    isJumping: false, // ジャンプ中かどうか
    jumpHeight: 3.5, // ジャンプの高さ
    jumpSpeed: 0.2, // ジャンプの初速度
    gravity: 0.012, // 重力加速度を強く
    verticalVelocity: 0, // 垂直方向の速度
    groundLevel: -5.0, // 地面のY座標
    // ローリング関連のパラメータ
    isRolling: false, // ローリング（回転）中かどうか
    rollingCooldown: 0, // ローリングのクールダウン時間
    rollingStartPosition: null, // ローリング開始時の位置
    rollingDistance: 5.0, // ローリングで進む距離（さらに増加）
    rollingBackOffset: 0.0, // ローリングアニメーションが後退する距離のオフセット
    // 炎エフェクト関連のパラメータ
    flameEffects: [], // 炎エフェクトを管理する配列
    flameCooldown: 0, // 炎エフェクト発動のクールダウン時間
    flameMaxCooldown: 20, // 炎エフェクト発動の最大クールダウン時間（フレーム単位）
    flameDistance: 25.0, // 炎エフェクトの射程距離
    flameLifetime: 60, // 炎エフェクトの寿命（フレーム単位）
    flameSize: 0.1, // 粒子の大きさ
    flameParticleCount: 700, // 粒子の数（密度を上げる）
    flameSpeed: 0.18, // 炎の前進速度
    flameWidth: 1.5, // 炎の幅
    flameSpread: 0.4, // 炎の広がり（値が大きいほど広がる）
    flameRiseSpeed: 0.06, // 炎の上昇速度
    flameWaver: 0.03, // 炎のゆらめき度合い
    // 青白いビーム関連のパラメータ
    beamEffects: [], // ビームエフェクトを管理する配列
    beamCooldown: 0, // ビームエフェクト発動のクールダウン時間
    beamMaxCooldown: 30, // ビームエフェクト発動の最大クールダウン時間（フレーム単位）
    beamDistance: 20.0, // ビームエフェクトの射程距離
    beamLifetime: 40, // ビームエフェクトの寿命（フレーム単位）
    beamSize: 0.1, // 粒子の大きさ
    beamParticleCount: 1000, // 粒子の数（密度を上げる）
    beamSpeed: 0.3, // ビームの前進速度
    beamWidth: 6.8, // ビームの幅
    beamSpread: 1.5, // ビームの広がり（値が小さいほど集中する）
    // ドラゴンの炎関連のパラメータ
    dragonFlameEffects: [], // ドラゴンの炎エフェクトを管理する配列
    dragonFlameCooldown: 0, // ドラゴンの炎発動のクールダウン時間
    dragonFlameMaxCooldown: 120, // ドラゴンの炎発動の最大クールダウン時間（フレーム単位）
    dragonFlameChance: 0.01, // 各フレームでドラゴンが炎を吹く確率
    dragonFlameDistance: 35.0, // ドラゴンの炎の射程距離を増加
    dragonFlameLifetime: 80, // ドラゴンの炎の寿命を短縮
    dragonFlameSize: 0.05, // ドラゴンの炎の粒子の大きさをさらに減少
    dragonFlameParticleCount: 1000, // パーティクル数をさらに減らす
    dragonFlameWidth: 2.5, // ドラゴンの炎の幅をさらに減少
    dragonFlameSpread: 0.15, // ドラゴンの炎の広がりをさらに減少
    dragonFlameSpeed: 0.45, // ドラゴンの炎の前進速度を少し上げる
    
    // ドラゴンボイス関連のパラメータ
    dragonVoiceCooldown: 0, // ドラゴンボイスのクールダウン時間
    dragonVoiceMaxCooldown: 300, // ドラゴンボイスの最大クールダウン時間（フレーム単位：約5秒）
    dragonVoiceChance: 0.005, // 各フレームでドラゴンがボイスを発する確率
    
    // 足元の煙エフェクト関連のパラメータ
    dustEffects: [], // 煙エフェクトを管理する配列
    dustLifetime: 25, // 煙エフェクトの寿命（フレーム単位）
    dustSize: 0.15, // 煙の粒子の大きさ（小さくする）
    dustParticleCount: 15, // 1回の煙エフェクトの粒子数
    dustSpawnInterval: 5, // 煙エフェクト生成の間隔（フレーム単位）
    dustSpawnTimer: 0, // 煙エフェクト生成のタイマー
    // 効果音関連
    sounds: {}, // 効果音を保存するオブジェクト
    isMoving: false,
    footstepTimer: 0,
    // デフォルト音量設定
    defaultVolumes: {
        bgm: 0.5,
        wind: 0.6,
        attack: 0.7,
        footstep: 0.5,
        fire: 0.4,
        patipati: 0.9,
        heal: 1.0,
        dragonVoice: 0.8,
        rolling: 0.8
    },
    // ... 他のパラメータは維持 ...
    
    // 霧エフェクト用のパラメータ
    fogEffects: [],
    fogSpawnTimer: 0,
    fogParticleCount: 25,  // 粒子数を増やす
    fogSize: 3.0,          // サイズを大きくする
    fogLifetime: 350,      // 寿命を調整
    fogSpawnInterval: 300, // 生成間隔を調整
    
    // 粒子の柱エフェクト用のパラメータ
    particleColumnEffects: [],
    columnSpawnTimer: 0,
    columnParticleCount: 240, // 粒子数を増やす
    columnSize: 0.3, // サイズを大きくして見やすく
    columnLifetime: 150,
    columnSpawnInterval: 200, // 生成間隔を短くして頻繁に出現
    
    // 黄色い粒子エフェクト用のパラメータ
    yellowParticleEffects: [],
    yellowParticleSpawnTimer: 0,
    yellowParticleCount: 880, // 粒子数をさらに増やす
    yellowParticleSize: 0.05, // サイズを調整
    yellowParticleLifetime: 180, // 寿命を調整
    yellowParticleSpawnInterval: 150, // 生成間隔を短くする
    yellowParticleColumns: 4, // 魔法陣の数に合わせて4本に減らす
    yellowParticleHeight: 5.0, // 柱の高さを調整
    yellowParticleMinCount: 20, // 画面上に常に存在する最小の柱の数を増やす
    yellowParticlePermanentColumn: true, // ドラゴン付近に常に存在する柱を設定
    yellowParticlePermanentAll: true, // すべての柱を永続的にする
    
    // 回復エリア管理
    healingAreaSpawnTimer: 0,
    healingAreaSpawnInterval: 300, // 5秒間隔で新しい回復エリアを生成
    healingAreaLifetime: 600, // 回復エリアの寿命（10秒）
    maxHealingAreas: 2, // 同時に存在する最大回復エリア数
    
    // パフォーマンス管理
    sceneCleanupTimer: 0,
    sceneCleanupInterval: 300, // 5秒間隔でシーンクリーンアップ
    
    // 回復エフェクト関連
    isHealing: false, // 回復中フラグ
    healingParticles: null, // 回復パーティクルエフェクト
    
    // 岩の衝突判定関連
    rocks: [], // 岩のオブジェクトを保存する配列
    rockCollisionRadius: 1.5, // 岩の衝突判定の基本半径を1.5に調整
    
    // 地面の炎エフェクト関連のパラメータ
    groundFireEffects: [], // 地面の炎エフェクトを管理する配列
    groundFireLifetime: 180, // 地面の炎の寿命（フレーム単位）
    groundFireSize: 0.05, // 地面の炎の粒子の大きさ
    groundFireParticleCount: 120, // 地面の炎の粒子の数
    groundFireSpreadRadius: 1.5, // 地面の炎の広がり半径
    groundFireHeight: 3.2, // 地面の炎の高さ
    groundFireDamage: 20, // 地面の炎のダメージ量を大幅に増加
    shouldCreateDragonFlame: false, // ドラゴンの炎エフェクト生成フラグ
    isOnRock: false, // 岩の上にいるかどうか
    
    // 体力回復関連のパラメータ
    healingTimer: 30, // 体力回復のタイマー（初期値を間隔と同じに設定）
    healingInterval: 30, // 体力回復の間隔（フレーム単位）
    healingAmount: 3, // 1回の回復量を増加
    
    // グローバルミュート状態
    isMuted: false, // ゲーム全体のミュート状態
};

// シーン、カメラ、レンダラーの設定
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x4a4a4a); // 背景色をさらに明るく
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // ソフトシャドウマップを使用

// 最初はcanvasを非表示にする
renderer.domElement.style.display = 'none';
document.body.appendChild(renderer.domElement);

// OrbitControlsの設定（マウスドラッグでカメラ操作用）
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // 滑らかなカメラ移動
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 1;
controls.maxDistance = 15;
controls.maxPolarAngle = Math.PI / 2; // 地面より下にカメラが行かないように制限
// 常にコントロールを有効にし、プレイヤー中心の軌道カメラモードを初期設定にする
controls.enabled = true;
gameState.freeCamera = false;
gameState.followPlayerCamera = true; // 初期はキャラクター追随モード

// ミュートボタンのイベントリスナー
const muteButton = document.getElementById('muteButton');
muteButton.addEventListener('click', () => {
    gameState.isMuted = !gameState.isMuted;
    
    if (gameState.isMuted) {
        // すべての音声をミュート
        if (bgmSound) bgmSound.setVolume(0);
        if (windSound) windSound.setVolume(0);
        // すべてのサウンドエフェクトもミュート
        Object.values(gameState.sounds).forEach(sound => {
            if (sound && sound.setVolume) {
                sound.setVolume(0);
            }
        });
        // 動画もミュート
        const introVideo = document.getElementById('introVideo');
        if (introVideo) introVideo.muted = true;
        
        muteButton.classList.add('muted');
        muteButton.textContent = '♪';
    } else {
        // 音声を復活（デフォルト音量を使用）
        if (bgmSound) bgmSound.setVolume(gameState.defaultVolumes.bgm);
        if (windSound) windSound.setVolume(gameState.defaultVolumes.wind);
        // 動画のミュートも解除
        const introVideo = document.getElementById('introVideo');
        if (introVideo) introVideo.muted = false;
        
        muteButton.classList.remove('muted');
        muteButton.textContent = '♪';
    }
});

// カメラボタンのイベントリスナー
const cameraButton = document.getElementById('cameraButton');
cameraButton.addEventListener('click', () => {
    // シネマティックモードのオン/オフを切り替え
    gameState.cinematicCamera = !gameState.cinematicCamera;
    
    if (gameState.cinematicCamera) {
        // シネマティックモードをオンにする
        gameState.freeCamera = false;
        gameState.orbitPlayerCamera = false;
        gameState.followPlayerCamera = false;
        cameraButton.classList.add('active');
        
        // カメラの初期位置を設定
        gameState.cinematicRotation = 0;
        
        // console.log("シネマティックカメラモード: ON");
    } else {
        // 通常のカメラモードに戻す
        gameState.orbitPlayerCamera = true;
        cameraButton.classList.remove('active');
        
        // console.log("シネマティックカメラモード: OFF");
    }
});

// UI情報の表示
const cameraInfo = document.createElement('div');
cameraInfo.style.position = 'absolute';
cameraInfo.style.bottom = '10px';
cameraInfo.style.left = '10px';
cameraInfo.style.color = 'white';
cameraInfo.style.background = 'rgba(0,0,0,0.5)';
cameraInfo.style.padding = '5px';
cameraInfo.style.fontFamily = 'Arial';
cameraInfo.style.zIndex = '100';
cameraInfo.innerHTML = 'カメラモード: プレイヤー軌道 (Cキーで切替)';
// document.body.appendChild(cameraInfo);

// 光源の設定
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); // 環境光を少し暗くして影を目立たせる
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // メイン光源を1.0に強化
directionalLight.position.set(5, 15, 7.5); // 高い位置に配置して影を長くする
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 4096; // 影の解像度を向上
directionalLight.shadow.mapSize.height = 4096;

// 影のカメラ範囲を設定してドラゴンも含むようにする
directionalLight.shadow.camera.near = 0.1;
directionalLight.shadow.camera.far = 60;
directionalLight.shadow.camera.left = -40;
directionalLight.shadow.camera.right = 40;
directionalLight.shadow.camera.top = 40;
directionalLight.shadow.camera.bottom = -40;

// 影の品質設定
directionalLight.shadow.bias = -0.0005; // 影のちらつきを防ぐ
directionalLight.shadow.normalBias = 0.02;

scene.add(directionalLight);

// 戦士モデル専用のポイントライト - モデルの質感を引き立てる
const warriorLight = new THREE.PointLight(0xffffff, 1.2, 15); // 強度を1.2に上げる
warriorLight.position.set(0, 2, 0);
warriorLight.castShadow = true;
scene.add(warriorLight);

// 戦士モデル専用のスポットライト - 上から照らす
const warriorSpotLight = new THREE.SpotLight(0xffffff, 1.4, 20, Math.PI / 4, 0.5, 1); // 強度を1.4に上げる
warriorSpotLight.position.set(0, 10, 0);
warriorSpotLight.target.position.set(0, 0, 0);
scene.add(warriorSpotLight);
scene.add(warriorSpotLight.target);

// 全体を照らす補助光
const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5); // 強度を0.5に上げる
scene.add(hemisphereLight);

// 環境マップの設定（金属の反射に使用）
try {
    // console.log("環境マップの読み込みを試みます...");
    // 環境マップのファイルが存在しない可能性があるため、すぐに代替手段を使用
    createDefaultEnvMap(scene, renderer);
} catch (e) {
    // console.error("環境マップの設定中にエラーが発生しました:", e);
    // エラー時も代替手段を使用
    createDefaultEnvMap(scene, renderer);
}

// 地面の作成
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundTexture = new THREE.TextureLoader().load('assets/area/dry_grassland.png');
// const groundTexture = new THREE.TextureLoader().load('assets/area/tsuchi.jpg');
groundTexture.wrapS = THREE.RepeatWrapping;
groundTexture.wrapT = THREE.RepeatWrapping;
groundTexture.repeat.set(10, 10);

// 地面のマテリアルを明るく設定
const groundMaterial = new THREE.MeshStandardMaterial({ 
    map: groundTexture,
    roughness: 0.8, // 粗さを少し下げる（光の反射を増やす）
    metalness: 0.0, // 金属性を少し上げる
    color: 0x111111  // さらに明るい色に変更
});

const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2; // 水平に配置
ground.position.y = -5.0; // 地面をさらに下げる
ground.receiveShadow = true;
scene.add(ground);

// 草を生やす関数（メモリ最適化済み）
addGrass(scene, gameState);

// 岩を配置
addRocks(scene, gameState);

// スカイボックスの作成
const skyGeometry = new THREE.SphereGeometry(500, 60, 40);
const skyTexture = new THREE.TextureLoader().load('assets/area/sunset.png');
const skyMaterial = new THREE.MeshBasicMaterial({
    map: skyTexture,
    side: THREE.BackSide,
    // color: 0x333333  // 暗い色を乗算
});
const sky = new THREE.Mesh(skyGeometry, skyMaterial);
scene.add(sky);

// プレイヤーの仮表示（GLTFモデルが読み込まれるまで）
const playerPlaceholder = new THREE.Group();
const playerBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 1.8, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x8888ff })
);
playerBody.position.y = 0.9;
playerPlaceholder.add(playerBody);

// 頭部
const playerHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0x8888ff })
);
playerHead.position.y = 1.95;
playerPlaceholder.add(playerHead);

// 剣
const sword = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 1, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xcccccc })
);
sword.position.set(0.4, 1.2, 0);
playerPlaceholder.add(sword);

// 戦士のサイズを設定
playerPlaceholder.scale.set(1.5, 1.5, 1.5);
playerPlaceholder.position.copy(gameState.playerPosition);
playerPlaceholder.castShadow = true;
scene.add(playerPlaceholder);
gameState.playerModel = playerPlaceholder;

// ドラゴンの仮表示
const dragonPlaceholder = new THREE.Group();
const dragonBody = new THREE.Mesh(
    new THREE.BoxGeometry(2, 1, 4),
    new THREE.MeshStandardMaterial({ color: 0xff5555 })
);
dragonBody.position.y = 1.5;
dragonPlaceholder.add(dragonBody);

// 頭部
const dragonHead = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1.5),
    new THREE.MeshStandardMaterial({ color: 0xff5555 })
);
dragonHead.position.set(0, 2, 2);
dragonPlaceholder.add(dragonHead);

// 翼
const wingGeometry = new THREE.BoxGeometry(3, 0.1, 2);
const wingMaterial = new THREE.MeshStandardMaterial({ color: 0xff7777 });
const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
leftWing.position.set(-2, 1.5, 0);
dragonPlaceholder.add(leftWing);

const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
rightWing.position.set(2, 1.5, 0);
dragonPlaceholder.add(rightWing);

// ドラゴンのサイズを5倍に
dragonPlaceholder.scale.set(20, 20, 20);
dragonPlaceholder.position.set(
    gameState.playerPosition.x + 20, // プレイヤーから少し離れた位置
    -2.0, // 空中に配置
    gameState.playerPosition.z
); 
dragonPlaceholder.castShadow = true;
scene.add(dragonPlaceholder);
gameState.dragonModel = dragonPlaceholder;

// GLTFローダーの設定
const loader = new GLTFLoader();
let mixer; // アニメーションミキサー
let dragonMixer; // ドラゴンのアニメーションミキサー
const clock = new THREE.Clock();
let playerAnimations = {}; // プレイヤーのアニメーションを保持するオブジェクト
let currentAnimation = null; // 現在再生中のアニメーション
let isRollingAnimationPlaying = false; // ローリングアニメーション再生中かどうか

// プレイヤーモデルの読み込み試行
if (loader) {
    try {
        updateLoadingProgress('Loading player model...');
        loader.load('assets/knight/wait.glb', (gltf) => {
            // console.log("プレイヤー待機モデル読み込み成功:", gltf);
            
            // 仮表示を削除
            scene.remove(playerPlaceholder);
            
            // 実際のモデルを設定
            gameState.playerModel = gltf.scene;
            
            // 戦士のサイズを2倍に
            gameState.playerModel.scale.set(2, 2, 2);
            
            // プレイヤーの位置を地面レベルに設定
            gameState.playerPosition.set(
                gameState.playerPosition.x,
                gameState.groundLevel, // モデルの足元が地面に来るように調整
                gameState.playerPosition.z
            );
            
            // モデルの位置を更新
            gameState.playerModel.position.copy(gameState.playerPosition);
            
            // モデルが正しい方向を向くように調整（GLTFモデルの初期向きを補正）
            gameState.playerModel.rotation.y = gameState.playerRotation + gameState.playerModelRotationOffset;
            
            // マテリアルを調整
            gameState.playerModel.traverse(function(child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    
                    // console.log("戦士モデルのメッシュを処理:", child.name);
                    
                    if (child.material) {
                        // マテリアル情報をデバッグ出力
                        // console.log("元のマテリアル情報:", {
                        //     type: child.material.type,
                        //     color: child.material.color ? child.material.color.getHexString() : 'なし',
                        //     metalness: child.material.metalness,
                        //     roughness: child.material.roughness,
                        //     map: child.material.map ? '存在する' : 'なし'
                        // });
                        
                        // マテリアルを複製して元のマテリアルを保持
                        if (Array.isArray(child.material)) {
                            child.material = child.material.map(mat => {
                                // 新しいPhysicalマテリアルを作成（より高度な物理ベースレンダリング）
                                const newMat = new THREE.MeshPhysicalMaterial();
                                
                                // 元のマテリアルのプロパティをコピー
                                if (mat.map) newMat.map = mat.map;
                                if (mat.normalMap) newMat.normalMap = mat.normalMap;
                                if (mat.color) newMat.color.copy(mat.color);
                                
                                // 銀色の質感を強制的に設定
                                // newMat.color.setRGB(0.8, 0.8, 0.85); // 銀色
                                newMat.metalness = 1.0; // 金属性を最大に
                                newMat.roughness = 0.1; // 表面の粗さを最小に（光沢感を最大に）
                                newMat.envMapIntensity = 2.0; // 環境マップの強度を上げる
                                newMat.reflectivity = 1.0; // 反射率を最大に
                                newMat.clearcoat = 0.5; // クリアコートを追加（光沢感を増す）
                                newMat.clearcoatRoughness = 0.1; // クリアコートの粗さを低く
                                newMat.side = THREE.DoubleSide;
                                newMat.needsUpdate = true; // マテリアルの更新を強制
                                
                                return newMat;
                            });
                        } else {
                            // 新しいPhysicalマテリアルを作成（より高度な物理ベースレンダリング）
                            const newMat = new THREE.MeshPhysicalMaterial();
                            
                            // 元のマテリアルのプロパティをコピー
                            if (child.material.map) newMat.map = child.material.map;
                            if (child.material.normalMap) newMat.normalMap = child.material.normalMap;
                            if (child.material.color) newMat.color.copy(child.material.color);
                            
                            // 銀色の質感を強制的に設定
                            // newMat.color.setRGB(0.9, 0.9, 0.95); // 明るい銀色
                            newMat.metalness = 1.0; // 金属性を最大に
                            newMat.roughness = 0.1; // 表面の粗さを最小に（光沢感を最大に）
                            newMat.envMapIntensity = 2.0; // 環境マップの強度を上げる
                            newMat.reflectivity = 1.0; // 反射率を最大に
                            newMat.clearcoat = 0.5; // クリアコートを追加（光沢感を増す）
                            newMat.clearcoatRoughness = 0.1; // クリアコートの粗さを低く
                            newMat.side = THREE.DoubleSide;
                            newMat.needsUpdate = true; // マテリアルの更新を強制
                            
                            child.material = newMat;
                        }
                        
                        // 更新後のマテリアル情報をデバッグ出力
                        // console.log("更新後のマテリアル情報:", {
                        //     type: child.material.type,
                        //     color: child.material.color ? child.material.color.getHexString() : 'なし',
                        //     metalness: child.material.metalness,
                        //     roughness: child.material.roughness,
                        //     map: child.material.map ? '存在する' : 'なし'
                        // });
                    }
                }
            });
            
            gameState.playerModel.castShadow = true;
            gameState.playerModel.receiveShadow = true;
            scene.add(gameState.playerModel);

            // アニメーションミキサーの設定
            if (gltf.animations && gltf.animations.length > 0) {
                mixer = new THREE.AnimationMixer(gameState.playerModel);
                // 待機アニメーションを保存
                playerAnimations['wait'] = mixer.clipAction(gltf.animations[0]);
                currentAnimation = playerAnimations['wait'];
                currentAnimation.play();
                
                // 走るアニメーションを読み込む
                updateLoadingProgress('Loading run animation...');
                loader.load('assets/knight/run.glb', (runGltf) => {
                    // console.log("プレイヤー走りモデル読み込み成功:", runGltf);
                    // console.log("走りモデルのアニメーション数:", runGltf.animations ? runGltf.animations.length : 0);
                    
                    if (runGltf.animations && runGltf.animations.length > 0) {
                        try {
                            // アニメーションの詳細情報を出力
                            // console.log("走りアニメーション名:", runGltf.animations[0].name);
                            // console.log("走りアニメーショントラック数:", runGltf.animations[0].tracks.length);
                            
                            // モデルのサイズを設定
                            runGltf.scene.scale.set(2, 2, 2);
                            
                            // モデルの位置を調整
                            runGltf.scene.position.set(
                                gameState.playerPosition.x,
                                gameState.groundLevel, // 調整値を変更（高さを下げる）
                                gameState.playerPosition.z
                            );
                            
                            // マテリアルを調整（wait.glbと同様の処理）
                            runGltf.scene.traverse(function(child) {
                                if (child.isMesh) {
                                    child.castShadow = true;
                                    child.receiveShadow = true;
                                    
                                    if (child.material) {
                                        // 新しいPhysicalマテリアルを作成
                                        const newMat = new THREE.MeshPhysicalMaterial();
                                        
                                        // 元のマテリアルのプロパティをコピー
                                        if (child.material.map) newMat.map = child.material.map;
                                        if (child.material.normalMap) newMat.normalMap = child.material.normalMap;
                                        if (child.material.color) newMat.color.copy(child.material.color);
                                        
                                        // 銀色の質感を設定
                                        newMat.metalness = 1.0;
                                        newMat.roughness = 0.1;
                                        newMat.envMapIntensity = 2.0;
                                        newMat.reflectivity = 1.0;
                                        newMat.clearcoat = 0.5;
                                        newMat.clearcoatRoughness = 0.1;
                                        newMat.side = THREE.DoubleSide;
                                        newMat.needsUpdate = true;
                                        
                                        child.material = newMat;
                                    }
                                }
                            });
                            
                            // アニメーションの設定
                            const runAction = mixer.clipAction(runGltf.animations[0], runGltf.scene);
                            runAction.setEffectiveWeight(1.0);
                            runAction.enabled = true;
                            runAction.setLoop(THREE.LoopRepeat);
                            
                            // アニメーションとシーンを保存
                            playerAnimations['run'] = {
                                action: runAction,
                                scene: runGltf.scene
                            };
                            
                            // console.log("走るアニメーションの詳細:", {
                            //     type: typeof runAction,
                            //     hasStop: typeof runAction.stop === 'function', 
                            //     hasReset: typeof runAction.reset === 'function',
                            //     hasPlay: typeof runAction.play === 'function'
                            // });
                            
                            // アニメーションの位置変換を調査
                            analyzeAnimation(runGltf.animations[0]);
                            
                            // console.log("走るアニメーションを設定しました");
                        } catch (error) {
                            // console.error("走りアニメーション設定中にエラーが発生しました:", error);
                        }
                    } else {
                        // console.error("走りアニメーションが見つかりません");
                    }
                }, 
                (xhr) => {
                    // console.log((xhr.loaded / xhr.total * 100) + '% プレイヤー走りモデル読み込み中...');
                },
                (error) => {
                    console.error('プレイヤー走りモデル読み込みエラー:', error);
                });
                
                // 攻撃アニメーションを読み込む
                updateLoadingProgress('Loading attack animation...');
                // loader.load('assets/knight/attach.glb', (attachGltf) => {
                //     // console.log("プレイヤー攻撃モデル読み込み成功:", attachGltf);
                //     if (attachGltf.animations && attachGltf.animations.length > 0) {
                //         // 攻撃アニメーションを保存
                //         const attackAction = mixer.clipAction(attachGltf.animations[0]);
                //         // ループしないように設定
                //         attackAction.loop = THREE.LoopOnce;
                //         attackAction.clampWhenFinished = true;
                        
                //         // アニメーションの重み付けを設定
                //         attackAction.setEffectiveWeight(1.0);
                        
                //         // アニメーションを保存
                //         playerAnimations['attack'] = attackAction;
                //         gameState.animations.attack = attackAction;
                        
                //         // 攻撃アニメーションの位置変換を調査
                //         analyzeAnimation(attachGltf.animations[0]);
                        
                //         // console.log("攻撃アニメーションを正常に設定しました");
                //     } else {
                //         console.error("攻撃アニメーションが見つかりません");
                //     }
                // }, 
                // (xhr) => {
                //     // console.log((xhr.loaded / xhr.total * 100) + '% プレイヤー攻撃モデル読み込み中...');
                // },
                // (error) => {
                //     console.error('プレイヤー攻撃モデル読み込みエラー:', error);
                // });
                
                // ローリングアニメーションを読み込む
                loader.load('assets/knight/rolling.glb', (rollingGltf) => {
                    // console.log("プレイヤーローリングモデル読み込み成功:", rollingGltf);
                    if (rollingGltf.animations && rollingGltf.animations.length > 0) {
                        // ローリング専用のモデルとマテリアルを設定
                        rollingGltf.scene.scale.set(2, 2, 2);
                        rollingGltf.scene.position.copy(gameState.playerPosition);
                        
                        // マテリアルを調整（wait.glbと同様の処理）
                        rollingGltf.scene.traverse(function(child) {
                            if (child.isMesh) {
                                child.castShadow = true;
                                child.receiveShadow = true;
                                
                                if (child.material) {
                                    const newMat = new THREE.MeshPhysicalMaterial();
                                    
                                    if (child.material.map) newMat.map = child.material.map;
                                    if (child.material.normalMap) newMat.normalMap = child.material.normalMap;
                                    if (child.material.color) newMat.color.copy(child.material.color);
                                    
                                    newMat.metalness = 1.0;
                                    newMat.roughness = 0.1;
                                    newMat.envMapIntensity = 2.0;
                                    newMat.reflectivity = 1.0;
                                    newMat.clearcoat = 0.5;
                                    newMat.clearcoatRoughness = 0.1;
                                    newMat.side = THREE.DoubleSide;
                                    newMat.needsUpdate = true;
                                    
                                    child.material = newMat;
                                }
                            }
                        });
                        
                        // ローリング専用のミキサーを作成
                        const rollingMixer = new THREE.AnimationMixer(rollingGltf.scene);
                        const rollingAction = rollingMixer.clipAction(rollingGltf.animations[0]);
                        
                        // ループしないように設定
                        rollingAction.loop = THREE.LoopOnce;
                        rollingAction.clampWhenFinished = true;
                        
                        // アニメーションの重み付けを設定
                        rollingAction.setEffectiveWeight(1.0);
                        
                        // アニメーション終了時のイベントを設定
                        rollingMixer.addEventListener('finished', function(e) {
                            if (isRollingAnimationPlaying) {
                                // console.log("ローリングアニメーション終了");
                                
                                // ローリング中に既に位置更新済みなので、ここでは位置設定不要
                                // モデル位置のみ同期
                                if (gameState.playerModel) {
                                    gameState.playerModel.position.copy(gameState.playerPosition);
                                }
                                
                                // ローリングモデルを非表示にする
                                scene.remove(rollingGltf.scene);
                                
                                // カメラ状態の復元は行わない（自然な動作のため）
                                
                                // ローリング状態をリセット
                                isRollingAnimationPlaying = false;
                                gameState.isRolling = false;
                                gameState.rollingStartPosition = null;
                                // カメラ関連変数は遷移処理で管理するのでここではクリアしない
                                
                                // 移動中なら走りアニメーション、そうでなければ待機アニメーションに戻す
                                const isMoving = gameState.keysPressed['ArrowUp']; // || gameState.keysPressed['ArrowDown'];
                                if (isMoving && playerAnimations['run']) {
                                    // 待機モデルを非表示
                                    gameState.playerModel.visible = false;
                                    
                                    // 走りモデルを表示
                                    if (playerAnimations['run'].scene) {
                                        scene.add(playerAnimations['run'].scene);
                                        playerAnimations['run'].scene.position.copy(gameState.playerPosition);
                                        playerAnimations['run'].scene.rotation.y = gameState.playerRotation + gameState.playerModelRotationOffset;
                                    }
                                    
                                    if (typeof currentAnimation.stop === 'function') {
                                        currentAnimation.stop();
                                    }
                                    if (playerAnimations['run'] && playerAnimations['run'].action) {
                                        currentAnimation = playerAnimations['run'].action;
                                    }
                                    if (typeof currentAnimation.reset === 'function') {
                                        currentAnimation.reset();
                                    }
                                    if (typeof currentAnimation.play === 'function') {
                                        currentAnimation.play();
                                    }
                                } else if (playerAnimations['wait']) {
                                    // 走りモデルを削除（もし表示されていれば）
                                    if (playerAnimations['run'] && playerAnimations['run'].scene) {
                                        scene.remove(playerAnimations['run'].scene);
                                    }
                                    
                                    // 待機モデルを表示
                                    gameState.playerModel.visible = true;
                                    
                                    if (typeof currentAnimation.stop === 'function') {
                                        currentAnimation.stop();
                                    }
                                    currentAnimation = playerAnimations['wait'];
                                    if (typeof currentAnimation.reset === 'function') {
                                        currentAnimation.reset();
                                    }
                                    if (typeof currentAnimation.play === 'function') {
                                        currentAnimation.play();
                                    }
                                }
                                
                                // console.log("ローリング最終位置:", gameState.playerPosition);
                            }
                        });
                        
                        playerAnimations['rolling'] = {
                            action: rollingAction,
                            scene: rollingGltf.scene,
                            mixer: rollingMixer
                        };
                        
                        // ローリングアニメーションの位置変換を調査
                        analyzeAnimation(rollingGltf.animations[0]);
                    }
                }, 
                (xhr) => {
                    // console.log((xhr.loaded / xhr.total * 100) + '% プレイヤーローリングモデル読み込み中...');
                },
                (error) => {
                    console.error('プレイヤーローリングモデル読み込みエラー:', error);
                });
            }

            // ジャンプアニメーションを読み込む
            // loader.load('assets/knight/jump.glb', (jumpGltf) => {
            //     // console.log("プレイヤージャンプモデル読み込み成功:", jumpGltf);
            //     if (jumpGltf.animations && jumpGltf.animations.length > 0) {
            //         // ジャンプアニメーションを保存
            //         jumpAction = mixer.clipAction(jumpGltf.animations[0]);
            //         // ループしないように設定
            //         jumpAction.loop = THREE.LoopOnce;
            //         jumpAction.clampWhenFinished = true;
                    
            //         // アニメーションの重み付けを設定
            //         jumpAction.setEffectiveWeight(1.0);
                    
            //         playerAnimations['jump'] = jumpAction;
                    
            //         // ジャンプアニメーションの位置変換を調査
            //         analyzeAnimation(jumpGltf.animations[0]);
            //     }
            // }, 
            // (xhr) => {
            //     // console.log((xhr.loaded / xhr.total * 100) + '% プレイヤージャンプモデル読み込み中...');
            // },
            // (error) => {
            //     console.error('プレイヤージャンプモデル読み込みエラー:', error);
            // });

            // ドラゴンモデルの読み込み試行
            try {
                updateLoadingProgress('Loading dragon model...');
                loader.load('assets/dragon/fly.glb', (gltf) => {
                    // console.log("ドラゴンモデル読み込み成功:", gltf);
                    
                    // 仮表示を削除
                    scene.remove(dragonPlaceholder);
                    
                    // 実際のモデルを設定
                    gameState.dragonModel = gltf.scene;
                    // ドラゴンのサイズを設定
                    gameState.dragonModel.scale.set(20.5, 20.5, 20.5); // 1.5倍に拡大
                    // 初期位置を空中に設定
                    gameState.dragonModel.position.set(
                        gameState.playerPosition.x + 20, // プレイヤーから少し離れた位置
                        -3.0, // 地面より上の空中に配置
                        gameState.playerPosition.z
                    );
                    
                    // ドラゴンのマテリアル設定を調整（影の設定のみ）
                    gameState.dragonModel.traverse(function(child) {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            
                            // console.log("ドラゴンモデルのメッシュを処理:", child.name);
                            
                            if (child.material) {
                                // マテリアルを複製して元のマテリアルを保持
                                if (Array.isArray(child.material)) {
                                    child.material = child.material.map(mat => {
                                        const newMat = mat.clone();
                                        // 光沢をなくし、明るさのみ調整
                                        newMat.roughness = 1.0; // 完全にマットな表面
                                        newMat.metalness = 0.0; // 金属感をなくす
                                        newMat.envMapIntensity = 0.0; // 環境マップの影響をなくす
                                        newMat.color.multiplyScalar(1.3); // 色を50%明るく
                                        newMat.side = THREE.DoubleSide;
                                        return newMat;
                                    });
                                } else {
                                    const newMat = child.material.clone();
                                    // 光沢をなくし、明るさのみ調整
                                    newMat.roughness = 1.0; // 完全にマットな表面
                                    newMat.metalness = 0.0; // 金属感をなくす
                                    newMat.envMapIntensity = 0.0; // 環境マップの影響をなくす
                                    newMat.color.multiplyScalar(1.3); // 色を50%明るく
                                    newMat.side = THREE.DoubleSide;
                                    child.material = newMat;
                                }
                            }
                        }
                    });
                    
                    gameState.dragonModel.castShadow = true;
                    gameState.dragonModel.receiveShadow = true;
                    scene.add(gameState.dragonModel);

                    // ドラゴンの方向をプレイヤーに向ける
                    // lookAtではなく、プレイヤーとドラゴンの位置から角度を計算して設定
                    const direction = new THREE.Vector3(
                        gameState.playerPosition.x - gameState.dragonModel.position.x,
                        0,
                        gameState.playerPosition.z - gameState.dragonModel.position.z
                    ).normalize();
                    
                    // ドラゴンの向きを更新
                    const angle = Math.atan2(direction.x, direction.z);
                    gameState.dragonModel.rotation.y = angle;
                    
                    // 飛行していることを表現するために少し前傾姿勢にする
                    gameState.dragonModel.rotation.x = -0.1;
                    
                    // ドラゴンのアニメーション設定
                    if (gltf.animations && gltf.animations.length > 0) {
                        dragonMixer = new THREE.AnimationMixer(gameState.dragonModel);
                        const dragonAction = dragonMixer.clipAction(gltf.animations[0]);
                        dragonAction.play();
                    }
                }, 
                (xhr) => {
                    // console.log((xhr.loaded / xhr.total * 100) + '% ドラゴンモデル読み込み中...');
                },
                (error) => {
                    console.error('ドラゴンモデル読み込みエラー:', error);
                });
            } catch (e) {
                console.error("ドラゴンモデル読み込み例外:", e);
            }
            
            // ロード完了時の処理
            updateLoadingProgress('Finalizing...');
            gameState.isLoading = false;
            document.getElementById('loading').style.display = 'none';
            
            // ローディング完了処理
            onLoadingComplete();
        }, 
        (xhr) => {
            // console.log((xhr.loaded / xhr.total * 100) + '% プレイヤーモデル読み込み中...');
        },
        (error) => {
            console.error('プレイヤーモデル読み込みエラー:', error);
            // エラー時にも仮表示で続行
            gameState.isLoading = false;
            document.getElementById('loading').style.display = 'none';
            
            // ローディング完了処理
            onLoadingComplete();
        });
    } catch (e) {
        console.error("プレイヤーモデル読み込み例外:", e);
        // 例外時にも仮表示で続行
        gameState.isLoading = false;
        document.getElementById('loading').style.display = 'none';
        
        // ローディング完了処理
        onLoadingComplete();
    }
} else {
    console.warn("GLTFLoaderが利用できません。仮表示のみで続行します。");
    gameState.isLoading = false;
    document.getElementById('loading').style.display = 'none';
    
    // ローディング完了処理
    onLoadingComplete();
}

// 音声の設定
let bgmSound = null;  // BGMを外部スコープで定義
let windSound = null;  // 環境音も外部スコープで定義
let audioInitialized = false;  // 音声が初期化されたかのフラグ

// 音声を初期化する関数
function initializeAudio() {
    if (audioInitialized) return;  // すでに初期化済みの場合はスキップ
    audioInitialized = true;
    
    try {
        const audioListener = new AudioListener();
    if (audioListener) {
        camera.add(audioListener);

        // BGM
        bgmSound = new Audio(audioListener);
        const audioLoader = new AudioLoader();
        
        if (audioLoader) {
            audioLoader.load('assets/sound/music.mp3', (buffer) => {
                bgmSound.setBuffer(buffer);
                bgmSound.setLoop(true);
                bgmSound.setVolume(gameState.isMuted ? 0 : 0.5);
            }, null, (error) => {
                console.error('BGM読み込みエラー:', error);
            });

            // 環境音
            windSound = new Audio(audioListener);
            audioLoader.load('assets/sound/wind.mp3', (buffer) => {
                windSound.setBuffer(buffer);
                windSound.setLoop(true);
                windSound.setVolume(gameState.isMuted ? 0 : 0.6);
            }, null, (error) => {
                console.error('環境音読み込みエラー:', error);
            });

            // 戦士の攻撃音
            const attackSound = new Audio(audioListener);
            audioLoader.load('assets/sound/attach.mp3', (buffer) => {
                attackSound.setBuffer(buffer);
                attackSound.setLoop(false);
                attackSound.setVolume(gameState.isMuted ? 0 : 0.7);
                gameState.sounds.attack = attackSound;
                // console.log('攻撃音読み込み成功');
            }, null, (error) => {
                console.error('攻撃音読み込みエラー:', error);
            });

            // 戦士の足音
            const footstepSound = new Audio(audioListener);
            audioLoader.load('assets/sound/foot.mp3', (buffer) => {
                footstepSound.setBuffer(buffer);
                footstepSound.setLoop(false);
                footstepSound.setVolume(gameState.isMuted ? 0 : 0.5);
                gameState.sounds.footstep = footstepSound;
                // console.log('足音読み込み成功');
            }, null, (error) => {
                console.error('足音読み込みエラー:', error);
            });

            // ドラゴンの炎音
            const fireSound = new Audio(audioListener);
            audioLoader.load('assets/sound/fire.mp3', (buffer) => {
                fireSound.setBuffer(buffer);
                fireSound.setLoop(false);
                fireSound.setVolume(gameState.isMuted ? 0 : 0.4);
                gameState.sounds.fire = fireSound;
                // console.log('炎音読み込み成功');
            }, null, (error) => {
                console.error('炎音読み込みエラー:', error);
            });

            // パチパチ音（炎の効果音）
            const patipatiSound = new Audio(audioListener);
            audioLoader.load('assets/sound/patipati.mp3', (buffer) => {
                patipatiSound.setBuffer(buffer);
                patipatiSound.setLoop(false);
                patipatiSound.setVolume(gameState.isMuted ? 0 : 0.9);
                gameState.sounds.patipati = patipatiSound;
                // console.log('パチパチ音読み込み成功');
            }, null, (error) => {
                console.error('パチパチ音読み込みエラー:', error);
            });

            // 回復音
            const healSound = new Audio(audioListener);
            audioLoader.load('assets/sound/heal.mp3', (buffer) => {
                healSound.setBuffer(buffer);
                healSound.setLoop(false);
                healSound.setVolume(gameState.isMuted ? 0 : 1.0);
                gameState.sounds.heal = healSound;
                // console.log('回復音読み込み成功');
            }, null, (error) => {
                console.error('回復音読み込みエラー:', error);
            });

            // ドラゴンボイス
            const dragonVoiceSound = new Audio(audioListener);
            audioLoader.load('assets/sound/dragon-voice2.mp3', (buffer) => {
                dragonVoiceSound.setBuffer(buffer);
                dragonVoiceSound.setLoop(false);
                dragonVoiceSound.setVolume(gameState.isMuted ? 0 : 0.8);
                gameState.sounds.dragonVoice = dragonVoiceSound;
                console.log('ドラゴンボイス読み込み成功');
            }, null, (error) => {
                console.error('ドラゴンボイス読み込みエラー:', error);
            });

            // キー入力の処理
            window.addEventListener('keydown', (e) => {
                gameState.keysPressed[e.key] = true;
                
                // カメラモードの切り替え（Cキー）
                if (e.key === 'c' || e.key === 'C') {
                    toggleCameraMode(gameState, controls, camera, cameraInfo);
                }
                
                // ビームエフェクト発動（Fキー）
                if ((e.key === 'f' || e.key === 'F') && gameState.beamCooldown <= 0) {
                    // ビームエフェクトを生成
                    createBeamEffect(gameState, scene);
                    
                    // ビームの効果音を再生
                    if (gameState.sounds.attack && gameState.sounds.attack.buffer) {
                        if (gameState.sounds.attack.isPlaying) {
                            gameState.sounds.attack.stop();
                        }
                        gameState.sounds.attack.play();
                    }
                    
                    // クールダウンをリセット
                    gameState.beamCooldown = gameState.beamMaxCooldown;
                    
                    // console.log("ビームを発射！");
                }
                
                // 体力回復テスト用（Hキー）
                if (e.key === 'h' || e.key === 'H') {
                    gameState.currentHealth = Math.max(1, gameState.currentHealth - 10);
                }
                
                // foot.mp3再生（Rキー）
                if (e.key === 'r' || e.key === 'R') {
                    if (gameState.sounds.footstep && gameState.sounds.footstep.buffer) {
                        if (gameState.sounds.footstep.isPlaying) {
                            gameState.sounds.footstep.stop();
                        }
                        gameState.sounds.footstep.setVolume(1.0);
                        gameState.sounds.footstep.play();
                        console.log('foot.mp3再生');
                    }
                }
                
                // 体力回復テスト（Tキー）
                if (e.key === 't' || e.key === 'T') {
                    gameState.currentHealth = Math.min(gameState.currentHealth + 10, gameState.playerHealth);
                }
                
                // デバッグ情報表示（Pキー）
                if (e.key === 'p' || e.key === 'P') {
                    // console.log('プレイヤー位置:', gameState.playerPosition.x.toFixed(2), gameState.playerPosition.y.toFixed(2), gameState.playerPosition.z.toFixed(2));
                    if (gameState.yellowParticleEffects) {
                        // console.log('魔法陣数:', gameState.yellowParticleEffects.length);
                        gameState.yellowParticleEffects.forEach((effect, i) => {
                            if (effect && effect.origin) {
                                // console.log(`魔法陣${i}:`, effect.origin.x.toFixed(2), effect.origin.y.toFixed(2), effect.origin.z.toFixed(2));
                            }
                        });
                    }
                }
                
                // 攻撃処理（Gキー）
                if ((e.key === 'g' || e.key === 'G') && !gameState.isAttacking && !gameState.isRolling) {
                    gameState.isAttacking = true;
                    // console.log("Gキーによる攻撃を実行");
                    
                    // 攻撃アニメーションを再生
                    if (playerAnimations['attack']) {
                        // 既存のアニメーションを停止
                        if (currentAnimation && typeof currentAnimation.stop === 'function') {
                            currentAnimation.stop();
                        }
                        
                        // 攻撃アニメーションを設定
                        currentAnimation = playerAnimations['attack'];
                        currentAnimation.reset();
                        currentAnimation.play();
                        
                        // console.log("攻撃アニメーション開始");
                    }
                    
                    // 攻撃効果音を再生
                    if (gameState.sounds.attack && gameState.sounds.attack.buffer) {
                        if (gameState.sounds.attack.isPlaying) {
                            gameState.sounds.attack.stop();
                        }
                        gameState.sounds.attack.play();
                    }
                    
                    // ドラゴンとの衝突判定を行い、ダメージを与える
                    if (gameState.dragonModel && !gameState.isDragonDefeated) {
                        // プレイヤーとドラゴンの距離を計算
                        const playerPos = new THREE.Vector3(
                            gameState.playerPosition.x,
                            gameState.playerPosition.y,
                            gameState.playerPosition.z
                        );
                        const dragonPos = gameState.dragonModel.position.clone();
                        const distance = playerPos.distanceTo(dragonPos);
                        
                        // 攻撃範囲内にドラゴンがいるかチェック（攻撃範囲を15.0に設定）
                        const attackRange = 15.0;
                        if (distance < attackRange) {
                            // console.log(`剣攻撃がドラゴンに命中！距離: ${distance.toFixed(2)}`);
                            
                            // ドラゴンにダメージを与える
                            if (!gameState.isDragonInvincible) {
                                // 既にインポートされているapplyDragonDamage関数を使用
                                applyDragonDamage(gameState, 1000); // 100ダメージ（テスト用に増加）
                            }
                        }
                    }
                    
                    // 攻撃状態のリセット
                    setTimeout(() => {
                        gameState.isAttacking = false;
                        // console.log("攻撃状態をリセット");
                        
                        // 移動中なら走りアニメーション、そうでなければ待機アニメーションに戻す
                        if (!currentAnimation) return;
                        
                        const isMoving = gameState.keysPressed['ArrowUp']; // || gameState.keysPressed['ArrowDown'];
                        if (isMoving && playerAnimations['run'] && playerAnimations['run'].action) {
                            if (typeof currentAnimation.stop === 'function') {
                                currentAnimation.stop();
                            }
                            currentAnimation = playerAnimations['run'].action;
                            if (typeof currentAnimation.reset === 'function') {
                                currentAnimation.reset();
                            }
                            if (typeof currentAnimation.play === 'function') {
                                currentAnimation.play();
                            }
                        } else if (playerAnimations['wait']) {
                            if (typeof currentAnimation.stop === 'function') {
                                currentAnimation.stop();
                            }
                            currentAnimation = playerAnimations['wait'];
                            if (typeof currentAnimation.reset === 'function') {
                                currentAnimation.reset();
                            }
                            if (typeof currentAnimation.play === 'function') {
                                currentAnimation.play();
                            }
                        }
                    }, gameState.attackDuration);
                }
                
                // ローリングアニメーション（Rキー）
                if ((e.key === 'r' || e.key === 'R') && !isRollingAnimationPlaying && !gameState.isRolling && gameState.rollingCooldown <= 0 && playerAnimations['rolling'] && gameState.playerModel) {
                    // 実行前のプレイヤー位置と回転を保存
                    const originalPosition = gameState.playerPosition.clone();
                    const originalRotation = gameState.playerRotation;
                    
                    // プレイヤーの向きに基づいて進行方向ベクトルを計算
                    const forwardX = Math.sin(gameState.playerRotation);
                    const forwardZ = Math.cos(gameState.playerRotation);
                    
                    // ローリング開始位置を設定（現在の位置から開始）
                    gameState.rollingStartPosition = originalPosition.clone();
                    
                    // console.log("ローリング開始位置:", originalPosition);
                    // console.log("移動方向:", { x: forwardX, z: forwardZ });
                    
                    // 既存のアニメーションを停止
                    if (currentAnimation && typeof currentAnimation.stop === 'function') {
                        currentAnimation.stop();
                    }
                    
                    // 元のモデルを非表示にする
                    gameState.playerModel.visible = false;
                    
                    // 走りモデルが表示されている場合は非表示にする
                    if (playerAnimations['run'] && playerAnimations['run'].scene) {
                        scene.remove(playerAnimations['run'].scene);
                    }
                    
                    // ローリング専用モデルを表示
                    const rollingData = playerAnimations['rolling'];
                    rollingData.scene.position.copy(gameState.playerPosition);
                    rollingData.scene.rotation.y = gameState.playerRotation + gameState.playerModelRotationOffset;
                    scene.add(rollingData.scene);
                    
                    // ローリングアニメーションを設定
                    currentAnimation = rollingData.action;
                    currentAnimation.reset();
                    currentAnimation.timeScale = 1.5; // アニメーション速度を上げる
                    currentAnimation.setEffectiveTimeScale(1.5); // タイムスケールを明示的に設定
                    
                    // アニメーションの前半（屈む部分）をスキップして途中から開始
                    const clipDuration = currentAnimation.getClip().duration;
                    currentAnimation.time = clipDuration * 0.3; // アニメーションの20%地点から開始
                    currentAnimation.play();
                    
                    // ローリング状態を設定
                    isRollingAnimationPlaying = true;
                    gameState.isRolling = true;
                    gameState.rollingCooldown = 15; // クールダウン設定（短縮）
                    
                    // ローリング音を再生（foot.mp3）
                    if (gameState.sounds.footstep && gameState.sounds.footstep.buffer) {
                        // 現在再生中の場合は停止してから再生
                        if (gameState.sounds.footstep.isPlaying) {
                            gameState.sounds.footstep.stop();
                        }
                        // 少し音量を上げてローリング音として再生
                        gameState.sounds.footstep.setVolume(0.8);
                        gameState.sounds.footstep.play();
                        console.log('ローリング音（foot.mp3）再生開始');
                    }
                    
                    // console.log("ローリングアニメーション開始 - 向いている方向に移動");
                }
                
                // 音楽再生は動画完了後に行うため、ここでは再生しない
            });
        }
    }
    } catch (e) {
        console.error("音声初期化エラー:", e);
    }
}


window.addEventListener('keyup', (e) => {
    gameState.keysPressed[e.key] = false;
});

// ウィンドウリサイズ時の処理
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});



// プレイヤーの移動処理
function movePlayer() {
    if (!gameState.playerModel) return;

    // 矢印キーが押されているかチェック
    const arrowKeyPressed = gameState.keysPressed['ArrowUp'] || 
                           // gameState.keysPressed['ArrowDown'] || 
                           gameState.keysPressed['ArrowLeft'] || 
                           gameState.keysPressed['ArrowRight'];
    
    // 移動フラグ
    let isMoving = false;
    let moveDirectionX = 0;
    let moveDirectionZ = 0;
    

    // ローリングアニメーション再生中の特別処理
    if (isRollingAnimationPlaying && gameState.rollingStartPosition && playerAnimations['rolling']) {
        // ローリングの進行度を計算（アニメーションの経過時間に基づく、タイムスケール考慮）
        const clipDuration = currentAnimation ? currentAnimation.getClip().duration : 1;
        const adjustedDuration = clipDuration / 1.5; // タイムスケール1.5を考慮
        const startOffset = clipDuration * 0.2; // 20%地点から開始したことを考慮
        
        // アニメーション開始地点から現在時点までの進行度を計算
        const currentTime = currentAnimation ? currentAnimation.time : startOffset;
        const progressTime = Math.max(0, currentTime - startOffset);
        const effectiveDuration = clipDuration - startOffset;
        const rollingProgress = progressTime / effectiveDuration;
        const clampedProgress = Math.min(Math.max(rollingProgress, 0), 1);
        
        // プレイヤーの向きに基づいて移動方向を計算
        const forwardX = Math.sin(gameState.playerRotation);
        const forwardZ = Math.cos(gameState.playerRotation);
        
        // アニメーション中はアニメーション自体の移動に任せて、位置追跡のみ行う
        const rollingData = playerAnimations['rolling'];
        
        // ローリングモデルの実際の位置を取得
        const modelWorldPosition = new THREE.Vector3();
        rollingData.scene.getWorldPosition(modelWorldPosition);
        
        // プレイヤー位置を徐々に更新（カメラが自然に追従するように）
        const easedProgress = clampedProgress * clampedProgress * (3.0 - 2.0 * clampedProgress);
        
        // ローリング進行に合わせて位置を更新
        const currentX = gameState.rollingStartPosition.x + (forwardX * gameState.rollingDistance * easedProgress);
        const currentZ = gameState.rollingStartPosition.z + (forwardZ * gameState.rollingDistance * easedProgress);
        
        // プレイヤー位置を更新
        gameState.playerPosition.x = currentX;
        gameState.playerPosition.z = currentZ;
        
        // ローリング専用モデルは開始位置に固定（アニメーション自体の移動を活かす）
        rollingData.scene.position.set(
            gameState.rollingStartPosition.x,
            gameState.playerPosition.y,
            gameState.rollingStartPosition.z
        );
        rollingData.scene.rotation.y = gameState.playerRotation + gameState.playerModelRotationOffset;
        
        // ローリング中も通常通り処理を継続（カメラは自然に動作）
    }
    
    // 攻撃アニメーション再生中は移動を制限
    if (gameState.isAttacking) {
        // プレイヤーモデルの位置と向きを更新
        gameState.playerModel.position.copy(gameState.playerPosition);
        gameState.playerModel.rotation.y = gameState.playerRotation + gameState.playerModelRotationOffset;
        
        // カメラの更新
        updateCamera(gameState, controls, camera);
        return;
    }
    
    // 前後移動
    if (gameState.keysPressed['ArrowUp']) {
        // 前方向に移動
        gameState.playerPosition.x += Math.sin(gameState.playerRotation) * gameState.playerSpeed;
        gameState.playerPosition.z += Math.cos(gameState.playerRotation) * gameState.playerSpeed;
        moveDirectionX = Math.sin(gameState.playerRotation);
        moveDirectionZ = Math.cos(gameState.playerRotation);
        isMoving = true;
    }
    // if (gameState.keysPressed['ArrowDown']) {
    //     // 後ろ方向に移動（向きは変えない）
    //     gameState.playerPosition.x -= Math.sin(gameState.playerRotation) * gameState.playerSpeed;
    //     gameState.playerPosition.z -= Math.cos(gameState.playerRotation) * gameState.playerSpeed;
    //     moveDirectionX = -Math.sin(gameState.playerRotation);
    //     moveDirectionZ = -Math.cos(gameState.playerRotation);
    //     isMoving = true;
    // }

    // 左右回転
    if (gameState.keysPressed['ArrowLeft']) {
        gameState.playerRotation += gameState.playerRotationSpeed;
        isMoving = true;
    }
    if (gameState.keysPressed['ArrowRight']) {
        gameState.playerRotation -= gameState.playerRotationSpeed;
        isMoving = true;
    }
    
    // ジャンプ処理
    // if (gameState.keysPressed[' '] && !gameState.isJumping) {
    //     // スペースキーでジャンプ開始（地面または岩の上にいる場合のみ）
    //     gameState.isJumping = true;
    //     gameState.verticalVelocity = gameState.jumpSpeed;
    //     
    //     // 岩の上からジャンプする場合、現在の高さを基準にする
    //     const startHeight = gameState.isOnRock ? gameState.playerPosition.y : gameState.groundLevel;
    //     gameState.playerPosition.y = startHeight;
    //     
    //     // ジャンプアニメーションを再生（もし存在すれば）
    //     if (mixer && jumpAction) {
    //         jumpAction.reset();
    //         jumpAction.play();
    //         // console.log("ジャンプアニメーション再生");
    //     }
    // }
    
    // ジャンプ中の処理
    // if (gameState.isJumping) {
    //     // 重力の影響を適用
    //     gameState.verticalVelocity -= gameState.gravity;
    //     
    //     // 垂直方向の移動
    //     gameState.playerPosition.y += gameState.verticalVelocity;
    //     
    //     // 地面に着地したかチェック
    //     if (gameState.playerPosition.y <= gameState.groundLevel && !gameState.isOnRock) {
    //         gameState.playerPosition.y = gameState.groundLevel;
    //         gameState.isJumping = false;
    //         gameState.verticalVelocity = 0;
    //         
    //         // 着地アニメーションを再生（もし存在すれば）
    //         if (mixer && idleAction) {
    //             idleAction.reset();
    //             idleAction.play();
    //         }
    //     }
    // }
    
    // 足音の再生（矢印キーが押されているときのみ）
    if (arrowKeyPressed && /*!gameState.isJumping &&*/ !isRollingAnimationPlaying && !gameState.isAttacking) {
        // 足音タイマーをチェック
        if (!gameState.footstepTimer || gameState.footstepTimer <= 0) {
            playFootstepSound(gameState);
            // 次の足音までの間隔をリセット
            gameState.footstepTimer = 20;
        } else {
            // タイマーを減少
            gameState.footstepTimer--;
        }
        
        // 煙エフェクトの生成（一定間隔で）
        if (gameState.dustSpawnTimer <= 0) {
            createDustEffect(gameState, scene);
            // 次の煙エフェクト生成までの間隔をリセット
            gameState.dustSpawnTimer = gameState.dustSpawnInterval;
        }
    } else {
        // 矢印キーが押されていない場合は足音を停止
        if (gameState.sounds.footstep && gameState.sounds.footstep.isPlaying) {
            gameState.sounds.footstep.stop();
        }
        // タイマーをリセット
        gameState.footstepTimer = 0;
    }
    
    // 現在の移動状態を保存
    gameState.isMoving = isMoving;
    
    // プレイヤーモデルの位置と向きを更新
    if (playerAnimations['run'] && currentAnimation === playerAnimations['run'].action) {
        // 走りモデルの位置と向きを更新
        const runPosition = gameState.playerPosition.clone();
        runPosition.y = gameState.playerPosition.y; // 実際の高さを使用
        playerAnimations['run'].scene.position.copy(runPosition);
        playerAnimations['run'].scene.rotation.y = gameState.playerRotation + gameState.playerModelRotationOffset;
    } else if (gameState.playerModel) {
        // waitモデルやattachモデルの位置と向きを更新
        gameState.playerModel.position.copy(gameState.playerPosition);
        gameState.playerModel.position.y = gameState.playerPosition.y; // 実際の高さを使用
        gameState.playerModel.rotation.y = gameState.playerRotation + gameState.playerModelRotationOffset;
    }
    
    // アニメーションを移動状態に応じて切り替え
    if (playerAnimations['wait'] && playerAnimations['run'] && !isRollingAnimationPlaying && !gameState.isAttacking) {
        if (isMoving && /*!gameState.isJumping &&*/ 
            (currentAnimation !== playerAnimations['run'].action || 
             (typeof playerAnimations['run'] === 'object' && playerAnimations['run'].action && 
              currentAnimation !== playerAnimations['run'].action))) {
            // 走りアニメーションに切り替え
            // console.log("走りアニメーションに切り替え");
            
            // 既存のアニメーションを停止
            if (currentAnimation && typeof currentAnimation.stop === 'function') {
                currentAnimation.stop();
            }
            
            // 待機モデルを非表示
            gameState.playerModel.visible = false;
            
            // 走りモデルを表示
            if (typeof playerAnimations['run'] === 'object' && playerAnimations['run'].scene) {
                scene.add(playerAnimations['run'].scene);
                
                // 走りモデルの位置と回転を設定
                playerAnimations['run'].scene.position.copy(gameState.playerPosition);
                playerAnimations['run'].scene.position.y = gameState.groundLevel; // Y座標を明示的に設定
                playerAnimations['run'].scene.rotation.y = gameState.playerRotation + gameState.playerModelRotationOffset;
            }
            
            // 走りアニメーションを再生
            if (typeof playerAnimations['run'] === 'object' && playerAnimations['run'].action) {
                currentAnimation = playerAnimations['run'].action;
                if (typeof currentAnimation.reset === 'function') {
                    currentAnimation.reset();
                }
                if (typeof currentAnimation.play === 'function') {
                    currentAnimation.play();
                }
                
                // console.log("走りモデルの位置:", 
                //     playerAnimations['run'].scene ? playerAnimations['run'].scene.position.toArray() : "シーンなし"
                // );
                // console.log("プレイヤーの位置:", gameState.playerPosition.toArray());
            }
            
        } else if (!isMoving && /*!gameState.isJumping &&*/ 
                   (typeof playerAnimations['run'] === 'object' && playerAnimations['run'].action && 
                    currentAnimation === playerAnimations['run'].action)) {
            // 待機アニメーションに切り替え
            // console.log("待機アニメーションに切り替え");
            
            // 走りアニメーションを停止
            if (currentAnimation && typeof currentAnimation.stop === 'function') {
                currentAnimation.stop();
            }
            
            // 走りモデルを削除
            if (typeof playerAnimations['run'] === 'object' && playerAnimations['run'].scene) {
                scene.remove(playerAnimations['run'].scene);
            }
            
            // 待機モデルを表示
            gameState.playerModel.visible = true;
            
            // 待機アニメーションを再生
            currentAnimation = playerAnimations['wait'];
            if (typeof currentAnimation.reset === 'function') {
                currentAnimation.reset();
            }
            if (typeof currentAnimation.play === 'function') {
                currentAnimation.play();
            }
        }
    }
    
    // カメラの更新
    updateCamera(gameState, controls, camera);
}



// アニメーションループ
let frameCount = 0; // フレームカウンター

function animate() {
    requestAnimationFrame(animate);
    frameCount++; // フレームカウンターを更新

    const delta = clock.getDelta();

    // ゲームオーバー時は処理を減らす
    if (gameState.isGameOver) {
        renderer.render(scene, camera);
        return;
    }

    // ゲーム開始前は最小限の処理のみ実行
    if (!gameState.gameStarted) {
        renderer.render(scene, camera);
        return;
    }

    // アニメーションの更新
    if (mixer) mixer.update(delta);
    if (dragonMixer) dragonMixer.update(delta);
    
    // ローリングアニメーション専用ミキサーの更新
    if (isRollingAnimationPlaying && playerAnimations['rolling'] && playerAnimations['rolling'].mixer) {
        playerAnimations['rolling'].mixer.update(delta);
    }

    // 各種エフェクトを更新
    updateAllEffects(gameState, scene);

    // クールダウンタイマーの更新
    if (gameState.rollingCooldown > 0) gameState.rollingCooldown--;

    // プレイヤーの移動処理
    if (!gameState.isLoading) {
        movePlayer();
        
        // 走りモデルの位置を更新（アニメーション中の場合）
        if (currentAnimation && typeof playerAnimations['run'] === 'object' && 
            playerAnimations['run'].action && playerAnimations['run'].scene &&
            currentAnimation === playerAnimations['run'].action) {
            playerAnimations['run'].scene.position.copy(gameState.playerPosition);
            // 実際のプレイヤー位置のY座標を使用
            playerAnimations['run'].scene.position.y = gameState.playerPosition.y;
            playerAnimations['run'].scene.rotation.y = gameState.playerRotation + gameState.playerModelRotationOffset;
        }
        
        updateDragon(gameState);
        
        // ドラゴンの炎エフェクト生成フラグが立っていれば炎エフェクトを生成
        if (gameState.shouldCreateDragonFlame) {
            // 移管した関数を呼び出す
            createDragonFlameEffect(gameState, scene);
            // フラグをリセット
            gameState.shouldCreateDragonFlame = false;
        }
        
        // エフェクト数をデバッグ表示（100フレームに1回）
        if (frameCount % 100 === 0) {
            // console.log(`エフェクト数 - ドラゴン炎: ${gameState.dragonFlameEffects.length}, 煙: ${gameState.dustEffects.length}, ビーム: ${gameState.beamEffects.length}, 草: ${gameState.grassSprites.length}`);
            
            // 炎エフェクトが存在する場合、最初のエフェクトの情報を表示
            if (gameState.dragonFlameEffects.length > 0) {
                const flame = gameState.dragonFlameEffects[0];
                // console.log(`炎エフェクト情報: 寿命=${flame.currentLife}/${flame.lifetime}, パーティクル数=${flame.geometry.attributes.position.array.length / 3}`);
            }
        }
        
        // 衝突判定とダメージ処理
        checkCollisions(gameState, isRollingAnimationPlaying);
        
        // 魔法陣での体力回復
        const px = gameState.playerPosition.x;
        const pz = gameState.playerPosition.z;
        
        // デバッグ：プレイヤー位置を表示（100フレームに1回）
        if (frameCount % 100 === 0) {
            // console.log(`プレイヤー位置: x=${px.toFixed(2)}, z=${pz.toFixed(2)}`);
            // console.log(`現在体力: ${gameState.currentHealth}/${gameState.playerHealth}`);
        }
        
        // 動的な魔法陣エリアにいるかチェック
        let isInHealingArea = false;
        if (gameState.particleColumnEffects) {
            for (const column of gameState.particleColumnEffects) {
                const distance = Math.sqrt(
                    Math.pow(px - column.origin.x, 2) + 
                    Math.pow(pz - column.origin.z, 2)
                );
                if (distance < 3) { // 半径3の範囲内で回復
                    isInHealingArea = true;
                    break;
                }
            }
        }
        
        // デバッグ：エリア判定を表示
        if (isInHealingArea && frameCount % 10 === 0) {
            // console.log(`魔法陣エリア内: area1=${area1}, area2=${area2}, area3=${area3}, area4=${area4}`);
        }
        
        if (gameState.currentHealth < gameState.playerHealth && isInHealingArea) {
            // 回復中フラグを設定
            if (!gameState.isHealing) {
                gameState.isHealing = true;
                
                // 回復音を再生
                if (gameState.sounds.heal && gameState.sounds.heal.buffer) {
                    if (gameState.sounds.heal.isPlaying) {
                        gameState.sounds.heal.stop();
                    }
                    gameState.sounds.heal.play();
                }
            }
            
            // 回復パーティクルを生成（初回のみ）
            if (!gameState.healingParticles) {
                console.log('回復パーティクル生成を開始します');
                createHealingParticles(gameState, scene);
                console.log('回復パーティクル生成完了:', gameState.healingParticles);
            }
            
            // 魔法陣エリア内では一定間隔で回復
            gameState.healingTimer--;
            if (gameState.healingTimer <= 0) {
                const oldHealth = gameState.currentHealth;
                gameState.currentHealth += gameState.healingAmount;
                if (gameState.currentHealth > gameState.playerHealth) {
                    gameState.currentHealth = gameState.playerHealth;
                }
                gameState.healingTimer = gameState.healingInterval; // タイマーをリセット
                // console.log(`体力回復: ${oldHealth} → ${gameState.currentHealth}`);
            }
        } else {
            // エリア外では回復タイマーをリセット
            gameState.healingTimer = gameState.healingInterval;
            
            // 回復中フラグをリセット
            if (gameState.isHealing) {
                gameState.isHealing = false;
                // 回復パーティクルを削除
                if (gameState.healingParticles) {
                    scene.remove(gameState.healingParticles);
                    gameState.healingParticles.geometry.dispose();
                    gameState.healingParticles.material.dispose();
                    gameState.healingParticles = null;
                }
            }
        }
        
        // 回復パーティクルのアニメーション更新
        if (gameState.healingParticles && gameState.isHealing) {
            // デバッグ情報を追加
            if (frameCount % 60 === 0) { // 1秒毎にログ出力
                console.log('ヒーリングパーティクル状態:');
                console.log('- パーティクル存在:', !!gameState.healingParticles);
                console.log('- シーンに追加済み:', scene.children.includes(gameState.healingParticles));
                console.log('- マテリアル:', gameState.healingParticles.material);
                console.log('- visible:', gameState.healingParticles.visible);
                console.log('- プレイヤー位置:', gameState.playerPosition.x, gameState.playerPosition.y, gameState.playerPosition.z);
            }
            
            // プレイヤーの位置に追従
            const positions = gameState.healingParticles.geometry.attributes.position.array;
            const playerPos = gameState.playerModel ? gameState.playerModel.position : gameState.playerPosition;
            const time = frameCount * 0.05;
            
            for (let i = 0; i < positions.length; i += 3) {
                const particleIndex = i / 3;
                const angle = particleIndex * 0.2 + time;
                const radius = 1.5 + Math.sin(angle * 1.5) * 0.3;
                const height = Math.sin(angle * 2 + particleIndex) * 0.3;
                
                positions[i] = playerPos.x + Math.cos(angle) * radius;
                positions[i + 1] = playerPos.y + 1.5 + height;
                positions[i + 2] = playerPos.z + Math.sin(angle) * radius;
            }
            gameState.healingParticles.geometry.attributes.position.needsUpdate = true;
            gameState.healingParticles.visible = true; // 確実に表示する
        }
        
        // 無敵時間の更新
        updateInvincibility(gameState);
        
        // 体力インジケーターの更新
        updateHealthBar(gameState);
        
        // プレイヤー追随カメラモードの場合、毎フレームカメラ位置を更新
        if (gameState.followPlayerCamera) {
            // ターゲットはプレイヤーに常に追従
            controls.target.copy(gameState.playerPosition);
        }
        
        // 戦士モデル専用ライトの位置を更新
        warriorLight.position.set(
            gameState.playerPosition.x,
            gameState.playerPosition.y + 2,
            gameState.playerPosition.z
        );
        
        // 戦士モデル専用スポットライトのターゲット位置を更新
        warriorSpotLight.position.set(
            gameState.playerPosition.x,
            gameState.playerPosition.y + 10,
            gameState.playerPosition.z
        );
        warriorSpotLight.target.position.set(
            gameState.playerPosition.x,
            gameState.playerPosition.y,
            gameState.playerPosition.z
        );
    }

    // OrbitControlsの更新（すべてのカメラモードで有効）
    controls.update();

    // カメラの更新
    updateCamera(gameState, controls, camera);

    // レンダリング
    renderer.clear(); // シーンをクリア
    renderer.render(scene, camera);
}

// 初期カメラ位置の設定（追随モードに合わせて調整）
camera.position.set(0, 2.5, 4); // より近くに配置
camera.lookAt(new THREE.Vector3(0, -3.5, 0)); // キャラクターの頭部あたりを注視

// アニメーション開始
animate();

// ゲーム初期化後、最初の柱エフェクトを生成
for (let i = 0; i < 3; i++) { // 初期状態で3本の柱を生成（回復エリア用）
    createParticleColumn(gameState, scene);
}

// 黄色いパーティクルエフェクト（魔法陣）を生成
// createYellowParticleEffect(gameState, scene);

// 回復パーティクル生成関数
function createHealingParticles(gameState, scene) {
    const particleCount = 120; // パーティクル数を大幅に増加
    const geometry = new THREE.BufferGeometry();
    
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    
    // プレイヤーの現在位置を確実に取得
    const playerPos = gameState.playerModel ? gameState.playerModel.position : gameState.playerPosition;
    console.log('回復パーティクル生成位置:', playerPos.x, playerPos.y, playerPos.z);
    
    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        
        // プレイヤー周辺にランダム配置
        const angle = Math.random() * Math.PI * 2;
        const radius = 0.5 + Math.random() * 1.5; // 半径を少し小さく
        const height = Math.random() * 2; // 高さも調整
        
        positions[i3] = playerPos.x + Math.cos(angle) * radius;
        positions[i3 + 1] = playerPos.y + 1 + height; // プレイヤーより少し上
        positions[i3 + 2] = playerPos.z + Math.sin(angle) * radius;
        
        // より明るい蛍光緑色
        colors[i3] = 0.2;     // 赤を抑制
        colors[i3 + 1] = 1.0; // 緑を最大に
        colors[i3 + 2] = 0.3; // 青を少し追加
        
        sizes[i] = 0.3 + Math.random() * 0.2; // サイズを大きく
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    // テクスチャを作成（より確実な表示のため）
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    // より強く光る円を描画
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(200, 255, 200, 1)'); // 中心をより明るく
    gradient.addColorStop(0.2, 'rgba(150, 255, 150, 0.9)'); // 内側も明るく
    gradient.addColorStop(0.5, 'rgba(100, 255, 100, 0.7)'); // 中間部分
    gradient.addColorStop(0.8, 'rgba(50, 255, 50, 0.4)'); // 外側
    gradient.addColorStop(1, 'rgba(0, 255, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    
    const material = new THREE.PointsMaterial({
        size: 5.0, // サイズを元に戻す
        map: texture,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        vertexColors: true,
        opacity: 0.8, // 光る効果を強めるため少し濃く
        sizeAttenuation: false // 距離による減衰をなくす
    });
    
    const particles = new THREE.Points(geometry, material);
    particles.renderOrder = 999; // 最前面で描画
    particles.frustumCulled = false; // カメラから外れても描画
    gameState.healingParticles = particles;
    scene.add(particles);
    console.log('ヒーリングパーティクル作成完了:', particles);
}

// リスタートボタンのセットアップ
setupRestartButton(gameState, scene);

// 勝利ボタンのセットアップ
setupWinButton(gameState, scene);

// Informationモーダルのセットアップ
function setupInfoModal() {
    const infoButton = document.getElementById('infoButton');
    const infoModal = document.getElementById('infoModal');
    const closeModal = document.getElementById('closeModal');
    
    // Informationボタンクリックでモーダルを開く
    infoButton.addEventListener('click', () => {
        infoModal.style.display = 'flex';
    });
    
    // 閉じるボタンでモーダルを閉じる
    closeModal.addEventListener('click', () => {
        infoModal.style.display = 'none';
    });
    
    // モーダル背景クリックでも閉じる
    infoModal.addEventListener('click', (e) => {
        if (e.target === infoModal) {
            infoModal.style.display = 'none';
        }
    });
    
    // ESCキーでモーダルを閉じる
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && infoModal.style.display === 'flex') {
            infoModal.style.display = 'none';
        }
    });
}

setupInfoModal();

// スタートボタンとビデオ制御の機能
function showGameScreen() {
    // ローディングが完了していない場合は待機
    if (gameState.isLoading) {
        console.log('ローディング中のため、ゲーム画面表示を待機中...');
        return;
    }
    
    // すでにゲームが開始されている場合は何もしない
    if (gameState.gameStarted) {
        console.log('ゲームはすでに開始されています');
        return;
    }
    
    // スタート画面を完全に非表示
    const startScreen = document.getElementById('startScreen');
    if (startScreen) {
        startScreen.style.display = 'none';
    }
    
    // ビデオを非表示・停止
    const introVideo = document.getElementById('introVideo');
    if (introVideo) {
        introVideo.style.display = 'none';
        introVideo.pause();
        introVideo.currentTime = 0; // ビデオを最初に巻き戻し
    }
    
    // 3Dキャンバスを表示
    renderer.domElement.style.display = 'block';
    
    // UIを表示
    const infoElement = document.getElementById('info');
    if (infoElement) {
        infoElement.style.opacity = '1';
    }
    
    gameState.gameStarted = true;
    gameState.videoPlaying = false;
    gameState.gameStartTime = Date.now(); // ゲーム開始時刻を記録
    
    // プレイヤーの体力を満タンにリセット
    gameState.currentHealth = gameState.playerHealth;
    
    // 音声を初期化（初回のみ）
    initializeAudio();
    
    // BGMと環境音の再生開始
    setTimeout(() => {
        if (bgmSound && bgmSound.buffer && !bgmSound.isPlaying) {
            bgmSound.play();
            // console.log('BGM再生開始');
        }
        if (windSound && windSound.buffer && !windSound.isPlaying) {
            windSound.play();
            // console.log('環境音再生開始');
        }
    }, 500); // 少し遅延させて確実に初期化後に再生
    
    // console.log('ゲーム画面を表示しました');
}

// ローディング進行状況を更新する関数
function updateLoadingProgress(message) {
    const loadingText = document.getElementById('loadingText');
    if (loadingText) {
        loadingText.textContent = message;
    }
}

// ローディング完了時にスタートボタンを表示する関数
function onLoadingComplete() {
    // console.log('ローディング完了');
    
    // STARTボタンを表示・有効化
    const startButton = document.getElementById('startButton');
    const loadingText = document.getElementById('loadingText');
    
    if (startButton) {
        startButton.style.display = 'block';
        startButton.disabled = false;
        startButton.textContent = 'START';
    }
    
    if (loadingText) {
        loadingText.textContent = 'Ready to Start!';
    }
    
    // ここでは自動でゲーム画面を表示しない
    // ユーザーがSTARTボタンを押すまで待機
    // console.log('STARTボタンが有効になりました。ユーザーの操作を待機中...');
}

// ページ読み込み完了時の初期化
document.addEventListener('DOMContentLoaded', function() {
    const startButton = document.getElementById('startButton');
    const startScreen = document.getElementById('startScreen');
    const introVideo = document.getElementById('introVideo');
    const loadingText = document.getElementById('loadingText');
    
    // 初期状態でローディング中を表示
    if (loadingText) {
        loadingText.textContent = 'Loading assets...';
    }
    
    if (startButton && startScreen && introVideo) {
        // ビデオのイベントリスナーを先に設定（重複防止）
        let videoEventsSet = false;
        
        function setupVideoEvents() {
            if (videoEventsSet) return;
            videoEventsSet = true;
            
            // ビデオ終了時の処理
            introVideo.addEventListener('ended', function() {
                // console.log('ビデオ再生完了');
                gameState.videoPlaying = false;
                if (!gameState.gameStarted) {
                    showGameScreen();
                }
            });
            
            // ビデオをクリックしてスキップ可能
            introVideo.addEventListener('click', function() {
                // console.log('ビデオスキップ');
                introVideo.pause();
                gameState.videoPlaying = false;
                if (!gameState.gameStarted) {
                    // 少し遅延を入れてから画面遷移（スムーズな切り替えのため）
                    setTimeout(() => {
                        showGameScreen();
                    }, 100);
                }
            });
        }
        
        startButton.addEventListener('click', function() {
            // ボタンが無効の場合は何もしない
            if (startButton.disabled) {
                return;
            }
            
            // スタート画面を非表示
            startScreen.style.display = 'none';
            
            // ビデオを表示して再生開始
            introVideo.style.display = 'block';
            gameState.videoPlaying = true;
            
            // ミュート状態を動画にも適用
            introVideo.muted = gameState.isMuted;
            
            // ビデオイベントを設定
            setupVideoEvents();
            
            introVideo.play().then(() => {
                // console.log('ビデオ再生開始');
            }).catch((error) => {
                console.error('ビデオ再生エラー:', error);
                // ビデオ再生に失敗した場合は直接ゲーム開始
                gameState.videoPlaying = false;
                if (!gameState.gameStarted) {
                    showGameScreen();
                }
            });
        });
    }
});
