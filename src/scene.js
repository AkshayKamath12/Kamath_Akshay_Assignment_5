import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { MathUtils, Vector3 } from 'three';
import { AnimationMixer } from 'three';

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 5, 5);
camera.lookAt(5, 2, -5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0x416bdf, 0.5);
scene.add(ambientLight);

const sunLight = new THREE.SpotLight(0xffffff, 0.3, 0, Math.PI / 2);
sunLight.position.set(1000, 2000, 1000);
sunLight.castShadow = true;
sunLight.shadow.bias = -0.0002;
sunLight.shadow.camera.far = 4000;
sunLight.shadow.camera.near = 750;
sunLight.shadow.camera.fov = 30;
scene.add(sunLight);

const sky = new Sky();
sky.scale.setScalar( 450000 );

const phi = MathUtils.degToRad( 90 );
const theta = MathUtils.degToRad( 180 );
const sunPosition = new Vector3().setFromSphericalCoords( 1, phi, theta );

sky.material.uniforms.sunPosition.value = sunPosition;

scene.add( sky );

const controls = new OrbitControls(camera, renderer.domElement);
controls.minPolarAngle = Math.PI/3; // can't look below the horizon
controls.maxPolarAngle = Math.PI / 2; // can't look above the horizon
controls.update();



const loader = new GLTFLoader();

loader.load(
  'src/models/Tree.glb',                  
  function (gltf) {
    /*
    const tree = gltf.scene;
    tree.position.set(5, 3.5, -5);        
    tree.scale.set(2, 2, 2);        
    tree.traverse(obj => {
      if (obj.isMesh) obj.castShadow = true;
    });
    scene.add(tree);
    */
   for (let i = 0; i < 100; i++) {
        const tree = gltf.scene.clone();
        const x = (Math.random() - 0.5) * size;
        const z = (Math.random() - 0.5) * size;
        const height = getTerrainHeightAt(x, z) + 5;
        tree.position.set(x, height, z);
        tree.scale.set(5, 5, 5);
        tree.traverse(obj => {
            if (obj.isMesh) obj.castShadow = true;
        });
        scene.add(tree);
        }
  },
  undefined,
  function (error) {
    console.error('Error loading GLB:', error);
  }
);
let npc, mixer;

loader.load('src/models/Mike.gltf', (gltf) => {
  npc = gltf.scene;
  npc.position.set(0, 0, 0);
  npc.scale.set(1.5, 1.5, 1.5);
  scene.add(npc);

  // Animation
  mixer = new THREE.AnimationMixer(npc);
  const walkAction = mixer.clipAction(gltf.animations[0]); 
  walkAction.play();
});

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

let npcDirection = new THREE.Vector3();
let directionTimer = 0;

function updateNPCMovement(delta) {
    if (!npc) return;

  directionTimer -= delta;
  if (directionTimer <= 0) {
    npcDirection.set(
      Math.random() * 2 - 1,
      0,
      Math.random() * 2 - 1
    ).normalize();
    directionTimer = 3 + Math.random() * 2;

    const angle = Math.atan2(npcDirection.x, npcDirection.z);
    npc.rotation.y = angle;
  }

  const speed = 3;
  npc.position.add(npcDirection.clone().multiplyScalar(speed * delta));

  const y = getTerrainHeightAt(npc.position.x, npc.position.z);
  npc.position.y = y;
}

const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta); 

    const height = getTerrainHeightAt(camera.position.x, camera.position.z);
    updateNPCMovement(delta);
    if (camera.position.y < height+1) {
        camera.position.y = height+1;
    }
    renderer.render(scene, camera);
}
animate();