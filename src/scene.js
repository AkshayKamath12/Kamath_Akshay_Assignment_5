import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 5, 5);
camera.lookAt(5, 2, -5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0x416bdf, 0.5);
scene.add(ambientLight);

const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.set(20, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

const controls = new OrbitControls(camera, renderer.domElement);
controls.minPolarAngle = Math.PI/3; // can't look below the horizon
controls.maxPolarAngle = Math.PI / 2; // can't look above the horizon
controls.update();



const loader = new GLTFLoader();

loader.load(
  'src/models/Tree.glb',                  
  function (gltf) {
    const tree = gltf.scene;
    tree.position.set(5, 3.5, -5);        
    tree.scale.set(2, 2, 2);        
    tree.traverse(obj => {
      if (obj.isMesh) obj.castShadow = true;
    });
    scene.add(tree);
  },
  undefined,
  function (error) {
    console.error('Error loading GLB:', error);
  }
);

const size = 500;
const resolution = 128;
const terrainGeo = new THREE.PlaneGeometry(size, size, resolution, resolution);

for (let i = 0; i < terrainGeo.attributes.position.count; i++) {
  const x = terrainGeo.attributes.position.getX(i);
  const y = terrainGeo.attributes.position.getY(i);
  const z = Math.sin(x * 0.05) * Math.cos(y * 0.05) * 5;
  terrainGeo.attributes.position.setZ(i, z);
}

terrainGeo.computeVertexNormals(); 

// Load a repeating grass texture
const textureLoader = new THREE.TextureLoader();
const grassTexture = textureLoader.load('src/textures/grass.jpg');
grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
grassTexture.repeat.set(64, 64); // tile across terrain


const terrainMat = new THREE.MeshStandardMaterial({
  map: grassTexture,
});
const terrain = new THREE.Mesh(terrainGeo, terrainMat);
terrain.rotation.x = -Math.PI / 2;
terrain.receiveShadow = true;
scene.add(terrain);

function getTerrainHeightAt(x, z) {
    const halfSize = size / 2;
    const gridX = ((x + halfSize) / size) * resolution;
    const gridY = ((z + halfSize) / size) * resolution;
    const ix = Math.max(0, Math.min(resolution, Math.round(gridX)));
    const iy = Math.max(0, Math.min(resolution, Math.round(gridY)));
    const idx = iy * (resolution + 1) + ix;
    return terrainGeo.attributes.position.getZ(idx);
}

function animate() {
    requestAnimationFrame(animate);
    const height = getTerrainHeightAt(camera.position.x, camera.position.z);
    if (camera.position.y < height+1) {
        camera.position.y = height+1;
    }
    renderer.render(scene, camera);
}
animate();