import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const CHARACTERS = [
  { id: "Warrior", role: "Front-line fighter", file: "Warrior.gltf", idle: ["Idle", "Idle_Weapon"], move: ["Run", "Walk"], attack: ["Sword_Attack", "Sword_Attack2", "Punch"] },
  { id: "Wizard", role: "Spellcaster", file: "Wizard.gltf", idle: ["Idle"], move: ["Run", "Walk"], attack: ["Staff_Attack", "Punch"], abilities: { "1": "Spell1", "2": "Spell2" } },
  { id: "Rogue", role: "Fast attacker", file: "Rogue.gltf", idle: ["Idle", "Attacking_Idle"], move: ["Run", "Walk"], attack: ["Dagger_Attack", "Dagger_Attack2", "Punch"] },
  { id: "Ranger", role: "Bow user", file: "Ranger.gltf", idle: ["Idle", "Idle_Weapon"], move: ["Run", "Run_Holding", "Walk"], attack: ["Bow_Shoot", "Bow_Draw"] },
  { id: "Cleric", role: "Support fighter", file: "Cleric.gltf", idle: ["Idle", "Idle_Weapon"], move: ["Run", "Walk"], attack: ["Staff_Attack", "Punch"] },
  { id: "Monk", role: "Unarmed fighter", file: "Monk.gltf", idle: ["Idle", "Idle_Attacking"], move: ["Run", "Walk"], attack: ["Attack", "Attack2"] }
];

const $ = (id) => document.getElementById(id);
let selectedCharacter = "Warrior";
let stopCurrentGame = null;

const options = $("character-options");
for (const character of CHARACTERS) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "character" + (character.id === selectedCharacter ? " selected" : "");
  button.innerHTML = `<strong>${character.id}</strong><small>${character.role}</small>`;
  button.addEventListener("click", () => {
    selectedCharacter = character.id;
    options.querySelectorAll(".character").forEach((item) => {
      item.classList.toggle("selected", item === button);
    });
  });
  options.append(button);
}

$("enter-world").addEventListener("click", async () => {
  const name = $("screen-name").value.trim().replace(/[<>]/g, "").slice(0, 18);
  if (!name) {
    $("profile-error").textContent = "Please enter a screen name.";
    $("screen-name").focus();
    return;
  }

  $("profile-error").textContent = "";
  $("enter-world").disabled = true;
  $("enter-world").textContent = "Loading character…";
  $("profile-screen").classList.add("hidden");
  $("game-screen").classList.remove("hidden");
  $("hud-character").textContent = selectedCharacter;

  try {
    stopCurrentGame?.();
    stopCurrentGame = await startGame(name, selectedCharacter);
  } catch (error) {
    console.error("Hollow Crown could not start:", error);
    $("status").textContent = "The 3D scene could not start. Check that WebGL is enabled, then reload.";
  } finally {
    $("enter-world").disabled = false;
    $("enter-world").textContent = "Enter the test world";
  }
});

async function startGame(screenName, characterId) {
  const character = CHARACTERS.find((item) => item.id === characterId) ?? CHARACTERS[0];
  const mount = $("game-canvas");
  const listeners = new AbortController();
  const { signal } = listeners;
  let stopped = false;
  let frameId = 0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9ba8b2);
  scene.fog = new THREE.Fog(0x9ba8b2, 45, 150);

  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 350);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.replaceChildren(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xe5efff, 0x555044, 1.8));
  const sunlight = new THREE.DirectionalLight(0xffe2b5, 2.1);
  sunlight.position.set(-12, 22, 10);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1024, 1024);
  scene.add(sunlight);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshStandardMaterial({ color: 0x68736d, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(2000, 200, 0x52605a, 0x77827a);
  grid.position.y = 0.015;
  scene.add(grid);

  const player = new THREE.Group();
  scene.add(player);

  let mixer = null;
  let actions = {};
  let activeAction = null;
  let actionLocked = false;
  let modelLoaded = false;
  let lastStatus = "";

  function setStatus(message) {
    if (message !== lastStatus) {
      $("status").textContent = message;
      lastStatus = message;
    }
  }

  function findClip(names) {
    return names.find((name) => actions[name]);
  }

  function playLoop(names) {
    if (!mixer || actionLocked) return;
    const clipName = findClip(names);
    if (!clipName) return;
    const next = actions[clipName];
    if (activeAction === next && next.isRunning()) return;

    next.reset();
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = false;
    next.fadeIn(0.18).play();
    if (activeAction && activeAction !== next) activeAction.fadeOut(0.18);
    activeAction = next;
  }

  function playOnce(names, label) {
    if (!mixer || actionLocked) return false;
    const clipName = findClip(names);
    if (!clipName) {
      setStatus(label + " animation is not available for this character.");
      return false;
    }

    const next = actions[clipName];
    actionLocked = true;
    next.reset();
    next.setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
    next.fadeIn(0.1).play();
    if (activeAction && activeAction !== next) activeAction.fadeOut(0.1);
    activeAction = next;
    setStatus(label);

    const onFinished = (event) => {
      if (event.action !== next) return;
      mixer.removeEventListener("finished", onFinished);
      if (activeAction === next) activeAction = null;
      actionLocked = false;
      playLoop(character.idle);
    };
    mixer.addEventListener("finished", onFinished);
    return true;
  }

  function makeNameSprite(text) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    context.fillStyle = "#10151ddd";
    context.beginPath();
    context.roundRect(10, 10, 492, 108, 22);
    context.fill();
    context.strokeStyle = "#d7bd88";
    context.lineWidth = 5;
    context.stroke();
    context.font = "bold 48px system-ui";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#ffffff";
    context.fillText(text, 256, 65, 460);

    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    }));
    sprite.scale.set(2.2, 0.55, 1);
    return sprite;
  }

  const nameplate = makeNameSprite(screenName);
  nameplate.position.set(0, 2.65, 0);
  player.add(nameplate);

  setStatus("Loading " + character.id + " model…");
  try {
    const gltf = await new GLTFLoader().loadAsync("assets/characters/" + character.file);
    if (stopped) {
      gltf.scene.traverse((object) => {
        if (object.isMesh) {
          object.geometry.dispose();
          for (const material of [].concat(object.material ?? [])) material.dispose();
        }
      });
      return () => {};
    }

    const model = gltf.scene;
    model.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    player.add(model);
    mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);
    modelLoaded = true;
    playLoop(character.idle);
    setStatus(character.id + " ready · WASD to move · left-click to attack");
  } catch (error) {
    console.error("Could not load " + character.file, error);
    const fallback = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.42, 0.9, 5, 10),
      new THREE.MeshStandardMaterial({ color: character.id === "Wizard" ? 0x536dbb : 0x9b8058 })
    );
    fallback.position.y = 0.9;
    fallback.castShadow = true;
    player.add(fallback);
    setStatus("Missing " + character.file + " — add the character pack to assets/characters.");
  }

  const keys = new Set();
  let yaw = 0;
  let pitch = 0.22;
  const distance = 6.5;
  let pointerStart = null;
  let pointerDragged = false;
  let lastPointerX = 0;
  let lastPointerY = 0;

  function attack() {
    if (!modelLoaded) return;
    playOnce(character.attack, character.id + " attack");
  }

  function useAbility(key) {
    if (!character.abilities || !character.abilities[key]) return;
    playOnce([character.abilities[key]], "Wizard spell " + key);
  }

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key === "escape") {
      stop();
      $("game-screen").classList.add("hidden");
      $("profile-screen").classList.remove("hidden");
      return;
    }
    if (["w", "a", "s", "d", "1", "2", " "].includes(key)) event.preventDefault();
    keys.add(key);
    if (!event.repeat && (key === "1" || key === "2")) useAbility(key);
  }, { signal });

  window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()), { signal });
  window.addEventListener("blur", () => keys.clear(), { signal });

  const canvas = renderer.domElement;
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    pointerStart = { x: event.clientX, y: event.clientY };
    pointerDragged = false;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    canvas.setPointerCapture?.(event.pointerId);
  }, { signal });

  canvas.addEventListener("pointermove", (event) => {
    if (!pointerStart) return;
    const dx = event.clientX - lastPointerX;
    const dy = event.clientY - lastPointerY;
    if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) {
      pointerDragged = true;
    }
    if (pointerDragged) {
      yaw -= dx * 0.005;
      pitch = THREE.MathUtils.clamp(pitch + dy * 0.003, -0.05, 0.8);
    }
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
  }, { signal });

  canvas.addEventListener("pointerup", (event) => {
    if (pointerStart && !pointerDragged && event.button === 0) attack();
    pointerStart = null;
    pointerDragged = false;
  }, { signal });

  canvas.addEventListener("pointercancel", () => {
    pointerStart = null;
    pointerDragged = false;
  }, { signal });

  const clock = new THREE.Clock();
  function animate() {
    if (stopped) return;
    frameId = requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);

    const forward = (keys.has("w") ? 1 : 0) - (keys.has("s") ? 1 : 0);
    const strafe = (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0);
    const moving = forward !== 0 || strafe !== 0;

    if (moving) {
      const direction = new THREE.Vector3(strafe, 0, -forward)
        .normalize()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      player.position.addScaledVector(direction, delta * 4.5);
      player.rotation.y = Math.atan2(direction.x, direction.z);
      if (!actionLocked) playLoop(character.move);
    } else if (!actionLocked) {
      playLoop(character.idle);
    }

    if (mixer) mixer.update(delta);

    const target = new THREE.Vector3(player.position.x, player.position.y + 1.25, player.position.z);
    const offset = new THREE.Vector3(
      Math.sin(yaw) * distance,
      2.1 + pitch * 3,
      Math.cos(yaw) * distance
    );
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  window.addEventListener("resize", onResize, { signal });

  function stop() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frameId);
    listeners.abort();
    renderer.dispose();
    scene.traverse((object) => {
      if (object.isMesh) {
        object.geometry?.dispose();
        for (const material of [].concat(object.material ?? [])) material.dispose();
      }
      if (object.isSprite) object.material?.map?.dispose();
    });
    mount.replaceChildren();
  }

  return stop;
}
