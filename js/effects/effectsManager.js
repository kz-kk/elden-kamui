/**
 * エフェクト管理モジュール
 * 様々なエフェクトの更新を一元管理します
 */
import { updateFogEffects } from './fogEffect.js';
import { updateDragonFlameEffects, updateBeamEffects } from './particles/index.js';
import { updateGrassWind } from '../environment.js';
import { createParticleColumn } from './particles/particleColumnEffect.js';

/**
 * 全てのエフェクトを更新する関数
 * @param {Object} gameState - ゲームの状態オブジェクト
 * @param {THREE.Scene} scene - Three.jsのシーンオブジェクト
 */
export function updateAllEffects(gameState, scene) {
    // 炎エフェクトのクールダウンを更新
    if (gameState.flameCooldown > 0) {
        gameState.flameCooldown--;
    }
    
    // ビームエフェクトのクールダウンを更新
    if (gameState.beamCooldown > 0) {
        gameState.beamCooldown--;
    }
    
    // 煙エフェクト生成タイマーを更新
    if (gameState.dustSpawnTimer > 0) {
        gameState.dustSpawnTimer--;
    }
    
    // 草の揺れを更新
    updateGrassWind(gameState);
    
    // 各炎エフェクトを更新
    for (let i = gameState.flameEffects.length - 1; i >= 0; i--) {
        const flame = gameState.flameEffects[i];
        
        // パーティクル位置を更新
        flame.updatePositions();
        
        // エフェクトの寿命が切れたら削除
        if (flame.currentLife >= flame.lifetime) {
            scene.remove(flame.particles);
            flame.geometry.dispose();
            flame.material.dispose();
            gameState.flameEffects.splice(i, 1);
            // console.log("炎エフェクト消滅");
        }
    }
    
    // 各地面の炎エフェクトを更新
    for (let i = gameState.groundFireEffects.length - 1; i >= 0; i--) {
        const groundFire = gameState.groundFireEffects[i];
        
        // パーティクル位置を更新
        groundFire.updatePositions();
        
        // エフェクトの寿命が切れたら削除
        if (groundFire.currentLife >= groundFire.lifetime) {
            scene.remove(groundFire.particles);
            groundFire.geometry.dispose();
            groundFire.material.dispose();
            gameState.groundFireEffects.splice(i, 1);
            // console.log("地面の炎エフェクト消滅");
        }
    }
    
    // 各煙エフェクトを更新
    for (let i = gameState.dustEffects.length - 1; i >= 0; i--) {
        const dust = gameState.dustEffects[i];
        
        // パーティクル位置を更新
        dust.updatePositions();
        
        // エフェクトの寿命が切れたら削除
        if (dust.currentLife >= dust.lifetime) {
            scene.remove(dust.particles);
            dust.geometry.dispose();
            dust.material.dispose();
            gameState.dustEffects.splice(i, 1);
        }
    }
    
    // ドラゴンの炎エフェクトを更新
    updateDragonFlameEffects(gameState, scene);
    
    // ビームエフェクトを更新
    updateBeamEffects(gameState, scene);
    
    // 霧エフェクトの更新
    updateFogEffects(gameState, scene);

    // 粒子の柱エフェクトの生成タイミング管理
    gameState.columnSpawnTimer++;
    if (gameState.columnSpawnTimer > gameState.columnSpawnInterval) {
        createParticleColumn(gameState, scene);
        gameState.columnSpawnTimer = 0;
    }

    // 粒子の柱エフェクトを更新
    for (let i = gameState.particleColumnEffects.length - 1; i >= 0; i--) {
        const column = gameState.particleColumnEffects[i];
        const isAlive = column.updatePositions();
        
        if (!isAlive) {
            // エフェクトの寿命が尽きたら削除
            scene.remove(column.particles);
            column.geometry.dispose();
            column.material.dispose();
            gameState.particleColumnEffects.splice(i, 1);
            // console.log("粒子の柱エフェクト消滅");
        }
    }

    // 黄色いパーティクルエフェクトを更新
    for (let i = gameState.yellowParticleEffects.length - 1; i >= 0; i--) {
        const yellowEffect = gameState.yellowParticleEffects[i];
        
        // パーティクル位置を更新
        if (yellowEffect.updatePositions) {
            yellowEffect.updatePositions();
        }
    }
} 