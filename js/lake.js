// 湖システム（軽量な流体表現付き）
// - 地形側はシェーダーで穴抜き（アルファ）し、水面を下に配置
// - 反射は使わず、頂点波と色ブレンドで流体感を演出（高パフォーマンス）

import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';

const MAX_LAKES = 4; // 同時に扱う湖の最大数（必要なら拡張）

const lakeState = {
  lakes: [], // { center, radius, rimWidth, waterLevel, depth, mesh, uniforms, water }
  time: 0,
  groundMaterialPatched: false,
  groundUniformRefs: null,
};

function createWaterMaterial(baseColor = 0x2e5b73, opacity = 0.85) {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(baseColor),
    roughness: 0.25,
    metalness: 0.0,
    transparent: true,
    opacity,
    depthWrite: true,
  });

  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: 0.05 },
    uFreq1: { value: 0.25 },
    uFreq2: { value: 0.18 },
    uDir1: { value: new THREE.Vector2(0.7, 0.2).normalize() },
    uDir2: { value: new THREE.Vector2(-0.2, 1.0).normalize() },
    uFoam: { value: 0.15 },
  };

  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader) => {
    prev && prev(shader);

    Object.assign(shader.uniforms, uniforms);

    // 頂点波（モデル空間XZベースの2成分サイン波）
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime; 
uniform float uAmp; 
uniform float uFreq1; 
uniform float uFreq2; 
uniform vec2 uDir1; 
uniform vec2 uDir2;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
{
  // model space XZ
  float w1 = sin(dot(vec2(transformed.x, transformed.z), uDir1) * 1.2 + uTime * (0.6 + uFreq1));
  float w2 = cos(dot(vec2(transformed.x * 0.7, transformed.z * 0.9), uDir2) * 1.1 + uTime * (0.5 + uFreq2));
  transformed.y += (w1 * 0.6 + w2 * 0.4) * uAmp;
}`
      );

    // フォーム（縁で少し明るく）
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime; 
uniform float uFoam;`
      )
      .replace(
        '#include <dithering_fragment>',
        `// edge foam-ish brighten
vec2 gUv = gl_FragCoord.xy; // 画面空間だと不安定なので控えめ演出
float foam = uFoam * 0.35; 
gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb + vec3(0.15), foam);
#include <dithering_fragment>`
      );

    material.userData.shader = shader;
  };

  material.userData.uniforms = uniforms;
  return material;
}

// 手軽な法線テクスチャをプロシージャル生成（タイル可能な簡易波）
function createProceduralWaterNormals(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  const img = ctx.createImageData(size, size);
  const data = img.data;

  // 周期波を合成した高さ場 h(x,y)
  const freq1 = 8.0, freq2 = 11.0, freq3 = 5.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2.0;
      const v = (y / size) * Math.PI * 2.0;
      const h = Math.sin(u * freq1 + Math.cos(v)) * 0.5
             + Math.cos(v * freq2 + Math.sin(u * 0.7)) * 0.35
             + Math.sin((u + v) * freq3) * 0.15;

      // 高さ勾配（中心差分）
      const du = 0.001;
      const dv = 0.001;
      const hux = Math.sin((u + du) * freq1 + Math.cos(v)) * 0.5
                + Math.cos(v * freq2 + Math.sin((u + du) * 0.7)) * 0.35
                + Math.sin(((u + du) + v) * freq3) * 0.15;
      const hvy = Math.sin(u * freq1 + Math.cos(v + dv)) * 0.5
                + Math.cos((v + dv) * freq2 + Math.sin(u * 0.7)) * 0.35
                + Math.sin((u + (v + dv)) * freq3) * 0.15;

      const dhdu = (hux - h) / du;
      const dhdv = (hvy - h) / dv;

      // 法線 N = normalize([-dh/dx, 1, -dh/dy])
      const nx = -dhdu;
      const ny = 1.0;
      const nz = -dhdv;
      const invLen = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz + 1e-6);
      const r = (nx * invLen * 0.5 + 0.5) * 255;
      const g = (ny * invLen * 0.5 + 0.5) * 255;
      const b = (nz * invLen * 0.5 + 0.5) * 255;

      const idx = (y * size + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function createLakeMesh({ center, radius, waterLevel }, color, opacity, scene) {
  const segments = Math.max(48, Math.min(128, Math.floor(radius * 1.2)));
  const geo = new THREE.CircleGeometry(radius, segments);

  // 高品質水面（反射・屈折）
  let water = null;
  try {
    const waterNormals = createProceduralWaterNormals(256);
    water = new Water(geo, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals,
      alpha: opacity ?? 0.85,
      sunDirection: new THREE.Vector3(0.25, 1.0, 0.05).normalize(),
      sunColor: 0xf2efe6,
      waterColor: new THREE.Color(color ?? 0x345e6e),
      distortionScale: 1.75,
      fog: !!(scene && scene.fog),
    });
    water.rotation.x = -Math.PI / 2;
    water.position.set(center.x, waterLevel, center.z);
    water.receiveShadow = true;
    const uniforms = water.material && water.material.uniforms ? water.material.uniforms : null;
    return { mesh: water, water, uniforms };
  } catch (e) {
    // フォールバック（低コスト水面）
    const mat = createWaterMaterial(color, opacity);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(center.x, waterLevel, center.z);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    return { mesh, uniforms: mat.userData.uniforms };
  }
}

function patchGroundMaterialAlphaHole(groundMaterial) {
  if (!groundMaterial || lakeState.groundMaterialPatched) return;

  const prev = groundMaterial.onBeforeCompile;
  groundMaterial.onBeforeCompile = (shader) => {
    prev && prev(shader);

    // 湖情報のユニフォーム
    const uniforms = {
      lakeCount: { value: 0 },
      lakeCenters: { value: new Array(MAX_LAKES).fill(0).map(() => new THREE.Vector2()) },
      lakeRadii: { value: new Array(MAX_LAKES).fill(0) },
      lakeRims: { value: new Array(MAX_LAKES).fill(0) },
    };
    Object.assign(shader.uniforms, uniforms);
    lakeState.groundUniformRefs = uniforms; // 後で更新

    // 頂点: ワールド座標をvaryingへ
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWorldPos;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
vWorldPos = worldPosition.xyz;`
      );

    // 断面用: フラグメントでアルファを減衰
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWorldPos;
uniform int lakeCount;
uniform vec2 lakeCenters[${MAX_LAKES}];
uniform float lakeRadii[${MAX_LAKES}];
uniform float lakeRims[${MAX_LAKES}];`
      )
      .replace(
        '#include <dithering_fragment>',
        `// lake alpha hole mask
float lakeMask = 1.0;
for (int i = 0; i < ${MAX_LAKES}; i++) {
  if (i >= lakeCount) break;
  float d = distance(vWorldPos.xz, lakeCenters[i]);
  float a = smoothstep(lakeRadii[i], lakeRadii[i] - max(0.001, lakeRims[i]), d);
  lakeMask = min(lakeMask, a);
}
if (lakeMask < 0.01) discard; // 完全に穴を開ける
gl_FragColor.a *= lakeMask;
#include <dithering_fragment>`
      );

    groundMaterial.transparent = true; // アルファ適用（discard前提）
    groundMaterial.depthWrite = true;
    groundMaterial.userData.shader = shader;
  };

  groundMaterial.needsUpdate = true;
  lakeState.groundMaterialPatched = true;
}

function syncGroundUniformsFromLakes() {
  if (!lakeState.groundUniformRefs) return;
  const u = lakeState.groundUniformRefs;
  const count = Math.min(lakeState.lakes.length, MAX_LAKES);
  u.lakeCount.value = count;
  for (let i = 0; i < MAX_LAKES; i++) {
    if (i < count) {
      const lk = lakeState.lakes[i];
      u.lakeCenters.value[i].set(lk.center.x, lk.center.z);
      u.lakeRadii.value[i] = lk.radius;
      u.lakeRims.value[i] = lk.rimWidth;
    } else {
      u.lakeCenters.value[i].set(0, 0);
      u.lakeRadii.value[i] = 0;
      u.lakeRims.value[i] = 0;
    }
  }
}

export function initLakeSystem(scene, gameState, options = {}) {
  const {
    lakes = [
      // デフォルト1つ（原点やや右前）
      { center: { x: 120, z: -80 }, radius: 90, rimWidth: 18, waterLevel: -5.0, depth: 8, color: 0x2e5b73, opacity: 0.85 },
    ],
  } = options;

  // 湖メッシュ生成
  lakeState.lakes = lakes.map((cfg) => {
    const { center, radius, rimWidth = 15, waterLevel = -5.0, depth = 6, color, opacity } = cfg;
    const { mesh, uniforms, water } = createLakeMesh({ center, radius, waterLevel }, color, opacity, scene);
    scene.add(mesh);
    return { center, radius, rimWidth, waterLevel, depth, mesh, uniforms, water };
  });

  // 地面マテリアル穴抜きの適用（チャンクマネージャの共有マテリアル）
  if (gameState && gameState.chunkManager && gameState.chunkManager.sharedMaterial) {
    patchGroundMaterialAlphaHole(gameState.chunkManager.sharedMaterial);
    syncGroundUniformsFromLakes();
  }

  // 外部から使える判定（スポーン制御用）
  const isPointInLake = (x, z) => {
    for (const lk of lakeState.lakes) {
      const dx = x - lk.center.x;
      const dz = z - lk.center.z;
      if (dx * dx + dz * dz <= lk.radius * lk.radius) return true;
    }
    return false;
  };

  // ゲームステートへ公開
  if (gameState) {
    gameState.isPointInLake = isPointInLake;
  }

  return {
    isPointInLake,
  };
}

export function updateLakeSystem(deltaSeconds = 0.016) {
  lakeState.time += deltaSeconds;
  // 水面の時間更新
  for (const lk of lakeState.lakes) {
    if (!lk) continue;
    // High quality Water（time）
    if (lk.water && lk.water.material && lk.water.material.uniforms && 'time' in lk.water.material.uniforms) {
      lk.water.material.uniforms.time.value += deltaSeconds;
    }
    // Fallback material（uTime）
    if (lk.uniforms && 'uTime' in lk.uniforms) {
      lk.uniforms.uTime.value = lakeState.time;
    }
  }
}

export function isPointInLake(x, z) {
  for (const lk of lakeState.lakes) {
    const dx = x - lk.center.x;
    const dz = z - lk.center.z;
    if (dx * dx + dz * dz <= lk.radius * lk.radius) return true;
  }
  return false;
}


