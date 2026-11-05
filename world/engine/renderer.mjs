import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function detectQuality(param) {
  if (param === 'low' || param === 'high') return param;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const memory = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 8;
  return coarse || memory <= 4 || cores <= 4 ? 'low' : 'high';
}

export function createRenderer(canvas, quality) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.75 : 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = quality !== 'low';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

export function createStage(renderer, { background = '#c9d2d8', fog = ['#aeb3b6', 55, 210], environment = 0.5, far = 420 } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  if (fog) scene.fog = new THREE.Fog(...fog);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = environment;
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(68, 1, 0.05, far);
  return { scene, camera };
}

export function fitRenderer(renderer, camera, element) {
  const w = element.clientWidth || window.innerWidth;
  const h = element.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 78 : 68;
  camera.updateProjectionMatrix();
}
