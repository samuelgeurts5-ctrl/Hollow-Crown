import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const characters = [
  {id:"Warrior",label:"Warrior",role:"Melee fighter",file:"Warrior.gltf"},
  {id:"Wizard",label:"Wizard",role:"Spellcaster",file:"Wizard.gltf"},
  {id:"Rogue",label:"Rogue",role:"Quick attacker",file:"Rogue.gltf"},
  {id:"Ranger",label:"Ranger",role:"Ranged fighter",file:"Ranger.gltf"},
  {id:"Cleric",label:"Cleric",role:"Support",file:"Cleric.gltf"},
  {id:"Monk",label:"Monk",role:"Unarmed fighter",file:"Monk.gltf"}
];
const $ = (id) => document.getElementById(id);
let selected = "Warrior";
const options = $("character-options");
for (const character of characters) {
  const button = document.createElement("button");
  button.className = "character" + (character.id === selected ? " selected" : "");
  button.type = "button";
  button.innerHTML = `<strong>${character.label}</strong><small>${character.role}</small>`;
  button.addEventListener("click", () => {
    selected = character.id;
    options.querySelectorAll("button").forEach(el => el.classList.toggle("selected", el === button));
  });
  options.append(button);
}
$("enter-world").addEventListener("click", async () => {
  const name = $("screen-name").value.trim();
  if (!name) { $("profile-error").textContent = "Please enter a screen name."; return; }
  $("profile-screen").classList.add("hidden");
  $("game-screen").classList.remove("hidden");
  $("hud-character").textContent = selected;
  await startGame(name, selected);
});

async function startGame(screenName, characterId) {
  const mount = $("game-canvas");
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9ba8b2);
  scene.fog = new THREE.Fog(0x9ba8b2, 35, 125);
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, .1, 300);
  const renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.replaceChildren(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xe5efff, 0x555044, 2.0));
  const sun = new THREE.DirectionalLight(0xffe2b5, 2.2);
  sun.position.set(-12, 22, 10); sun.castShadow = true; scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000,2000), new THREE.MeshStandardMaterial({color:0x68736d,roughness:1}));
  ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; scene.add(ground);
  const grid = new THREE.GridHelper(2000,200,0x52605a,0x77827a);
  grid.position.y = .012; scene.add(grid);

  const player = new THREE.Group(); scene.add(player);
  let mixer = null, actions = {}, activeAction = null, model = null;
  const loader = new GLTFLoader();
  const file = characters.find(c=>c.id===characterId).file;
  try {
    const gltf = await loader.loadAsync(`assets/characters/${file}`);
    model = gltf.scene;
    model.scale.setScalar(1);
    model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    player.add(model);
    mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);
    play(["Idle","Attacking_Idle","Idle_Weapon"]);
    $("status").textContent = "Character loaded · WASD to move · click to attack";
  } catch (error) {
    console.error(error);
    const fallback = new THREE.Mesh(new THREE.CapsuleGeometry(.42,.9,5,10),new THREE.MeshStandardMaterial({color:characterId==="Wizard"?0x536dbb:0x9b8058}));
    fallback.position.y=.9; fallback.castShadow=true; player.add(fallback);
    $("status").textContent = "Model files not found yet — showing a temporary test figure.";
  }
  const nameSprite = makeNameSprite(screenName);
  nameSprite.position.set(0,2.65,0); player.add(nameSprite);

  function play(names) {
    const name = names.find(n=>actions[n]);
    if (!name) return;
    const next=actions[name]; if(activeAction===next)return;
    next.reset().fadeIn(.16).play(); activeAction?.fadeOut(.16); activeAction=next;
  }
  function makeNameSprite(text) {
    const canvas=document.createElement("canvas"); canvas.width=512;canvas.height=128;
    const ctx=canvas.getContext("2d");
    ctx.fillStyle="#10151ddd";ctx.beginPath();ctx.roundRect(10,10,492,108,22);ctx.fill();
    ctx.strokeStyle="#d7bd88";ctx.lineWidth=5;ctx.stroke();
    ctx.font="bold 48px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle="#fff";ctx.fillText(text.slice(0,18),256,65,460);
    const texture=new THREE.CanvasTexture(canvas);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));
    sprite.scale.set(2.2,.55,1); return sprite;
  }

  const keys=new Set(); let yaw=0, pitch=.22, distance=6, attackingUntil=0;
  addEventListener("keydown",e=>{keys.add(e.key.toLowerCase()); if(e.key==="Escape"){ $("game-screen").classList.add("hidden");$("profile-screen").classList.remove("hidden");}});
  addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));
  renderer.domElement.addEventListener("click",()=>{if(characterId==="Wizard" && performance.now()<attackingUntil)return;play(["Sword_Attack","Dagger_Attack","Attack","Punch","Staff_Attack","Bow_Shoot"]);attackingUntil=performance.now()+650;});
  addEventListener("keydown",e=>{
    if(characterId!=="Wizard")return;
    if(e.key==="1"){play(["Spell1"]);$("status").textContent="Wizard ability 1 · Spell 1";}
    if(e.key==="2"){play(["Spell2"]);$("status").textContent="Wizard ability 2 · Spell 2";}
  });
  let dragging=false,lastX=0,lastY=0;
  renderer.domElement.addEventListener("pointerdown",e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;});
  addEventListener("pointerup",()=>dragging=false);
  addEventListener("pointermove",e=>{if(!dragging)return;yaw-=(e.clientX-lastX)*.005;pitch=Math.max(-.05,Math.min(.8,pitch+(e.clientY-lastY)*.003));lastX=e.clientX;lastY=e.clientY;});
  const clock=new THREE.Clock();
  function animate(){
    requestAnimationFrame(animate);
    const dt=Math.min(clock.getDelta(),.05);
    const forward=(keys.has("w")?1:0)-(keys.has("s")?1:0);
    const strafe=(keys.has("d")?1:0)-(keys.has("a")?1:0);
    const moving=forward!==0||strafe!==0;
    if(moving){
      const v=new THREE.Vector3(strafe,0,-forward).normalize().applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
      player.position.addScaledVector(v,dt*5);
      player.rotation.y=Math.atan2(v.x,v.z);
      if(performance.now()>attackingUntil)play(["Run","Walk"]);
    } else if(performance.now()>attackingUntil) play(["Idle","Attacking_Idle","Idle_Weapon"]);
    if(mixer)mixer.update(dt);
    const target=new THREE.Vector3(player.position.x,player.position.y+1.3,player.position.z);
    const offset=new THREE.Vector3(Math.sin(yaw)*distance,2.2+pitch*3,Math.cos(yaw)*distance);
    camera.position.copy(target).add(offset);camera.lookAt(target);
    renderer.render(scene,camera);
  }
  animate();
  addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
}