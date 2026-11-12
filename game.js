import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.181.1/build/three.module.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080b12);
scene.fog = new THREE.Fog(0x080b12, 18, 75);

const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, .1, 150);
camera.position.set(0,1.7,8);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0x9bbcff,0x202020,1.7));
const sun = new THREE.DirectionalLight(0xffffff,2.2);
sun.position.set(10,18,5); sun.castShadow=true; scene.add(sun);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(100,100),
  new THREE.MeshStandardMaterial({color:0x20252d,roughness:.9})
);
floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);

const grid = new THREE.GridHelper(100,100,0x47515e,0x2a3038);
grid.position.y=.01; scene.add(grid);

const obstacles=[];
function box(x,y,z,sx,sy,sz,color=0x303846){
  const m=new THREE.Mesh(
    new THREE.BoxGeometry(sx,sy,sz),
    new THREE.MeshStandardMaterial({color,roughness:.8})
  );
  m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true;
  scene.add(m); obstacles.push(m); return m;
}
box(0,2,-18,34,4,1);
box(-17,2,0,1,4,36);
box(17,2,0,1,4,36);
box(0,2,18,34,4,1);
box(-7,1.5,-5,7,3,3,0x3a4352);
box(8,2,2,4,4,4,0x3a4352);
box(-5,1,10,5,2,5,0x3a4352);
box(10,1,-10,5,2,5,0x3a4352);

const enemies=[];
let health=100, ammo=30, score=0;
let shootCooldown=0, spawnTimer=0;
const keys={};
let autoShoot=false;

const enemyGeo=new THREE.BoxGeometry(1.1,1.8,1.1);
const enemyMat=new THREE.MeshStandardMaterial({color:0xd83b3b});
function spawnEnemy(){
  const spots=[[-12, -13],[12,-13],[-12,8],[12,10],[0,-13],[-10,2],[10,-4]];
  const p=spots[Math.floor(Math.random()*spots.length)];
  const e=new THREE.Mesh(enemyGeo,enemyMat.clone());
  e.position.set(p[0],.9,p[1]);
  e.castShadow=true;
  e.userData={hp:2,hitFlash:0};
  scene.add(e); enemies.push(e);
}
for(let i=0;i<5;i++) spawnEnemy();

let yaw=0,pitch=0;
const clock=new THREE.Clock();
const raycaster=new THREE.Raycaster();

const settings=document.getElementById('settings');
const settingsButton=document.getElementById('settingsButton');
const closeSettings=document.getElementById('closeSettings');
const autoShootToggle=document.getElementById('autoShoot');

settingsButton.addEventListener('click',e=>{
  e.stopPropagation();
  settings.classList.remove('hidden');
  if(document.pointerLockElement) document.exitPointerLock();
});
closeSettings.addEventListener('click',()=>{
  autoShoot=autoShootToggle.checked;
  settings.classList.add('hidden');
});
autoShootToggle.addEventListener('change',()=>{
  autoShoot=autoShootToggle.checked;
});

function updateHUD(){
  document.getElementById('health').textContent=Math.max(0,health);
  document.getElementById('ammo').textContent=ammo;
  document.getElementById('score').textContent=score;
}
updateHUD();

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});

addEventListener('keydown',e=>keys[e.code]=true);
addEventListener('keyup',e=>keys[e.code]=false);

renderer.domElement.addEventListener('click',()=>{
  renderer.domElement.requestPointerLock();
  document.getElementById('message').textContent='WASD move • Mouse aim • Click shoot • R reload';
});
addEventListener('mousemove',e=>{
  if(document.pointerLockElement!==renderer.domElement) return;
  yaw -= e.movementX*.0022;
  pitch -= e.movementY*.0022;
  pitch=Math.max(-1.45,Math.min(1.45,pitch));
  camera.rotation.set(pitch,yaw,0,'YXZ');
});
addEventListener('mousedown',e=>{if(e.button===0) shoot()});
addEventListener('keydown',e=>{if(e.code==='KeyR' && ammo<30) ammo=30});

function shoot(){
  if(document.pointerLockElement!==renderer.domElement || shootCooldown>0 || health<=0) return;
  if(ammo<=0){ return; }
  ammo--; shootCooldown=.16;
  raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
  const hits=raycaster.intersectObjects(enemies,false);
  if(hits.length){
    const target=hits[0].object;
    target.userData.hp--;
    target.userData.hitFlash=.08;
    if(target.userData.hp<=0){
      scene.remove(target);
      enemies.splice(enemies.indexOf(target),1);
      score+=100;
    }
  }
  updateHUD();
}

function blocked(pos){
  const r=.45;
  for(const o of obstacles){
    const b=new THREE.Box3().setFromObject(o);
    if(pos.x> b.min.x-r && pos.x<b.max.x+r &&
       pos.z> b.min.z-r && pos.z<b.max.z+r) return true;
  }
  return false;
}

function movePlayer(dt){
  const speed=(keys.ShiftLeft?8:5)*dt;
  const forward=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
  const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  const move=new THREE.Vector3();
  if(keys.KeyW) move.addScaledVector(forward,-speed);
  if(keys.KeyS) move.addScaledVector(forward,speed);
  if(keys.KeyA) move.addScaledVector(right,-speed);
  if(keys.KeyD) move.addScaledVector(right,speed);
  const next=camera.position.clone().add(move);
  next.y=1.7;
  if(!blocked(next)) camera.position.copy(next);
}

function updateEnemies(dt){
  for(const e of enemies){
    const dir=camera.position.clone().sub(e.position); dir.y=0;
    const d=dir.length();
    if(d>1.6){
      dir.normalize();
      const next=e.position.clone().addScaledVector(dir,dt*1.2);
      if(!blocked(next)) e.position.copy(next);
    }else{
      health-=dt*12;
    }
    e.lookAt(camera.position.x,e.position.y,camera.position.z);
    if(e.userData.hitFlash>0){
      e.userData.hitFlash-=dt;
      e.material.emissive.setHex(0xffffff);
    }else e.material.emissive.setHex(0x000000);
  }
  updateHUD();
}

function tryAutoShoot(){
  if(!autoShoot || shootCooldown>0 || ammo<=0 || health<=0) return;
  raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
  const hits=raycaster.intersectObjects(enemies,false);
  if(hits.length && hits[0].distance<55) shoot();
}

function loop(){
  const dt=Math.min(clock.getDelta(),.05);
  shootCooldown=Math.max(0,shootCooldown-dt);
  if(health>0){
    movePlayer(dt);
    updateEnemies(dt);
    tryAutoShoot();
    spawnTimer+=dt;
    if(spawnTimer>4 && enemies.length<9){spawnTimer=0;spawnEnemy()}
  }else{
    document.getElementById('message').textContent='GAME OVER — refresh to restart';
  }
  renderer.render(scene,camera);
  requestAnimationFrame(loop);
}
loop();
