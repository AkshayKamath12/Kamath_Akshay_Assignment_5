import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { MathUtils, Vector3 } from 'three';

//CONSTANTS

const size = 500; //terrain size
const resolution = 128; //terrain resolution

const shedX = 20;
const shedZ = -60;
const shedRadius = 100;

const dragonX = 100;
const dragonZ = 75;
const dragonRadius = 50;

const mayorX = 35;
const mayorZ = -37;

const birdCount = 12;

var moveSpeed = 10; //default movement speed
const dragonSpeed = 5;
const followSpeed = 4; //for dog companion
const mikeSpeed = 3;
const speed = 7; //for birds

const maxDistance = 6; // Maximum distance the companion can be from the player

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
const loader = new GLTFLoader();
const listener = new THREE.AudioListener();
const clock = new THREE.Clock();
const sound = new THREE.Audio(listener);
const soundListener = createSound();

const terrainGeo = new THREE.PlaneGeometry(size, size, resolution, resolution);

const move = { forward: false, backward: false, left: false, right: false };
const turn = { left: false, right: false };

const rotationSpeed = 0.002; // Mouse look sensitivity
const pitchObject = new THREE.Object3D();
const yawObject = new THREE.Object3D();


//VARIABLES
let npc, mixerMike;
let dragon, mixerDragon;
let companion, mixerCompanion;
let mixerMayor;
let birds = [];
let mixerCampfire;


setUpWorld();
setUpTerrain();
setUpSky();
makeTrees();
makeMike();
makeDragon();
makeCompanion();
makeBirds();
makeMayorReadingModel(mayorX, mayorZ);
makeShed(shedX, shedZ);
makeContentInShed(shedX, shedZ + 5);
setUpYawAndPitch();
addActionsToHTML();
animate();


function setUpYawAndPitch() {
  pitchObject.add(camera);
  yawObject.position.y = 2; // Player eye height
  yawObject.add(pitchObject);
  scene.add(yawObject);
}


function setUpWorld() {
  camera.add(listener);
  camera.position.set(5, 5, 5);
  camera.lookAt(5, 2, -5);

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
}


function setUpTerrain() {
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
}

function getTerrainHeightAt(x, z) {
    const halfSize = size / 2;
    const gridX = ((x + halfSize) / size) * resolution;
    const gridY = ((z + halfSize) / size) * resolution;
    const ix = Math.max(0, Math.min(resolution, Math.round(gridX)));
    const iy = Math.max(0, Math.min(resolution, Math.round(gridY)));
    const idx = iy * (resolution + 1) + ix;
    return terrainGeo.attributes.position.getZ(idx);
}

function setUpSky(){
  const sky = new Sky();
  sky.scale.setScalar( 450000 );

  const phi = MathUtils.degToRad( 90 );
  const theta = MathUtils.degToRad( 180 );
  const sunPosition = new Vector3().setFromSphericalCoords( 1, phi, theta );

  sky.material.uniforms.sunPosition.value = sunPosition;

  scene.add( sky );
}


function makeTrees(){
  loader.load(
    'src/models/tree/Tree.glb',                  
    function (gltf) {
    for (let i = 0; i < 100; i++) {
          const tree = gltf.scene.clone();
          const x = (Math.random() - 0.5) * size;
          const z = (Math.random() - 0.5) * size;
          const distance = Math.sqrt((x - shedX) ** 2 + (z - shedZ) ** 2);
          const distanceToDragon = Math.sqrt((x - dragonX) ** 2 + (z - dragonZ) ** 2);
          if (distance < shedRadius || distanceToDragon < dragonRadius) {
              continue; 
          }          

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
}


function makeMike(){
  loader.load('src/models/mike/Mike.gltf', (gltf) => {
    npc = gltf.scene;
    npc.position.set(0, 0, 0);
    npc.scale.set(1.5, 1.5, 1.5);
    npc.traverse(obj => {
      if (obj.isMesh) obj.castShadow = true;
    });
    npc.castShadow = true;
    npc.receiveShadow = true;
    npc.userData = {};
    npc.userData.npcDirection = new THREE.Vector3();
    npc.userData.directionTimer = 0;
    scene.add(npc);

    mixerMike = new THREE.AnimationMixer(npc);
    const walkAction = mixerMike.clipAction(gltf.animations[0]); 
    walkAction.play();
    addSoundToRobot();
  });
}


function makeDragon() {
  loader.load('src/models/dragon/scene.gltf', (gltf) => {
    dragon = gltf.scene;
    dragon.position.set(dragonX, 0, dragonZ);
    dragon.scale.set(30, 30, 30);
    dragon.traverse(obj => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.material = obj.material.clone();
        obj.material.color.multiplyScalar(1.08); 

      }
    });
    scene.add(dragon);

    const dragonSpot = new THREE.SpotLight(0xffffff, 40, 100, Math.PI / 2.5, 0.7, 1.5);
    dragonSpot.position.set(-50, 100, 50); 
    dragonSpot.target = dragon;
    dragonSpot.castShadow = true;
    dragonSpot.shadow.mapSize.width = 2048;
    dragonSpot.shadow.mapSize.height = 2048;
    dragonSpot.shadow.bias = -0.003;
    scene.add(dragonSpot);
    scene.add(dragonSpot.target);

    mixerDragon = new THREE.AnimationMixer(dragon);
    const flyAction = mixerDragon.clipAction(gltf.animations[0]); 
    flyAction.play();
  });
}


function makeCompanion() {
  loader.load('src/models/dog/dog.gltf', (gltf) => {
    companion = gltf.scene;
    companion.position.set(12, 0, 5);
    companion.scale.set(1, 1, 1);
    scene.add(companion);

    mixerCompanion = new THREE.AnimationMixer(companion);
    const walkAction = mixerCompanion.clipAction(gltf.animations[0]); 
    walkAction.play();
  });
}

function makeMayorReadingModel(x, z) {
    loader.load('src/models/mayor_reading/scene.gltf', (gltf) => {
        const mayor = gltf.scene;
        const terrainHeight = getTerrainHeightAt(x, z);
        mayor.position.set(x, terrainHeight - 0.5, z);
        mayor.scale.set(3, 3, 3);

        mayor.rotation.x = -Math.PI / 16; // Slightly tilt the back of the mayor up due to the uneven terrain
        mayor.traverse(obj => {
            if (obj.isMesh) obj.castShadow = true;
        });
        scene.add(mayor);

        mixerMayor = new THREE.AnimationMixer(mayor);
        const walkAction = mixerMayor.clipAction(gltf.animations[0]); 
        walkAction.play();
    });
}

function makeShed(x, z){
    //make 3 walls
    const wallGeometry = new THREE.BoxGeometry(20, 10, 0.1);
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown color for walls
    const wall1 = new THREE.Mesh(wallGeometry, wallMaterial);
    wall1.position.set(x, 2.5, z); // Back wall
    wall1.castShadow = true;
    wall1.receiveShadow = true;
    scene.add(wall1);

    const wall2 = new THREE.Mesh(wallGeometry, wallMaterial);
    wall2.position.set(x - 10, 2.5, z + 10); // Left wall
    wall2.rotation.y = Math.PI / 2; // Rotate to face the left
    wall2.castShadow = true;
    wall2.receiveShadow = true;
    scene.add(wall2);

    const wall3 = new THREE.Mesh(wallGeometry, wallMaterial);
    wall3.position.set(x + 10, 2.5, z + 10); // Right wall
    wall3.rotation.y = -Math.PI / 2; // Rotate to face the right
    wall3.castShadow = true;
    wall3.receiveShadow = true;
    scene.add(wall3);

    //make roof
    //make two reactangles that meed at the top
    const roofGeometry = new THREE.BoxGeometry(14.14, 0.1, 20);
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown color for roof
    const roof1 = new THREE.Mesh(roofGeometry, roofMaterial);
    roof1.position.set(x-5, 12.5, z+10); // Roof position
    roof1.rotation.z = Math.PI / 4; 
    roof1.castShadow = true;
    roof1.receiveShadow = true;
    scene.add(roof1);

    const roof2 = new THREE.Mesh(roofGeometry, roofMaterial);
    roof2.position.set(x+5, 12.5, z+10); // Roof position
    roof2.rotation.z = -Math.PI / 4;
    roof2.castShadow = true;
    roof2.receiveShadow = true;
    scene.add(roof2);

    const backTriangle = new THREE.Shape();
    backTriangle.moveTo(-10, 0);     
    backTriangle.lineTo(10, 0);       
    backTriangle.lineTo(0, 10);      
    backTriangle.lineTo(-10, 0); 
    const backGeometry = new THREE.ShapeGeometry(backTriangle);
    const backMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown color for back triangle
    const backTriangleMesh = new THREE.Mesh(backGeometry, backMaterial);
    backTriangleMesh.position.set(x, 7.5, z); // Back triangle position
    backTriangleMesh.castShadow = true;
    backTriangleMesh.receiveShadow = true;
    scene.add(backTriangleMesh);
}


function makeContentInShed(x, z) {
    makeCampfire(x, z);
    makeBed(x + 4, z + 8);
    makeBackpack(x + 6, z - 2);
    makeLantern(x + 6, z - 4);
    makeCrate(x - 6, z + 12);
    makePainting(x + 9.9, z + 8);
    makeBookshelf(x - 9, z + 8);
}

function makeCampfire(x, z) {
    loader.load('src/models/campfire/campfire.gltf', (gltf) => {
        const campfire = gltf.scene;
        const terrainHeight = getTerrainHeightAt(x-4, z+1.5);
        campfire.position.set(x - 4, terrainHeight, z + 1.5);
        campfire.scale.set(9, 9, 9);
        campfire.traverse(obj => {
            if (obj.isMesh) obj.castShadow = true;
        });
        scene.add(campfire);

        const fireLight = new THREE.PointLight(0xffa040, 5, 40, 2); // color, intensity, distance, decay
        fireLight.position.set(x - 4, terrainHeight + 6, z + 1.5); // slightly above the fire
        fireLight.castShadow = true;
        scene.add(fireLight);
        
        mixerCampfire = new THREE.AnimationMixer(campfire);
        console.log(gltf.animations);
        const campfireAnimation = mixerCampfire.clipAction(gltf.animations[0]);
        campfireAnimation.play();
        campfireAnimation.setLoop(THREE.LoopRepeat, Infinity);

        
        const campfireSound = new THREE.PositionalAudio(listener);
        const audioLoader = new THREE.AudioLoader();
        audioLoader.load('src/audio/campfire.ogg', (buffer) => {
            campfireSound.setBuffer(buffer);
            campfireSound.setRefDistance(10);
            campfireSound.setLoop(true);
            campfireSound.setVolume(3);
            campfire.add(campfireSound); 
            campfireSound.play();
        });
    });
}

function makeBed(x, z) {
  loader.load('src/models/bed/Bedroll.glb', (gltf) => {
    const bed = gltf.scene;
    const terrainHeight = getTerrainHeightAt(x, z);
    bed.position.set(x, terrainHeight + 0.1, z);
    bed.scale.set(20, 20, 20);
    bed.rotation.y = Math.PI; 
    bed.rotation.x = -Math.PI / 16; // Slightly tilt the back of the bed up due to the uneven terrain
    bed.castShadow = true;
    bed.traverse(obj => {
      if (obj.isMesh) obj.castShadow = true;
    });
    scene.add(bed);
  });
}

function makeBackpack(x, z) {
  loader.load('src/models/backpack/Backpack.glb', (gltf) => {
    const backpack = gltf.scene;
    const terrainHeight = getTerrainHeightAt(x, z);
    backpack.position.set(x, terrainHeight + 4, z);
    backpack.scale.set(2, 2, 2);
    backpack.castShadow = true;
    backpack.traverse(obj => {
      if (obj.isMesh) obj.castShadow = true;
    });
    scene.add(backpack);
  });
}


function makeLantern(x, z) {
  loader.load('src/models/lantern/Lantern.glb', (gltf) => {
    const lantern = gltf.scene;
    const terrainHeight = getTerrainHeightAt(x, z);
    lantern.position.set(x, terrainHeight + 12, z);
    lantern.scale.set(1.5, 1.5, 1.5);
    lantern.castShadow = true;
    lantern.traverse(obj => {
      if (obj.isMesh) obj.castShadow = true;
    });
    scene.add(lantern);

    lantern.traverse(obj => {
      if (obj.isMesh && obj.name.toLowerCase().includes('bulb')) {
        obj.material = obj.material.clone();
        obj.material.emissive = new THREE.Color(0xfff8b0);
        obj.material.emissiveIntensity = 3;
      }
    });

    const lanternLight = new THREE.PointLight(0xfff8b0, 20, 30, 1); 
    lanternLight.position.set(x, terrainHeight + 11, z + 2);
    lanternLight.castShadow = true;
    lanternLight.shadow.mapSize.width = 1024;
    lanternLight.shadow.mapSize.height = 1024;
    lanternLight.shadow.bias = -0.005;
    scene.add(lanternLight);

    const ledgeGeometry = new THREE.BoxGeometry(1, 0.1, 1);
    const ledgeMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const ledge = new THREE.Mesh(ledgeGeometry, ledgeMaterial);
    ledge.position.set(x, terrainHeight + 12.25, z); 
    ledge.castShadow = true;
    ledge.receiveShadow = true;
    scene.add(ledge);
  });
}


function makeCrate(x, z) {
  loader.load('src/models/crate/Crate.glb', (gltf) => {
    const crate = gltf.scene;
    const terrainHeight = getTerrainHeightAt(x, z);
    crate.position.set(x, terrainHeight + 0.5, z);
    crate.scale.set(1, 1, 1);
    crate.castShadow = true;
    crate.traverse(obj => {
      if (obj.isMesh) obj.castShadow = true;
    });
    scene.add(crate);
  });
}


function makePainting(x, z) {
  loader.load('src/models/painting/Painting.glb', (gltf) => {
    const painting = gltf.scene;
    const terrainHeight = getTerrainHeightAt(x, z);
    painting.position.set(x, terrainHeight + 6, z);
    painting.rotation.y = Math.PI / 2;
    painting.scale.set(0.2, 0.2, 0.2);
    painting.castShadow = true;
    painting.traverse(obj => {
      if (obj.isMesh) obj.castShadow = true;
    });
    scene.add(painting);
  });
}


function makeBookshelf(x, z) {
  loader.load('src/models/bookshelf/Bookshelf.glb', (gltf) => {
    const bookshelf = gltf.scene;
    const terrainHeight = getTerrainHeightAt(x, z);
    bookshelf.position.set(x, terrainHeight + 1, z);
    bookshelf.rotation.y = -Math.PI / 2; // Rotate to face the shed
    bookshelf.rotation.x = -Math.PI / 32; // Slightly tilt the top of the bookshelf up due to the uneven terrain
    bookshelf.scale.set(5, 5, 5);
    bookshelf.castShadow = true;
    bookshelf.traverse(obj => {
      if (obj.isMesh) obj.castShadow = true;
    });
    scene.add(bookshelf);
  });
}


function updateCompanion(delta) {
    if (!companion || !yawObject) return;
    const playerPos = yawObject.position.clone();
    const companionPos = companion.position.clone();
    const distance = playerPos.distanceTo(companionPos);
    if (distance > maxDistance) {
        const direction = playerPos.sub(companionPos).normalize();
        companion.position.add(direction.multiplyScalar(followSpeed * delta));
        if (mixerCompanion) {
            mixerCompanion.update(delta);
        }
    } 
    companion.lookAt(yawObject.position.x, companion.position.y, yawObject.position.z);
    companion.rotation.y += Math.PI; // Face the player
    
    const y = getTerrainHeightAt(companion.position.x, companion.position.z) + 1.2;
    companion.position.y = y;
}


function createSound() {
    const audioLoader = new THREE.AudioLoader();
    audioLoader.load('src/audio/music-3.5mins.ogg', (buffer) => {
        sound.setBuffer(buffer);
        sound.setLoop(true);
        sound.setVolume(0.4);
    });

    return sound;
}


function addSoundToRobot(){
    const robotFootsteps = new THREE.PositionalAudio(listener);
    const audioLoader = new THREE.AudioLoader();

    audioLoader.load('src/audio/Footsteps-robot.ogg', (buffer) => {
        robotFootsteps.setBuffer(buffer);
        robotFootsteps.setRefDistance(5);
        robotFootsteps.setLoop(true);
        robotFootsteps.setVolume(2);
        npc.add(robotFootsteps); 
        robotFootsteps.play();
    });
}


function updateNPCMovement(npc, delta, speed) {
    if (!npc) return;

    if (!npc.userData.npcDirection) {
        npc.userData.npcDirection = new THREE.Vector3(
            Math.random() * 2 - 1,
            0,
            Math.random() * 2 - 1
        ).normalize();
    }
    if (npc.userData.directionTimer === undefined) {
        npc.userData.directionTimer = 3 + Math.random() * 2;
    }

    npc.userData.directionTimer -= delta;
    if (npc.userData.directionTimer <= 0) {
        npc.userData.npcDirection.set(
            Math.random() * 2 - 1,
            0,
            Math.random() * 2 - 1
        ).normalize();
        npc.userData.directionTimer = 3 + Math.random() * 2;
    }

    const nextPos = npc.position.clone().add(npc.userData.npcDirection.clone().multiplyScalar(speed * delta));
    const distToShed = Math.sqrt((nextPos.x - shedX) ** 2 + (nextPos.z - shedZ) ** 2);
    if (distToShed < 8) { 
        const away = nextPos.clone().sub(new THREE.Vector3(shedX, nextPos.y, shedZ)).normalize();
        npc.userData.npcDirection.copy(away);
        npc.userData.directionTimer = 1 + Math.random(); 
    }

    const angle = Math.atan2(npc.userData.npcDirection.x, npc.userData.npcDirection.z);
    npc.rotation.y = angle;

    
    npc.position.add(npc.userData.npcDirection.clone().multiplyScalar(speed * delta));

    const y = getTerrainHeightAt(npc.position.x, npc.position.z);
    npc.position.y = y + 1; 
}


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

function makeBirds(){
  loader.load('src/models/hummingbird/Hummingbird.glb', (gltf) => {
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
}


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

    
    bird.position.add(bird.userData.direction.clone().multiplyScalar(speed * delta));

    const dir = bird.userData.direction;
    const angle = Math.atan2(dir.x, dir.z);
    bird.rotation.y = angle;

    if (bird.position.y < 10) bird.position.y = 10;
    if (bird.position.y > 40) bird.position.y = 40;
  }
  
}

function addActionsToHTML(){
  window.addEventListener('click', () => {
      if (soundListener && !soundListener.isPlaying) {
          soundListener.play();
      }
  }, { once: true });

  window.addEventListener('keydown', (e) => {
      if (e.code === 'ShiftLeft') {
          moveSpeed = 20; // Increase speed when holding shift
      }
  });

  window.addEventListener('keyup', (e) => {
      if (e.code === 'ShiftLeft') {
          moveSpeed = 10; // Reset speed when releasing shift
      }
  });

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

  document.body.addEventListener('click', () => {
    document.body.requestPointerLock();
  });

  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === document.body) {
      document.addEventListener('mousemove', onMouseMove, false);
    } else {
      document.removeEventListener('mousemove', onMouseMove, false);
    }
  });
}



function onMouseMove(event) {
  const movementX = event.movementX || 0;
  const movementY = event.movementY || 0;

  yawObject.rotation.y -= movementX * rotationSpeed;
  pitchObject.rotation.x -= movementY * rotationSpeed;

  pitchObject.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitchObject.rotation.x)); // Limit look up/down
}


// handle updates to YAWObject position and camera direction
function updateYAWObject(delta){
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

  const height = getTerrainHeightAt(yawObject.position.x, yawObject.position.z);
  const eyeHeight = 1.5; 

  if (yawObject.position.y < height + eyeHeight) {
    yawObject.position.y = height + eyeHeight;
  }
  if (yawObject.position.y > height + eyeHeight) {
    yawObject.position.y = height + eyeHeight;
  }
}


// Animation loop
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    //update animations for npcs
    if (mixerMike) mixerMike.update(delta); 
    if(mixerCampfire) mixerCampfire.update(delta);
    if(mixerMayor) mixerMayor.update(delta);
    if(mixerDragon) mixerDragon.update(delta);
    if(npc) updateNPCMovement(npc, delta, mikeSpeed);
    if(dragon) updateNPCMovement(dragon, delta, dragonSpeed);
    if(birds) updateBirds(delta);
    if(companion) updateCompanion(delta);

    updateYAWObject(delta);
    
    renderer.render(scene, camera);
}