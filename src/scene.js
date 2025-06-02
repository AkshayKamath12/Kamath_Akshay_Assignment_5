import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { MathUtils, Vector3 } from 'three';

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
        const height = getTerrainHeightAt(x, z) + 5.5;
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
  addSoundToRobot();
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

const listener = new THREE.AudioListener();
camera.add(listener);
function createSound() {
    const sound = new THREE.Audio(listener);
    const audioLoader = new THREE.AudioLoader();
    audioLoader.load('src/audio/music-3.5mins.ogg', (buffer) => {
        sound.setBuffer(buffer);
        sound.setLoop(true);
        sound.setVolume(0.5);
    });

    return sound;
}
const sound = createSound();

function addSoundToRobot(){
    const robotFootsteps = new THREE.PositionalAudio(listener);
    const audioLoader = new THREE.AudioLoader();

    audioLoader.load('src/audio/Footsteps-robot.ogg', (buffer) => {
        robotFootsteps.setBuffer(buffer);
        robotFootsteps.setRefDistance(5);
        robotFootsteps.setLoop(true);
        robotFootsteps.setVolume(1.2);
        npc.add(robotFootsteps); 
        robotFootsteps.play();
    });
}


window.addEventListener('click', () => {
    if (sound && !sound.isPlaying) {
        sound.play();
    }
}, { once: true });

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

const birds = [];
const birdCount = 12;

function addBirdSound(bird) {
    const birdSound = new THREE.PositionalAudio(listener);
    const audioLoader = new THREE.AudioLoader();

    audioLoader.load('src/audio/birdSound.ogg', (buffer) => {
        birdSound.setBuffer(buffer);
        birdSound.setRefDistance(10);
        birdSound.setLoop(true);
        birdSound.setVolume(0.02);
        bird.add(birdSound); 
        birdSound.play();
    });
}


loader.load('src/models/Hummingbird.glb', (gltf) => {
    console.log(gltf.animations);

    const gridSize = Math.ceil(Math.sqrt(birdCount));
    const spacing = size / gridSize;

    let birdIndex = 0;
    for (let gx = 0; gx < gridSize && birdIndex < birdCount; gx++) {
        for (let gz = 0; gz < gridSize && birdIndex < birdCount; gz++) {
            const x = -size / 2 + (gx + 0.5) * spacing + (Math.random() - 0.5) * spacing * 0.3;
            const z = -size / 2 + (gz + 0.5) * spacing + (Math.random() - 0.5) * spacing * 0.3;
            const y = getTerrainHeightAt(x, z) + 35;

            const bird = gltf.scene.clone(true);
            bird.position.set(x, y, z);
            bird.scale.set(0.03, 0.03, 0.03);

            bird.userData.direction = new THREE.Vector3(
                Math.random() * 2 - 1,
                Math.random() * 0.2 - 0.1,
                Math.random() * 2 - 1
            ).normalize();

            bird.userData.timer = 0;
            addBirdSound(bird);
            scene.add(bird);
            birds.push(bird);

            birdIndex++;
        }
    }
});


function updateBirds(delta) {
    for (const bird of birds) {
    bird.userData.timer -= delta;

    if (bird.userData.timer <= 0) {
      // Choose a new flight direction
      bird.userData.direction.set(
        Math.random() * 2 - 1,
        Math.random() * 0.4 - 0.2,
        Math.random() * 2 - 1
      ).normalize();
      bird.userData.timer = 3 + Math.random() * 3;
    }

    const speed = 7;
    bird.position.add(bird.userData.direction.clone().multiplyScalar(speed * delta));

    const dir = bird.userData.direction;
    const angle = Math.atan2(dir.x, dir.z);
    bird.rotation.y = angle;

    if (bird.position.y < 10) bird.position.y = 10;
    if (bird.position.y > 40) bird.position.y = 40;
  }
  
}

const move = { forward: false, backward: false, left: false, right: false };
const turn = { left: false, right: false };

const moveSpeed = 10;

window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyW') move.forward = true;
    if (e.code === 'KeyS') move.backward = true;
    if (e.code === 'KeyA') move.left = true;
    if (e.code === 'KeyD') move.right = true;
});
window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') move.forward = false;
    if (e.code === 'KeyS') move.backward = false;
    if (e.code === 'KeyA') move.left = false;
    if (e.code === 'KeyD') move.right = false;
});

//turning
window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft') turn.left = true;
    if (e.code === 'ArrowRight') turn.right = true;
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft') turn.left = false;
    if (e.code === 'ArrowRight') turn.right = false;
});

let pitchObject = new THREE.Object3D();
pitchObject.add(camera);

let yawObject = new THREE.Object3D();
yawObject.position.y = 2; // Player eye height
yawObject.add(pitchObject);
scene.add(yawObject);

document.body.addEventListener('click', () => {
  document.body.requestPointerLock();
});

let rotationSpeed = 0.002;

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === document.body) {
    document.addEventListener('mousemove', onMouseMove, false);
  } else {
    document.removeEventListener('mousemove', onMouseMove, false);
  }
});

function onMouseMove(event) {
  const movementX = event.movementX || 0;
  const movementY = event.movementY || 0;

  yawObject.rotation.y -= movementX * rotationSpeed;
  pitchObject.rotation.x -= movementY * rotationSpeed;

  pitchObject.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitchObject.rotation.x)); // Limit look up/down
}


const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta); 
    updateNPCMovement(delta);
    updateBirds(delta);


    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(dir, yawObject.up).normalize();

    if (move.forward) {
    yawObject.position.addScaledVector(dir, moveSpeed * delta);
    }
    if (move.backward) {
    yawObject.position.addScaledVector(dir, -moveSpeed * delta);
    }
    if (move.left) {
    yawObject.position.addScaledVector(right, -moveSpeed * delta);
    }
    if (move.right) {
    yawObject.position.addScaledVector(right, moveSpeed * delta);
    }

    if (turn.left || turn.right) {
        const offset = new THREE.Vector3();
        offset.subVectors(controls.target, camera.position);

        const angle = (turn.left ? 1 : 0) * 0.05 - (turn.right ? 1 : 0) * 0.05;

        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);

        controls.target.copy(camera.position).add(offset);
        controls.update();
    }    

    const height = getTerrainHeightAt(yawObject.position.x, yawObject.position.z);
    const eyeHeight = 0.1; 

    if (yawObject.position.y < height + eyeHeight) {
        yawObject.position.y = height + eyeHeight;
    }
    if (yawObject.position.y > height + eyeHeight) {
        yawObject.position.y = height + eyeHeight;
    }
    renderer.render(scene, camera);
}
animate();