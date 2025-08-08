// Three.jsのインポート
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AudioListener, Audio, AudioLoader } from 'three';
import { PMREMGenerator, CubeTextureLoader } from 'three';

// 環境関連のインポート
import { addGrass, addRocks, updateGrassWind, createDefaultEnvMap, getAssetPath } from './js/environment.js';
import { createGrassField } from './js/GrassField.js';
import { createTerrainMesh } from './js/terrain.js';

// アニメーション関連のインポート
import { analyzeAnimation } from './js/animation.js';

// ========================================
// アセット管理システム
// ========================================
const ASSETS = {
    // 3Dモデル
    models: {
        'player_wait': 'assets/knight/wait.glb',
        'player_run': 'assets/knight/run.glb', 
        'player_rolling': 'assets/knight/rolling.glb',
        'dragon_fly': 'assets/dragon/fly.glb'
    },
    // 音声ファイル
    sounds: {
        'bgm': 'assets/sound/music.mp3',
        'wind': 'assets/sound/wind.mp3',
        'attack': 'assets/sound/attach.mp3',
        'footstep': 'assets/sound/foot.mp3',
        'fire': 'assets/sound/fire.mp3',
        'patipati': 'assets/sound/patipati.mp3',
        'heal': 'assets/sound/heal.mp3',
        'dragon_voice': 'assets/sound/dragon-voice2.mp3',
        'button': 'assets/sound/btn.mp3',
        'thunder': 'assets/sound/thunder_sequence.mp3'
    },
    // テクスチャ
    textures: {
        'ground': 'assets/area/dry_grassland.png',
        'sky': 'assets/area/sunset.png'
    }
};

// プログレス管理用のアセットローダー
class AssetLoader {
    constructor() {
        this.totalAssets = 0;
        this.loadedAssets = 0;
        this.gltfLoader = new GLTFLoader();
        this.audioLoader = new AudioLoader();
        this.textureLoader = new THREE.TextureLoader();
        
        // アセット数をカウント
        this.totalAssets = Object.keys(ASSETS.models).length + Object.keys(ASSETS.sounds).length;
        gameState.totalAssets = this.totalAssets;
        
        // console.log(`Total assets to load: ${this.totalAssets}`);
    }
    
    loadModel(key, onSuccess, onError) {
        const path = getAssetPath(ASSETS.models[key]);
        // console.log(`Loading model: ${key} from ${path}`);
        
        this.gltfLoader.load(
            path,
            (gltf) => {
                this.onAssetLoaded(`Model: ${key}`);
                if (onSuccess) onSuccess(gltf);
            },
            null,
            (error) => {
                console.error(`Failed to load model ${key}:`, error);
                this.onAssetLoaded(`Model: ${key} (failed)`);
                if (onError) onError(error);
            }
        );
    }
    
    loadSound(key, onSuccess, onError) {
        const path = getAssetPath(ASSETS.sounds[key]);
        // console.log(`Loading sound: ${key} from ${path}`);
        
        this.audioLoader.load(
            path,
            (buffer) => {
                this.onAssetLoaded(`Sound: ${key}`);
                if (onSuccess) onSuccess(buffer);
            },
            null,
            (error) => {
                console.error(`Failed to load sound ${key}:`, error);
                this.onAssetLoaded(`Sound: ${key} (failed)`);
                if (onError) onError(error);
            }
        );
    }
    
    loadTexture(key, onSuccess, onError) {
        const path = getAssetPath(ASSETS.textures[key]);
        console.log(`Loading texture: ${key} from ${path}`);
        
        this.textureLoader.load(
            path,
            (texture) => {
                this.onAssetLoaded(`Texture: ${key}`);
                if (onSuccess) onSuccess(texture);
            },
            null,
            (error) => {
                console.error(`Failed to load texture ${key}:`, error);
                this.onAssetLoaded(`Texture: ${key} (failed)`);
                if (onError) onError(error);
            }
        );
    }
    
    onAssetLoaded(assetName) {
        this.loadedAssets++;
        const progress = Math.min((this.loadedAssets / this.totalAssets) * 100, 100);
        
        // console.log(`Asset loaded: ${assetName} (${this.loadedAssets}/${this.totalAssets} = ${Math.floor(progress)}%)`);
        
        // プログレスバー更新
        gameState.loadedAssets = this.loadedAssets;
        gameState.loadingProgress = progress;
        
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        const mobileProgressText = document.getElementById('mobileProgressText');
        
        if (progressBar) {
            progressBar.style.width = progress + '%';
        }
        
        const progressPercentage = Math.floor(progress) + '%';
        if (progressText) {
            progressText.textContent = progressPercentage;
        }
        
        // スマホ用の%表示も更新
        if (mobileProgressText) {
            mobileProgressText.textContent = progressPercentage;
        }
        
        // すべてのアセットが読み込まれたら完了処理
        if (this.loadedAssets >= this.totalAssets && gameState.isLoading) {
            // console.log('All assets loaded! Finalizing...');
            gameState.isLoading = false;
            document.getElementById('loading').style.display = 'none';
            onLoadingComplete();
        }
    }
}

// グローバルなアセットローダーインスタンス（後で初期化）
let assetLoader;

// UI関連のインポート
import { updateHealthBar, updateDragonHealthBar, gameOver, restartGame, setupRestartButton, showWinScreen, setupWinButton } from './js/ui.js';
import { updateInvincibility, applyDamage, applyDragonDamage } from './js/player.js';
import { checkCollisions } from './js/collision.js';

// カメラ関連のインポート
import { toggleCameraMode, updateFollowCameraPosition, updateFollowCamera, updateCamera } from './js/camera.js';

// サウンド関連のインポート
import { playFootstepSound, playButtonClickSound } from './js/sound.js';

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

// GLSLライトニングシステムをインポート
import { GLSLLightningSystem } from './js/glslLightningSystem.js';
import { GLContext } from './js/glContext.js';

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
    totalAssets: 0, // アセットローダーで動的に設定
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
    dustSize: 0.08, // 煙の粒子の大きさ（小さくする）
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
        fire: 0.25,
        patipati: 0.6,
        heal: 1.0,
        dragonVoice: 0.8,
        rolling: 0.8,
        thunder: 0.7,
        buttonClick: 0.3
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
    shouldCreateDragonLightning: false, // ドラゴンの雷エフェクト生成フラグ
    dragonLightningTarget: null, // 雷攻撃のターゲット位置
    lightningDamage: 10, // 雷のダメージ量
    lightningDamageRadius: 8.0, // 雷のダメージ範囲（拡散に合わせて拡大）
    lightningDamageActive: false, // 雷ダメージ判定のフラグ
    lightningDamagePosition: null, // 雷の着弾位置
    lightningDamageDuration: 60, // 雷ダメージの持続フレーム数
    lightningDamageTimer: 0, // 雷ダメージのタイマー
    lightningStrikeActive: false, // 落ちてくる雷のダメージ判定フラグ
    lightningStrikePath: null, // 落ちてくる雷のパス（start, end）
    lightningStrikeDuration: 30, // 落ちてくる雷のダメージ持続時間
    lightningStrikeTimer: 0, // 落ちてくる雷のタイマー
    lightningStrikeDamage: 15, // 落ちてくる雷のダメージ量
    
    // 雷の予兆球体関連
    lightningOrbActive: false, // 予兆球体が表示中かどうか
    lightningOrbPosition: null, // 予兆球体の位置
    lightningOrbTarget: null, // 雷の落下目標位置
    lightningOrbTimer: 0, // 予兆球体の表示時間カウンター
    lightningOrbDuration: 120, // 予兆球体の表示時間（2秒 = 120フレーム）
    lightningOrbMesh: null, // 予兆球体のメッシュオブジェクト
    
    isOnRock: false, // 岩の上にいるかどうか
    
    // 体力回復関連のパラメータ
    healingTimer: 30, // 体力回復のタイマー（初期値を間隔と同じに設定）
    healingInterval: 30, // 体力回復の間隔（フレーム単位）
    healingAmount: 3, // 1回の回復量を増加
    
    // グローバルミュート状態
    isMuted: false, // ゲーム全体のミュート状態
    
    // ドラッグ操作関連
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragThreshold: 10, // ドラッグと判定する最小移動距離
};

// AssetLoaderを初期化
assetLoader = new AssetLoader();

// 電気粒子エフェクトを作成する関数
function createLightningOrb(position, targetPos) {
    // パーティクルシステムの作成
    const particleCount = 1200; // 粒子数をさらに増やして細かい密度の高いエフェクトに
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const velocities = new Float32Array(particleCount * 3);
    
    // ドラゴンの周りに粒子を配置
    const dragonPos = gameState.dragonPosition;
    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        
        // ドラゴンの翼の高さに球状分布
        const radius = 2 + Math.random() * 3; // 2-5単位の範囲
        const theta = Math.random() * Math.PI * 2; // 0-2π
        const phi = Math.random() * Math.PI; // 0-π
        
        positions[i3] = dragonPos.x - 5 + radius * Math.sin(phi) * Math.cos(theta); // ドラゴンの左側（-5単位）
        positions[i3 + 1] = dragonPos.y + 8 + radius * Math.cos(phi); // ドラゴンより8単位上（より高い位置）
        positions[i3 + 2] = dragonPos.z + radius * Math.sin(phi) * Math.sin(theta);
        
        // 白い光の粒子
        colors[i3] = 1.0; // R: 白
        colors[i3 + 1] = 1.0; // G: 白
        colors[i3 + 2] = 1.0; // B: 白
        
        // 小さな粒子サイズ
        sizes[i] = 0.3 + Math.random() * 0.4; // 0.3-0.7の小さなサイズ
        
        // 螺旋状の動き
        velocities[i3] = (Math.random() - 0.5) * 0.02;
        velocities[i3 + 1] = (Math.random() - 0.5) * 0.01;
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.02;
    }
    
    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particles.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    particles.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    
    // パーティクルのマテリアル
    const particleMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            pointTexture: { value: null }
        },
        vertexShader: `
            attribute float size;
            attribute vec3 velocity;
            uniform float time;
            varying vec3 vColor;
            
            void main() {
                vColor = color;
                
                // 時間による位置の変化（螺旋運動）
                vec3 pos = position;
                pos += velocity * time * 50.0;
                
                // ドラゴン周りの軌道運動
                float angle = time * 2.0;
                float radius = length(pos.xz);
                pos.x += sin(angle + pos.y * 0.1) * 0.5;
                pos.z += cos(angle + pos.y * 0.1) * 0.5;
                
                vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                gl_PointSize = size * (150.0 / -mvPosition.z); // 小さな粒子用のサイズ係数
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform float time;
            varying vec3 vColor;
            
            void main() {
                // 円形の粒子
                float distanceToCenter = length(gl_PointCoord - vec2(0.5));
                if (distanceToCenter > 0.5) discard;
                
                // 電気的な輝き
                float intensity = 1.0 - distanceToCenter * 2.0;
                intensity = pow(intensity, 2.0);
                
                // 脈動効果
                float pulse = 0.7 + 0.3 * sin(time * 8.0 + gl_PointCoord.x * 10.0);
                
                gl_FragColor = vec4(vColor * intensity * pulse * 2.0, intensity * 1.8);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        vertexColors: true
    });
    
    // パーティクルシステムを作成
    const particleSystem = new THREE.Points(particles, particleMaterial);
    
    // シーンに追加
    scene.add(particleSystem);
    
    // gameStateに保存
    gameState.lightningOrbMesh = particleSystem;
    
    // アニメーション用の時間を保存
    gameState.lightningOrbStartTime = Date.now();
    
    // パーティクルアニメーション
    function updateParticles() {
        if (particleMaterial.uniforms && gameState.lightningOrbActive) {
            const elapsed = (Date.now() - gameState.lightningOrbStartTime) * 0.001;
            particleMaterial.uniforms.time.value = elapsed;
            requestAnimationFrame(updateParticles);
        }
    }
    updateParticles();
}

// 予兆球体から雷を発射する関数
function fireLightningFromOrb() {
    if (!gameState.lightningOrbPosition || !gameState.lightningOrbTarget) return;
    
    // GLSLライトニングシステムで雷攻撃を実行
    if (glslLightningSystem) {
        // 粒子の凝縮点（ドラゴンの左側上空）から発射
        const dragonPos = gameState.dragonPosition;
        const startPos = [
            dragonPos.x - 5, // ドラゴンの左側
            dragonPos.y + 8, // 上空
            dragonPos.z
        ];
        
        // プレイヤーの現在位置をターゲットにする
        const targetPos = [
            gameState.playerPosition.x,
            gameState.playerPosition.y,
            gameState.playerPosition.z
        ];
        
        glslLightningSystem.strikeTarget(startPos, targetPos, 60);
        
        // 落ちてくる雷のダメージ判定を設定
        gameState.lightningStrikeActive = true;
        gameState.lightningStrikePath = { start: startPos, end: targetPos };
        gameState.lightningStrikeDuration = 30;
        gameState.lightningStrikeTimer = gameState.lightningStrikeDuration;
        gameState.lightningStrikeDamage = 15;
        
        // 雷の音を再生
        if (!gameState.isMuted) {
            if (gameState.sounds.thunder && gameState.sounds.thunder.buffer) {
                if (gameState.sounds.thunder.isPlaying) {
                    gameState.sounds.thunder.stop();
                }
                gameState.sounds.thunder.setVolume(0.7);
                gameState.sounds.thunder.play();
            } else if (gameState.sounds.fire && gameState.sounds.fire.buffer) {
                if (gameState.sounds.fire.isPlaying) {
                    gameState.sounds.fire.stop();
                }
                gameState.sounds.fire.setVolume(0.7);
                gameState.sounds.fire.play();
            } else {
                console.warn("雷音が利用できません");
            }
        }
    }
    
    // 予兆球体を削除
    if (gameState.lightningOrbMesh) {
        scene.remove(gameState.lightningOrbMesh);
        gameState.lightningOrbMesh.geometry.dispose();
        gameState.lightningOrbMesh.material.dispose();
        gameState.lightningOrbMesh = null;
    }
    
    // 予兆球体の状態をリセット
    gameState.lightningOrbActive = false;
    gameState.lightningOrbPosition = null;
    gameState.lightningOrbTarget = null;
    gameState.lightningOrbTimer = 0;
}

// シーン、カメラ、レンダラーの設定
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); // 背景色を完全に黒に
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // ソフトシャドウマップを使用
// glTF/PBR を正しく表示（騎士が黒くなるのを防ぐ）
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;

// 最初からcanvasを表示する（地面が消えたように見えるのを防ぐ）
renderer.domElement.style.display = 'block';
document.body.appendChild(renderer.domElement);

// GLSLライトニングシステムの初期化
const particleCanvas = document.getElementById('particleCanvas');
let glslLightningSystem = null;
// console.log("particleCanvas取得:", particleCanvas);
if (particleCanvas) {
    // キャンバスの設定とスタイルの確認
    particleCanvas.width = window.innerWidth;
    particleCanvas.height = window.innerHeight;
    particleCanvas.style.position = 'absolute';
    particleCanvas.style.top = '0';
    particleCanvas.style.left = '0';
    particleCanvas.style.pointerEvents = 'none';
    particleCanvas.style.zIndex = '10';
    // particleCanvas.style.backgroundColor = 'rgba(255, 0, 0, 0.1)'; // テスト用：薄い赤色背景（削除）
    
    // console.log("particleCanvasスタイル:", {
    //     position: particleCanvas.style.position,
    //     zIndex: particleCanvas.style.zIndex,
    //     width: particleCanvas.width,
    //     height: particleCanvas.height,
    //     display: particleCanvas.style.display
    // });
    
    // console.log("GLContext初期化開始");
    const gl = GLContext.init(particleCanvas);
    // console.log("GLContext初期化結果:", gl);
    GLContext.resize(window.innerWidth, window.innerHeight);
    // console.log("GLSLLightningSystem作成開始");
    glslLightningSystem = new GLSLLightningSystem(2000);
    // console.log("GLSLLightningSystem作成完了:", glslLightningSystem);
} else {
    console.error("particleCanvasが見つかりません");
}

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
    // ボタンクリック音を再生（ミュート前に）
    if (!gameState.isMuted) {
        playButtonClickSound(gameState);
    }
    
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
        
        // すべてのサウンドエフェクトの音量を復活
        Object.entries(gameState.sounds).forEach(([soundName, sound]) => {
            if (sound && sound.setVolume && gameState.defaultVolumes[soundName]) {
                sound.setVolume(gameState.defaultVolumes[soundName]);
            }
        });
        
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
    // ボタンクリック音を再生
    playButtonClickSound(gameState);
    
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
const ambientLight = new THREE.AmbientLight(0xffffff, 0.02); // 環境光をほぼゼロに
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.08); // メイン光源を極限まで暗く
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
const warriorLight = new THREE.PointLight(0xffffff, 0.1, 6); // 戦士用ライトを最小限に
warriorLight.position.set(0, 2, 0);
warriorLight.castShadow = true;
scene.add(warriorLight);

// 戦士モデル専用のスポットライト - 上から照らす
const warriorSpotLight = new THREE.SpotLight(0xffffff, 0.1, 8, Math.PI / 4, 0.5, 1); // スポットライトを最小限に
warriorSpotLight.position.set(0, 10, 0);
warriorSpotLight.target.position.set(0, 0, 0);
scene.add(warriorSpotLight);
scene.add(warriorSpotLight.target);

// 全体を照らす補助光（更に弱くして地面を暗く）
const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x000000, 0.05); // 半球ライトをほぼゼロに
scene.add(hemisphereLight);

// 騎士専用の追加ライト（鎧を明るく照らす）
const knightLight = new THREE.PointLight(0xffffff, 0.15, 5); // 騎士専用ライトを最小限に
knightLight.position.set(0, 5, 2);
scene.add(knightLight);

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

// チャンクマネージャークラス（openworldプロジェクトを参考に実装）
class ChunkManager {
    constructor(scene, chunkSize = 100, renderDistance = 3) {
        this.scene = scene;
        this.chunkSize = chunkSize;
        this.renderDistance = renderDistance;
        this.chunks = new Map();
        this.playerChunk = { x: 0, z: 0 };
        
        // テクスチャの読み込み
        const textureLoader = new THREE.TextureLoader();
        this.groundTexture = textureLoader.load(getAssetPath('assets/area/dry_grassland.png'));
        this.groundTexture.wrapS = THREE.RepeatWrapping;
        this.groundTexture.wrapT = THREE.RepeatWrapping;
        this.groundTexture.repeat.set(10, 10);
    }
    
    getChunkKey(x, z) {
        return `${x},${z}`;
    }
    
    getChunkCoords(worldX, worldZ) {
        return {
            x: Math.floor(worldX / this.chunkSize),
            z: Math.floor(worldZ / this.chunkSize)
        };
    }
    
    createChunk(chunkX, chunkZ) {
        // セグメント数を偶数にして、頂点が正確に境界に配置されるようにする
        // 継ぎ目を安定させるため、チャンク境界に頂点が必ず一致する分割数に固定
        const segments = 64;
        // チャンクの境界で隙間が発生しないよう、わずかにオーバーラップさせる
        const overlapAmount = 0.2;
        const geometry = new THREE.PlaneGeometry(
            this.chunkSize + overlapAmount,
            this.chunkSize + overlapAmount,
            segments,
            segments
        );
        
        
        // マテリアルの作成
        const material = new THREE.MeshStandardMaterial({
            map: this.groundTexture,
            color: 0x111111,  // 地面の色を極限まで暗く
            roughness: 1.0,
            metalness: 0.0,
            emissive: new THREE.Color(0x000000) // 発光なし
        });
        
        const vertices = geometry.attributes.position.array;
        const worldOffsetX = chunkX * this.chunkSize;
        const worldOffsetZ = chunkZ * this.chunkSize;
        
        // 地形の高さを生成（XZ→Yの一貫座標系）
        for (let i = 0; i < vertices.length; i += 3) {
            const localX = vertices[i];      // 平面上のX
            const localZ = vertices[i + 1];  // 平面上のYをZとして扱う
            const worldX = localX + worldOffsetX;
            const worldZ = localZ + worldOffsetZ;
            const height = this.getHeightAtPosition(worldX, worldZ);
            vertices[i + 2] = height + 5; // 回転前のZに高さを入れて、後で-PI/2回転
        }
        
        geometry.computeVertexNormals();
        
        const chunk = new THREE.Mesh(geometry, material);
        chunk.rotation.x = -Math.PI / 2;
        chunk.position.x = worldOffsetX;
        chunk.position.y = -5;  // 地面の基準高さ
        chunk.position.z = worldOffsetZ;
        chunk.receiveShadow = true;
        
        return chunk;
    }
    
    updateChunks(playerPosition) {
        const currentChunk = this.getChunkCoords(playerPosition.x, playerPosition.z);
        
        // プレイヤーのチャンクが変わったかチェック
        if (currentChunk.x !== this.playerChunk.x || currentChunk.z !== this.playerChunk.z) {
            this.playerChunk = currentChunk;
            console.log(`プレイヤーがチャンク (${currentChunk.x}, ${currentChunk.z}) に移動`);
        }
        
        const chunksToKeep = new Set();
        
        // 必要なチャンクを生成
        for (let dx = -this.renderDistance; dx <= this.renderDistance; dx++) {
            for (let dz = -this.renderDistance; dz <= this.renderDistance; dz++) {
                const chunkX = this.playerChunk.x + dx;
                const chunkZ = this.playerChunk.z + dz;
                const key = this.getChunkKey(chunkX, chunkZ);
                
                chunksToKeep.add(key);
                
                if (!this.chunks.has(key)) {
                    const chunk = this.createChunk(chunkX, chunkZ);
                    this.chunks.set(key, chunk);
                    this.scene.add(chunk);
                    console.log(`新しいチャンクを生成: ${key}`);
                }
            }
        }
        
        // 不要なチャンクを削除
        for (const [key, chunk] of this.chunks) {
            if (!chunksToKeep.has(key)) {
                this.scene.remove(chunk);
                chunk.geometry.dispose();
                chunk.material.dispose();
                this.chunks.delete(key);
                console.log(`チャンクを削除: ${key}`);
            }
        }
    }
    
    getHeightAtPosition(x, z) {
        // 地形の高さを計算
        let height = 0;
        let frequency = 0.01;
        let amplitude = 8;
        
        for (let j = 0; j < 3; j++) {
            height += Math.sin(x * frequency) * Math.cos(z * frequency) * amplitude;
            height += Math.sin(x * frequency * 1.5) * Math.cos(z * frequency * 1.5) * amplitude * 0.5;
            frequency *= 2;
            amplitude *= 0.5;
        }
        
        return height - 5;  // 基準高さを引く
    }
}

// チャンクマネージャーのインスタンスを作成
const chunkManager = new ChunkManager(scene);
gameState.chunkManager = chunkManager;

// 初期チャンクを生成
chunkManager.updateChunks(gameState.playerPosition);

console.log("無限地形システムを初期化しました");

// 草を生やす関数（メモリ最適化済み）
// TODO: チャンクごとに草を生成するように修正
// addGrass(scene, gameState);

// GrassField を追加（Netlify 配信想定のブレードテクスチャ）
let grassField = null;
try {
    const { mesh, update } = createGrassField({
        count: 80000,
        areaSize: 100,
        bladeWidth: 0.14,
        bladeHeight: 1.1,
        alphaTest: 0.15,
        // Netlify 上のパスを `getAssetPath` で解決
        textureUrl: getAssetPath('assets/images/grass_blade.png'),
        wind: new THREE.Vector2(0.8, 0.3),
        noiseScale: 0.5,
        swayAmplitude: 0.07,
        castShadow: false,
        heightAt: (x, z) => {
            // GrassField はローカル中心座標で生成するため、
            // ワールド座標 = mesh.position + ローカル(x,z) とする。
            // ここではメッシュを原点に置く前提で、そのまま使用する。
            return gameState.chunkManager ? gameState.chunkManager.getHeightAtPosition(x, z) : gameState.groundLevel;
        },
        baseY: 0.02,
    });
    // 草メッシュの原点は(0,0,0)。各インスタンスで高さに合わせているので原点は0でOK
    mesh.position.set(0, 0, 0);
    scene.add(mesh);
    grassField = { mesh, update };
    // 地形の高さに草の根元を合わせる軽微な補正（中心のみ）
    if (gameState.chunkManager) {
        const centerY = gameState.chunkManager.getHeightAtPosition(0, 0);
        mesh.position.y = centerY + 0.02;
    }
} catch (e) {
    console.warn('GrassField の初期化に失敗:', e);
}

// 岩を配置
// TODO: チャンクごとに岩を配置するように修正
// addRocks(scene, gameState);

// スカイボックスの作成
const skyGeometry = new THREE.SphereGeometry(500, 60, 40);
const skyTexture = new THREE.TextureLoader().load(getAssetPath('assets/area/sunset.png'));
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
if (assetLoader) {
    try {
        assetLoader.loadModel('player_wait', (gltf) => {
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
                                newMat.metalness = 1.0; // 金属性を控えめに
                                newMat.roughness = 0.1; // 表面の粗さを最小に（光沢感を最大に）
                                newMat.envMapIntensity = 0.8; // 環境マップの強度
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
                            newMat.metalness = 1.0; // 金属性を控えめに
                            newMat.roughness = 0.1; // 表面の粗さを最小に（光沢感を最大に）
                            newMat.envMapIntensity = 0.8; // 環境マップの強度を下げる
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
                assetLoader.loadModel('player_run', (runGltf) => {
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
                                        newMat.metalness = 0.7;
                                        newMat.roughness = 0.1;
                                        newMat.envMapIntensity = 0.3;
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
                
                // 攻撃アニメーションを読み込む（現在は無効化）
                // updateLoadingProgress('Loading attack animation...');
                // loader.load('https://elden-kamui.netlify.app/assets/knight/attach.glb', (attachGltf) => {
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
                updateLoadingProgress('Loading rolling animation...');
                assetLoader.loadModel('player_rolling', (rollingGltf) => {
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
                                    
                                    newMat.metalness = 0.7;
                                    newMat.roughness = 0.1;
                                    newMat.envMapIntensity = 0.3;
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
            // loader.load('https://elden-kamui.netlify.app/assets/knight/jump.glb', (jumpGltf) => {
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
                // console.log('Starting dragon model load...');
                assetLoader.loadModel('dragon_fly', (gltf) => {

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
                    
                    // ドラゴンモデル読み込み完了（ただし、他のアセットの読み込みを待つ必要がある）
                    // console.log('Dragon model loaded, checking if all assets are loaded...');
                }, 
                (xhr) => {
                    // console.log((xhr.loaded / xhr.total * 100) + '% ドラゴンモデル読み込み中...');
                },
                (error) => {
                    console.error('ドラゴンモデル読み込みエラー:', error);
                    console.error('Error details:', error.message, error.stack);
                });
            } catch (e) {
                console.error("ドラゴンモデル読み込み例外:", e);
            }
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
        
        // グローバルに参照できるようにする
        window.audioLoader = audioLoader;
        
        if (audioLoader) {
            assetLoader.loadSound('bgm', (buffer) => {
                bgmSound.setBuffer(buffer);
                bgmSound.setLoop(true);
                bgmSound.setVolume(gameState.isMuted ? 0 : 0.5);
            });

            // 環境音
            windSound = new Audio(audioListener);
            assetLoader.loadSound('wind', (buffer) => {
                windSound.setBuffer(buffer);
                windSound.setLoop(true);
                windSound.setVolume(gameState.isMuted ? 0 : 0.6);
            });

            // 戦士の攻撃音
            const attackSound = new Audio(audioListener);
            assetLoader.loadSound('attack', (buffer) => {
                attackSound.setBuffer(buffer);
                attackSound.setLoop(false);
                attackSound.setVolume(gameState.isMuted ? 0 : 0.7);
                gameState.sounds.attack = attackSound;
            });

            // 戦士の足音
            const footstepSound = new Audio(audioListener);
            assetLoader.loadSound('footstep', (buffer) => {
                footstepSound.setBuffer(buffer);
                footstepSound.setLoop(false);
                footstepSound.setVolume(gameState.isMuted ? 0 : 0.5);
                gameState.sounds.footstep = footstepSound;
                // console.log('足音読み込み成功');
            });

            // ドラゴンの炎音
            const fireSound = new Audio(audioListener);
            assetLoader.loadSound('fire', (buffer) => {
                fireSound.setBuffer(buffer);
                fireSound.setLoop(false);
                fireSound.setVolume(gameState.isMuted ? 0 : 0.25);
                gameState.sounds.fire = fireSound;
                // console.log('炎音読み込み成功');
            });

            // パチパチ音（炎の効果音）
            const patipatiSound = new Audio(audioListener);
            assetLoader.loadSound('patipati', (buffer) => {
                patipatiSound.setBuffer(buffer);
                patipatiSound.setLoop(false);
                patipatiSound.setVolume(gameState.isMuted ? 0 : 0.6);
                gameState.sounds.patipati = patipatiSound;
                // console.log('パチパチ音読み込み成功');
            });

            // 回復音
            const healSound = new Audio(audioListener);
            assetLoader.loadSound('heal', (buffer) => {
                healSound.setBuffer(buffer);
                healSound.setLoop(false);
                healSound.setVolume(gameState.isMuted ? 0 : 1.0);
                gameState.sounds.heal = healSound;
                // console.log('回復音読み込み成功');
            });

            // ドラゴンボイス
            const dragonVoiceSound = new Audio(audioListener);
            assetLoader.loadSound('dragon_voice', (buffer) => {
                dragonVoiceSound.setBuffer(buffer);
                dragonVoiceSound.setLoop(false);
                dragonVoiceSound.setVolume(gameState.isMuted ? 0 : 0.3);
                gameState.sounds.dragonVoice = dragonVoiceSound;
            });

            // ボタンクリック音
            const buttonClickSound = new Audio(audioListener);
    
            assetLoader.loadSound('button', (buffer) => {
                buttonClickSound.setBuffer(buffer);
                buttonClickSound.setLoop(false);
                buttonClickSound.setVolume(gameState.isMuted ? 0 : 0.3);
                gameState.sounds.buttonClick = buttonClickSound;
            });

            // 雷音
            const thunderSound = new Audio(audioListener);

            assetLoader.loadSound('thunder', (buffer) => {
                thunderSound.setBuffer(buffer);
                thunderSound.setLoop(false);
                thunderSound.setVolume(gameState.isMuted ? 0 : 0.7);
                gameState.sounds.thunder = thunderSound;
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
                    }
                }
                
                // 体力回復テスト（Tキー）
                if (e.key === 't' || e.key === 'T') {
                    gameState.currentHealth = Math.min(gameState.currentHealth + 10, gameState.playerHealth);
                }
                
                // 雷音テスト（Lキー）- thunder_sequence.mp3を使用
                if (e.key === 'l' || e.key === 'L') {
                    if (gameState.sounds.thunder && gameState.sounds.thunder.buffer) {
                        if (gameState.sounds.thunder.isPlaying) {
                            gameState.sounds.thunder.stop();
                        }
                        gameState.sounds.thunder.setVolume(0.7);
                        gameState.sounds.thunder.play();
                    } else {
                        console.warn('雷音が利用できません');
                    }
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

// 音声初期化を実行
initializeAudio();

// モバイル用矢印キーコントロールの初期化を別関数に移動
function initializeMobileControls() {
    const mobileUp = document.getElementById('mobileUp');
    const mobileLeft = document.getElementById('mobileLeft');
    const mobileRight = document.getElementById('mobileRight');
    
    // モバイルアクションボタンの初期化
    const mobileAttackButton = document.getElementById('mobileAttackButton');
    const mobileRollingButton = document.getElementById('mobileRollingButton');
    
    // console.log('モバイルコントロール初期化:', { mobileUp, mobileLeft, mobileRight });

    // マウスイベント（PCでもスマホでも動作）
    if (mobileUp) {
        mobileUp.addEventListener('mousedown', (e) => {
            e.preventDefault();
            gameState.keysPressed['ArrowUp'] = true;
        });
        mobileUp.addEventListener('mouseup', (e) => {
            e.preventDefault();
            gameState.keysPressed['ArrowUp'] = false;
        });
        mobileUp.addEventListener('mouseleave', (e) => {
            gameState.keysPressed['ArrowUp'] = false;
        });
        // タッチイベントも追加
        mobileUp.addEventListener('touchstart', (e) => {
            e.preventDefault();
            gameState.keysPressed['ArrowUp'] = true;
        });
        mobileUp.addEventListener('touchend', (e) => {
            e.preventDefault();
            gameState.keysPressed['ArrowUp'] = false;
        });
    }

    if (mobileLeft) {
        mobileLeft.addEventListener('mousedown', (e) => {
            e.preventDefault();
            gameState.keysPressed['ArrowLeft'] = true;
        });
        mobileLeft.addEventListener('mouseup', (e) => {
            e.preventDefault();
            gameState.keysPressed['ArrowLeft'] = false;
        });
        mobileLeft.addEventListener('mouseleave', (e) => {
            gameState.keysPressed['ArrowLeft'] = false;
        });
        // タッチイベントも追加
        mobileLeft.addEventListener('touchstart', (e) => {
            e.preventDefault();
            gameState.keysPressed['ArrowLeft'] = true;
        });
        mobileLeft.addEventListener('touchend', (e) => {
            e.preventDefault();
            gameState.keysPressed['ArrowLeft'] = false;
        });
    }

    if (mobileRight) {
        mobileRight.addEventListener('mousedown', (e) => {
            e.preventDefault();
            gameState.keysPressed['ArrowRight'] = true;
        });
        mobileRight.addEventListener('mouseup', (e) => {
            e.preventDefault();
            gameState.keysPressed['ArrowRight'] = false;
        });
        mobileRight.addEventListener('mouseleave', (e) => {
            gameState.keysPressed['ArrowRight'] = false;
        });
        // タッチイベントも追加
        mobileRight.addEventListener('touchstart', (e) => {
            e.preventDefault();
            gameState.keysPressed['ArrowRight'] = true;
        });
        mobileRight.addEventListener('touchend', (e) => {
            e.preventDefault();
            gameState.keysPressed['ArrowRight'] = false;
        });
    }
    
    // モバイル攻撃ボタンのイベントリスナー
    if (mobileAttackButton) {
        mobileAttackButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            gameState.keysPressed['f'] = true;
        });
        mobileAttackButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            gameState.keysPressed['f'] = false;
        });
        mobileAttackButton.addEventListener('mousedown', (e) => {
            e.preventDefault();
            gameState.keysPressed['f'] = true;
        });
        mobileAttackButton.addEventListener('mouseup', (e) => {
            e.preventDefault();
            gameState.keysPressed['f'] = false;
        });
        mobileAttackButton.addEventListener('mouseleave', (e) => {
            gameState.keysPressed['f'] = false;
        });
    }
    
    // モバイルローリングボタンのイベントリスナー
    if (mobileRollingButton) {
        mobileRollingButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            gameState.keysPressed['r'] = true;
        });
        mobileRollingButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            gameState.keysPressed['r'] = false;
        });
        mobileRollingButton.addEventListener('mousedown', (e) => {
            e.preventDefault();
            gameState.keysPressed['r'] = true;
        });
        mobileRollingButton.addEventListener('mouseup', (e) => {
            e.preventDefault();
            gameState.keysPressed['r'] = false;
        });
        mobileRollingButton.addEventListener('mouseleave', (e) => {
            gameState.keysPressed['r'] = false;
        });
    }
}

window.addEventListener('keyup', (e) => {
    gameState.keysPressed[e.key] = false;
});

// マウスドラッグイベントの処理
window.addEventListener('mousedown', (e) => {
    if (!gameState.gameStarted || gameState.isGameOver) return;
    
    // モバイルボタン上でのクリックは無視
    if (e.target.classList.contains('mobile-control') || 
        e.target.closest('.mobile-control')) return;
    
    gameState.isDragging = true;
    gameState.dragStartX = e.clientX;
    gameState.dragStartY = e.clientY;
});

window.addEventListener('mousemove', (e) => {
    if (!gameState.isDragging || !gameState.gameStarted || gameState.isGameOver) return;
    
    const deltaX = e.clientX - gameState.dragStartX;
    const deltaY = e.clientY - gameState.dragStartY;
    
    // ドラッグの移動量が閾値を超えた場合のみ処理
    if (Math.abs(deltaX) > gameState.dragThreshold || Math.abs(deltaY) > gameState.dragThreshold) {
        // 移動方向を判定
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            // 横方向の移動が大きい
            gameState.keysPressed['ArrowLeft'] = deltaX < 0;
            gameState.keysPressed['ArrowRight'] = deltaX > 0;
        } else {
            // 縦方向の移動が大きい
            gameState.keysPressed['ArrowUp'] = deltaY < 0;
            gameState.keysPressed['ArrowDown'] = deltaY > 0;
        }
    }
});

window.addEventListener('mouseup', () => {
    if (gameState.isDragging) {
        gameState.isDragging = false;
        // ドラッグ終了時に全ての方向キーをリセット
        gameState.keysPressed['ArrowUp'] = false;
        gameState.keysPressed['ArrowDown'] = false;
        gameState.keysPressed['ArrowLeft'] = false;
        gameState.keysPressed['ArrowRight'] = false;
    }
});

// タッチイベントの処理（モバイル対応）
window.addEventListener('touchstart', (e) => {
    if (!gameState.gameStarted || gameState.isGameOver) return;
    
    // モバイルボタン上でのタッチは無視
    if (e.target.classList.contains('mobile-control') || 
        e.target.closest('.mobile-control')) return;
    
    const touch = e.touches[0];
    gameState.isDragging = true;
    gameState.dragStartX = touch.clientX;
    gameState.dragStartY = touch.clientY;
});

window.addEventListener('touchmove', (e) => {
    if (!gameState.isDragging || !gameState.gameStarted || gameState.isGameOver) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - gameState.dragStartX;
    const deltaY = touch.clientY - gameState.dragStartY;
    
    // ドラッグの移動量が閾値を超えた場合のみ処理
    if (Math.abs(deltaX) > gameState.dragThreshold || Math.abs(deltaY) > gameState.dragThreshold) {
        // 移動方向を判定
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            // 横方向の移動が大きい
            gameState.keysPressed['ArrowLeft'] = deltaX < 0;
            gameState.keysPressed['ArrowRight'] = deltaX > 0;
        } else {
            // 縦方向の移動が大きい
            gameState.keysPressed['ArrowUp'] = deltaY < 0;
            gameState.keysPressed['ArrowDown'] = deltaY > 0;
        }
    }
});

window.addEventListener('touchend', () => {
    if (gameState.isDragging) {
        gameState.isDragging = false;
        // ドラッグ終了時に全ての方向キーをリセット
        gameState.keysPressed['ArrowUp'] = false;
        gameState.keysPressed['ArrowDown'] = false;
        gameState.keysPressed['ArrowLeft'] = false;
        gameState.keysPressed['ArrowRight'] = false;
    }
});

// ウィンドウリサイズ時の処理
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    GLContext.resize(window.innerWidth, window.innerHeight);
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
    
    // 地形の高さに合わせてプレイヤーのY座標を更新（ジャンプ等が無い現仕様）
    if (gameState.chunkManager) {
        const terrainY = gameState.chunkManager.getHeightAtPosition(
            gameState.playerPosition.x,
            gameState.playerPosition.z
        );
        // 直接追従（必要ならスムージングに変更可）
            // 少し地面から浮かせて潜りを防ぐ
            gameState.playerPosition.y = terrainY + 0.05;
    } else {
        gameState.playerPosition.y = gameState.groundLevel;
    }

    // 攻撃処理（Fキー）
    if ((gameState.keysPressed['f'] || gameState.keysPressed['F']) && gameState.beamCooldown <= 0) {
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
        
        // ビームが発射されたフラグ
        gameState.beamFired = true;
        
        // キーを押下状態から解除（連続発射を防ぐ）
        gameState.keysPressed['f'] = false;
        gameState.keysPressed['F'] = false;
    }
    
    // ローリング処理（Rキー）
    if ((gameState.keysPressed['r'] || gameState.keysPressed['R']) && !isRollingAnimationPlaying && !gameState.isRolling && gameState.rollingCooldown <= 0 && playerAnimations['rolling'] && gameState.playerModel) {
        // 実行前のプレイヤー位置と回転を保存
        const originalPosition = gameState.playerPosition.clone();
        const originalRotation = gameState.playerRotation;
        
        // 移動方向を計算
        const forwardX = Math.sin(gameState.playerRotation);
        const forwardZ = Math.cos(gameState.playerRotation);
        
        // ローリング開始位置を設定（現在の位置から開始）
        gameState.rollingStartPosition = originalPosition.clone();
        
        // 既存のアニメーションを停止
        if (currentAnimation && typeof currentAnimation.stop === 'function') {
            currentAnimation.stop();
        }
        
        // 走りモデルを非表示にする
        gameState.playerModel.visible = false;
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
        
        // アニメーションの途中から開始（ジャンプの部分をスキップ）
        const clipDuration = currentAnimation.getClip().duration;
        currentAnimation.time = clipDuration * 0.3; // アニメーションの30%地点から開始
        currentAnimation.play();
        
        // ローリング状態を設定
        isRollingAnimationPlaying = true;
        gameState.isRolling = true;
        gameState.rollingCooldown = 15; // クールダウン設定（短縮）
        
        // ローリング音を再生（foot.mp3）
        if (gameState.sounds.footstep && gameState.sounds.footstep.buffer) {
            if (gameState.sounds.footstep.isPlaying) {
                gameState.sounds.footstep.stop();
            }
            gameState.sounds.footstep.setVolume(0.8);
            gameState.sounds.footstep.play();
        }
        
        // キーを押下状態から解除（連続発射を防ぐ）
        gameState.keysPressed['r'] = false;
        gameState.keysPressed['R'] = false;
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
    
    // チャンクマネージャーの更新（ゲーム開始後のみ）
    if (gameState.gameStarted && gameState.chunkManager) {
        gameState.chunkManager.updateChunks(gameState.playerPosition);
    }

    // GLSLライトニングシステムの更新
    glslLightningSystem.update(delta);

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

    // GrassField の更新（風アニメーション）
    if (grassField && typeof grassField.update === 'function') {
        grassField.update(clock.elapsedTime);
    }

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
        
        // ドラゴンの雷エフェクト生成フラグが立っていれば予兆球体を生成
        if (gameState.shouldCreateDragonLightning) {
            // 予兆球体を生成
            if (gameState.dragonPosition && gameState.dragonLightningTarget && !gameState.lightningOrbActive) {
                const playerPos = gameState.playerPosition;
                const targetPos = [gameState.dragonLightningTarget.x, gameState.dragonLightningTarget.y, gameState.dragonLightningTarget.z];
                
                // ドラゴンの近くに予兆球体を配置
                const dragonPos = gameState.dragonPosition;
                const orbPos = [
                    dragonPos.x + (Math.random() - 0.5) * 5, // ドラゴンの周囲5単位範囲
                    dragonPos.y + (Math.random() - 0.5) * 3, // ドラゴンと同じ高度の周囲3単位範囲
                    dragonPos.z + (Math.random() - 0.5) * 5
                ];
                
                // 予兆球体を作成
                createLightningOrb(orbPos, targetPos);
                
                // 予兆球体の状態を設定
                gameState.lightningOrbActive = true;
                gameState.lightningOrbPosition = orbPos;
                gameState.lightningOrbTarget = targetPos;
                gameState.lightningOrbTimer = gameState.lightningOrbDuration;
            }
            // フラグをリセット
            gameState.shouldCreateDragonLightning = false;
        }
        
        // 電気粒子のタイマー処理
        if (gameState.lightningOrbActive && gameState.lightningOrbTimer > 0) {
            gameState.lightningOrbTimer--;
            
            // 粒子エフェクトの強度調整（時間が経つにつれて強くなる）
            if (gameState.lightningOrbMesh && gameState.lightningOrbMesh.material) {
                const timeProgress = 1.0 - (gameState.lightningOrbTimer / gameState.lightningOrbDuration);
                const intensity = 0.5 + timeProgress * 1.5; // 0.5から2.0まで増加
                
                // 粒子の集中度を時間とともに高める
                const positions = gameState.lightningOrbMesh.geometry.attributes.position.array;
                const dragonPos = gameState.dragonPosition;
                
                for (let i = 0; i < positions.length; i += 3) {
                    // ドラゴンの左側上空に向かって徐々に収束
                    const targetX = dragonPos.x - 5; // ドラゴンの左側
                    const targetY = dragonPos.y + 8; // より高い位置
                    positions[i] += (targetX - positions[i]) * 0.01 * timeProgress;
                    positions[i + 1] += (targetY - positions[i + 1]) * 0.01 * timeProgress;
                    positions[i + 2] += (dragonPos.z - positions[i + 2]) * 0.01 * timeProgress;
                }
                
                gameState.lightningOrbMesh.geometry.attributes.position.needsUpdate = true;
            }
            
            // タイマーが終了したら雷を発射
            if (gameState.lightningOrbTimer <= 0) {
                fireLightningFromOrb();
            }
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
                createHealingParticles(gameState, scene);
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
        
        // 騎士専用ライトを追従
        knightLight.position.set(
            gameState.playerPosition.x,
            gameState.playerPosition.y + 5,
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
    
    // GLSLライトニングシステムの更新とレンダリング
    if (glslLightningSystem) {
        // 雷のアニメーション更新
        glslLightningSystem.update();
        
        // GLコンテキストをクリア（透明で）
        GLContext.clear(0, 0, 0, 0);
        
        const projectionMatrix = camera.projectionMatrix.toArray();
        const viewMatrix = camera.matrixWorldInverse.toArray();
        
        glslLightningSystem.render(projectionMatrix, viewMatrix);
    }
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
    // console.log('回復パーティクル生成位置:', playerPos.x, playerPos.y, playerPos.z);
    
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
    // console.log('ヒーリングパーティクル作成完了:', particles);
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
        // console.log('ローディング中のため、ゲーム画面表示を待機中...');
        return;
    }
    
    // すでにゲームが開始されている場合は何もしない
    if (gameState.gameStarted) {
        // console.log('ゲームはすでに開始されています');
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
        // 再生中の場合のみpause()を呼び出し
        if (!introVideo.paused) {
            introVideo.pause();
        }
        introVideo.currentTime = 0; // ビデオを最初に巻き戻し
    }
    
    // 3Dキャンバスを表示
    renderer.domElement.style.display = 'block';
    
    // UIを表示
    const infoElement = document.getElementById('info');
    if (infoElement) {
        infoElement.style.opacity = '1';
    }
    
    // モバイルデバイスの場合、ジョイスティックとアクションボタンを表示
    if (window.innerWidth <= 968) {
        const mobileJoystick = document.getElementById('mobileJoystick');
        if (mobileJoystick) {
            mobileJoystick.style.display = 'block';
        }
        
        const mobileActionButtons = document.getElementById('mobileActionButtons');
        if (mobileActionButtons) {
            mobileActionButtons.style.display = 'flex';
        }
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

// ローディング進行状況を更新する関数（旧システム - 無効化）
function updateLoadingProgress(message) {
    // 新しいAssetLoaderシステムを使用するため、この関数は何もしない
    // console.log(`Legacy loading message: ${message}`);
}

// プログレスバーを更新する関数（旧システム - 無効化）
function updateProgressBar() {
    // 新しいAssetLoaderシステムを使用するため、この関数は何もしない
}

// ローディング完了時にスタートボタンを表示する関数
function onLoadingComplete() {
    // console.log('ローディング完了');
    
    // 音声はすでに初期化済み
    
    // プログレスバーとパーセンテージを非表示
    const progressContainer = document.getElementById('progressContainer');
    const progressText = document.getElementById('progressText');
    const mobileProgressText = document.getElementById('mobileProgressText');
    const loadingText = document.getElementById('loadingText');
    const loadingTextContainer = document.getElementById('loadingTextContainer');
    
    if (progressContainer) {
        progressContainer.style.display = 'none';
    }
    
    if (progressText) {
        progressText.style.display = 'none';
    }
    
    if (mobileProgressText) {
        mobileProgressText.style.display = 'none';
    }
    
    if (loadingText) {
        loadingText.style.display = 'none';
    }
    
    if (loadingTextContainer) {
        loadingTextContainer.style.display = 'none';
    }
    
    // STARTボタンを表示・有効化
    const startButton = document.getElementById('startButton');
    
    if (startButton) {
        startButton.style.display = 'block';
        startButton.disabled = false;
        startButton.textContent = 'START';
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
    
    // モバイルコントロールの初期化
    initializeMobileControls();
    
    // 初期状態でローディング中を表示
    if (loadingText) {
        loadingText.textContent = 'Loading assets...';
    }
    
    // プログレスバーの初期化
    gameState.loadedAssets = 0;
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const mobileProgressText = document.getElementById('mobileProgressText');
    
    if (progressBar) {
        progressBar.style.width = '0%';
    }
    if (progressText) {
        progressText.textContent = '0%';
    }
    if (mobileProgressText) {
        mobileProgressText.textContent = '0%';
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
                // 再生が既に停止している場合の追加チェック
                if (!introVideo.paused) {
                    introVideo.pause();
                }
                if (!gameState.gameStarted) {
                    showGameScreen();
                }
            });
            
            // ビデオをクリックしてスキップ可能
            introVideo.addEventListener('click', function() {
                // console.log('ビデオスキップ');
                // 再生中の場合のみpause()を呼び出し
                if (!introVideo.paused) {
                    introVideo.pause();
                }
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
            
            // ボタンクリック音を再生
            // console.log('Startボタンがクリックされました');
            // console.log('ボタンクリック音の状態:', {
            //     hasButtonClick: !!(gameState.sounds && gameState.sounds.buttonClick),
            //     hasBuffer: !!(gameState.sounds && gameState.sounds.buttonClick && gameState.sounds.buttonClick.buffer),
            //     isMuted: gameState.isMuted
            // });
            playButtonClickSound(gameState);
            
            // ボタンを無効化して重複クリックを防止
            startButton.disabled = true;
            startButton.textContent = 'Loading...';
            
            // 動画の準備と再生を開始
            gameState.videoPlaying = true;
            
            // ミュート状態を動画にも適用
            introVideo.muted = gameState.isMuted;
                
            // ビデオイベントを設定
            setupVideoEvents();
            
            // ビデオの準備ができるまで待つ
            if (introVideo.readyState >= 2) { // HAVE_CURRENT_DATA以上
                // すぐに再生開始
                playVideoSafely();
            } else {
                // データの読み込みを待つ
                introVideo.addEventListener('canplay', playVideoSafely, { once: true });
                introVideo.load(); // 動画を再読み込み
            }
            
            function playVideoSafely() {
                // 既にゲームが開始されている場合は再生しない
                if (gameState.gameStarted || !gameState.videoPlaying) return;
                
                introVideo.play().then(() => {
                    // 動画再生開始成功時にスタート画面を非表示
                    startScreen.style.display = 'none';
                    introVideo.style.display = 'block';
                    // console.log('ビデオ再生開始成功');
                }).catch((error) => {
                    console.error('ビデオ再生エラー:', error);
                    // ビデオ再生に失敗した場合は直接ゲーム開始
                    gameState.videoPlaying = false;
                    if (!gameState.gameStarted) {
                        showGameScreen();
                    }
                });
            }
        });
    }
});
