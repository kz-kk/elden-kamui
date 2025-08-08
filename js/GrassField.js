
// GrassField.js (ES Module)
// Three.js r137+
// Usage:
// import { createGrassField } from './GrassField.js';
// const { mesh, update } = createGrassField({ textureUrl: 'grass_blade.png' });
// scene.add(mesh);
// in render loop: update(elapsedSeconds);

import * as THREE from 'three';

export function createGrassField(opts = {}) {
  const {
    count = 60000,
    areaSize = 180,
    bladeWidth = 0.10,
    bladeHeight = 0.6,
    alphaTest = 0.5,
    textureUrl = 'grass_blade.png',
    wind = new THREE.Vector2(1.0, 0.35),
    noiseScale = 0.5,
    swayAmplitude = 0.09,
    castShadow = true,
    // 追加: 各(x,z)のワールド座標に対する地形の高さを返す関数（任意）
    // 例: (x,z) => chunkManager.getHeightAtPosition(x, z)
    heightAt = null,
    // 追加: 高さのベースオフセット（任意）
    baseY = 0,
  } = opts;

  const segY = 3;
  const geo = new THREE.PlaneGeometry(bladeWidth, bladeHeight, 1, segY);
  geo.translate(0, bladeHeight * 0.5, 0);

  const loader = new THREE.TextureLoader();
  const map = loader.load(textureUrl);
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  map.anisotropy = 8;
  map.encoding = THREE.sRGBEncoding;

  const mat = new THREE.MeshStandardMaterial({
    map,
    alphaTest,
    transparent: false,
    side: THREE.DoubleSide,
    roughness: 1.0,
    metalness: 0.0,
    color: new THREE.Color(0xdddddd),
    emissive: new THREE.Color(0x000000),
    depthWrite: true,
    depthTest: true,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uWind = { value: wind };
    shader.uniforms.uNoiseScale = { value: noiseScale };
    shader.uniforms.uAmp = { value: swayAmplitude };
    shader.uniforms.uBladeH = { value: bladeHeight };

    const prepend = `
      uniform float uTime;
      uniform vec2 uWind;
      uniform float uNoiseScale;
      uniform float uAmp;
      uniform float uBladeH;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i=floor(p), f=fract(p);
        float a=hash(i), b=hash(i+vec2(1.,0.)), c=hash(i+vec2(0.,1.)), d=hash(i+vec2(1.,1.));
        vec2 u=f*f*(3.-2.*f);
        return mix(a,b,u.x) + (c-a)*u.y*(1.-u.x) + (d-b)*u.x*u.y;
      }
    `;

    shader.vertexShader = prepend + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
        #include <begin_vertex>
        vec4 iOrigin = instanceMatrix * vec4(0., 0., 0., 1.);
        float t = uTime * 0.9;
        vec2 W = normalize(uWind);
        float n = noise(iOrigin.xz * 0.15 + W * t) * 2.0 - 1.0;
        float sway = (sin(t + iOrigin.x*0.2 + iOrigin.z*0.3) * 0.5 + 0.5) + n * uNoiseScale;

        float h = position.y;
        float weight = smoothstep(0.0, 1.0, h / uBladeH);

        transformed.xz += W * sway * weight * uAmp;
      `
    );
    mat.userData.shader = shader;
  };

  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  // 広範囲のインスタンスで誤ったフラスタムカリングを防ぐ
  mesh.frustumCulled = false;

  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * areaSize;
    const z = (Math.random() - 0.5) * areaSize;
    const rotY = Math.random() * Math.PI * 2;
    const scaleY = 0.7 + Math.random() * 0.6;

    const y = typeof heightAt === 'function' ? (heightAt(x, z) + baseY) : baseY;
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, rotY, 0);
    dummy.scale.set(1.0, scaleY, 1.0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;

  function update(elapsedSec) {
    if (mat.userData.shader) {
      mat.userData.shader.uniforms.uTime.value = elapsedSec;
    }
  }

  return { mesh, update };
}
