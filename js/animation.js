// アニメーション関連の機能を実装するモジュール
import * as THREE from 'three';

/**
 * アニメーションの内容を分析する関数
 * @param {THREE.AnimationClip} animation - 分析するアニメーション
 */
export function analyzeAnimation(animation) {
    // console.log("アニメーション分析:", animation.name);
    
    // トラックを確認
    animation.tracks.forEach(track => {
        // console.log("トラック:", track.name);
    });
} 