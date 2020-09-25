class Game {
  constructor() {
    if (!Detector.webgl) Detector.addGetWebGLMessage();

    this.modes = Object.freeze({
      NONE: Symbol("none"),
      PRELOAD: Symbol("preload"),
      INITIALISING: Symbol("initialising"),
      CREATING_LEVEL: Symbol("creating_level"),
      ACTIVE: Symbol("active"),
      GAMEOVER: Symbol("gameover"),
    });
    this.mode = this.modes.NONE;

    this.container;
    this.player = {};
    this.stats;
    this.controls;
    this.camera;
    this.scene;
    this.renderer;
    this.composer;
    this.cellSize = 16;
    this.interactive = false;
    this.levelIndex = 0;
    this._hints = 0;
    this.score = 0;
    this.debug = true;
    this.debugPhysics = false;
    this.cameraFade = 0.05;
    this.mute = false;
    this.collect = [];
    this.highlighted;
    this.outlinePass;

    this.messages = {
      text: ["Welcome to LostTreasure", "GOOD LUCK!"],
      index: 0,
    };

    if (localStorage && !this.debug) {
      //const levelIndex = Number(localStorage.getItem('levelIndex'));
      //if (levelIndex!=undefined) this.levelIndex = levelIndex;
    }

    this.container = document.createElement("div");
    this.container.style.height = "100%";
    document.body.appendChild(this.container);

    const sfxExt = SFX.supportsAudioType("mp3") ? "mp3" : "ogg";
    const game = this;
    this.anims = ["ize_idle_rig"];
    this.tweens = [];

    this.assetsPath = "../assets/";

    const options = {
      assets: [
        `${this.assetsPath}sfx/gliss.${sfxExt}`,
        `${this.assetsPath}sfx/factory.${sfxExt}`,
        `${this.assetsPath}sfx/button.${sfxExt}`,
        `${this.assetsPath}sfx/door.${sfxExt}`,
        `${this.assetsPath}sfx/fan.${sfxExt}`,
        `${this.assetsPath}fbx/environment4.fbx`,
        `${this.assetsPath}fbx/ize_walk.fbx`,
        `${this.assetsPath}fbx/usb.fbx`,
      ],
      oncomplete: function () {
        game.init();
        game.animate();
      },
    };

    this.anims.forEach(function (anim) {
      options.assets.push(`${game.assetsPath}fbx/${anim}.fbx`);
    });

    this.mode = this.modes.PRELOAD;

    this.actionBtn = document.getElementById("action-btn");

    this.clock = new THREE.Clock();

    //this.init();
    //this.animate();
    const preloader = new Preloader(options);
  }

  toggleBriefcase() {
    const briefcase = document.getElementById("briefcase");
    const open = briefcase.style.opacity > 0;

    if (open) {
      briefcase.style.opacity = "0";
    } else {
      briefcase.style.opacity = "1";
    }
  }

  toggleSound() {
    this.mute = !this.mute;
    const btn = document.getElementById("sfx-btn");

    if (this.mute) {
      for (let prop in this.sfx) {
        let sfx = this.sfx[prop];
        if (sfx instanceof SFX) sfx.stop();
      }
      btn.innerHTML = '<i class="fas fa-volume-off"></i>';
    } else {
      this.sfx.factory.play;
      this.sfx.fan.play();
      btn.innerHTML = '<i class="fas fa-volume-up"></i>';
    }
  }

  contextAction() {
    console.log("contextAction called " + JSON.stringify(this.onAction));
    if (this.onAction !== undefined) {
      if (this.onAction.action != undefined) {
        this.action = this.onAction.action;
      }
    }

    const game = this;

    if (this.onAction.mode !== undefined) {
      switch (this.onAction.mode) {
        case "open-doors":
          this.sfx.door.play();
          this.sfx.button.play();
          const door = this.doors[this.onAction.index];
          const left = door.doors[0];
          const right = door.doors[1];
          this.cameraTarget = {
            position: left.position.clone(),
            target: left.position.clone(),
          };
          this.cameraTarget.position.y += 150;
          this.cameraTarget.position.x -= 950;
          //target, channel, endValue, duration, oncomplete, easing="inOutQuad"){
          this.tweens.push(
            new Tween(
              left.position,
              "z",
              left.position.z - 240,
              2,
              function () {
                game.tweens.splice(game.tweens.indexOf(this), 1);
              }
            )
          );
          this.tweens.push(
            new Tween(
              right.position,
              "z",
              right.position.z + 240,
              2,
              function () {
                game.tweens.splice(game.tweens.indexOf(this), 1);
                delete game.cameraTarget;
                const door = game.doors[this.onAction.index];
                const left = door.doors[0];
                const right = door.doors[1];
                const leftProxy = door.proxy[0];
                const rightProxy = door.proxy[1];
                leftProxy.position = left.position.clone();
                rightProxy.position = right.position.clone();
              }
            )
          );
          break;
        case "collect":
          this.activeCamera = this.player.cameras.collect;
          this.collect[this.onAction.index].visible = false;
          if (this.collected == undefined) this.collected = [];
          this.collected.push(this.onAction.index);
          document.getElementById("briefcase").children[0].children[0].children[
            this.onAction.index
          ].children[0].src = this.onAction.src;

          break;
      }
    }
  }

  switchCamera(fade = 0.05) {
    const cams = Object.keys(this.player.cameras);
    cams.splice(cams.indexOf("active"), 1);
    let index;
    for (let prop in this.player.cameras) {
      if (this.player.cameras[prop] == this.player.cameras.active) {
        index = cams.indexOf(prop) + 1;
        if (index >= cams.length) index = 0;
        this.player.cameras.active = this.player.cameras[cams[index]];
        break;
      }
    }
    this.cameraFade = fade;
  }

  initSfx() {
    this.sfx = {};
    this.sfx.context = new (window.AudioContext || window.webkitAudioContext)();
    const list = ["gliss", "door", "factory", "button", "fan"];
    const game = this;
    list.forEach(function (item) {
      game.sfx[item] = new SFX({
        context: game.sfx.context,
        src: {
          mp3: `${game.assetsPath}sfx/${item}.mp3`,
          ogg: `${game.assetsPath}sfx/${item}.ogg`,
        },
        loop: item == "factory" || item == "fan",
        autoplay: item == "factory" || item == "fan",
        volume: 0.3,
      });
    });
  }

  set activeCamera(object) {
    this.player.cameras.active = object;
  }

  init() {
    this.mode = this.modes.INITIALISING;

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      1,
      2000
    );

    let col = 0x605050;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(col);
    this.scene.fog = new THREE.Fog(col, 500, 1500);

    let light = new THREE.HemisphereLight(0xffffff, 0x444444);
    light.position.set(0, 200, 0);
    this.scene.add(light);

    light = new THREE.DirectionalLight(0xffffff);
    light.position.set(0, 200, 100);
    light.castShadow = true;
    light.shadow.mapSize.width = 2048;
    light.shadow.mapSize.height = 2048;
    light.shadow.camera.top = 3000;
    light.shadow.camera.bottom = -3000;
    light.shadow.camera.left = -3000;
    light.shadow.camera.right = 3000;
    light.shadow.camera.far = 3000;
    this.scene.add(light);

    // ground
    var mesh = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(2000, 2000),
      new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
    );
    mesh.rotation.x = -Math.PI / 2;
    //mesh.position.y = -100;
    mesh.receiveShadow = true;
    //this.scene.add( mesh );

    var grid = new THREE.GridHelper(2000, 40, 0x000000, 0x000000);
    //grid.position.y = -100;
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    //this.scene.add( grid );

    // model
    const loader = new THREE.FBXLoader();
    const game = this;

    loader.load(
      `${this.assetsPath}fbx/ize_walk.fbx`,
      function (object) {
        object.mixer = new THREE.AnimationMixer(object);
        object.mixer.addEventListener("finished", function (e) {
          game.action = "ize_idle_rig";
          if (game.player.cameras.active == game.player.cameras.collect) {
            game.activeCamera = game.player.cameras.back;
          }
        });
        object.castShadow = true;
        const scl = 0.6;
        object.scale.set(scl, scl, scl);

        game.player.mixer = object.mixer;
        game.player.root = object.mixer.getRoot();

        object.name = "Character";

        object.traverse(function (child) {
          if (child.isMesh) {
            const oldMat = child.material;
            const izeMaterial = new THREE.MeshStandardMaterial({
              map: oldMat.map,
              skinning: true,
              roughness: 1,
              metalness: 0,
            });
            child.material = izeMaterial;
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        game.scene.add(object);
        game.player.object = object;
        game.player.walk = object.animations[0];

        game.joystick = new JoyStick({
          onMove: game.playerControl,
          game: game,
        });

        game.createCameras();
        game.loadEnvironment(loader);
      },
      null,
      this.onError
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.gammaOutput = true;
    this.renderer.gammaFactor = 2.2;
    this.renderer.physicallyCorrectLights = true;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap
    this.renderer.shadowMapDebug = true;
    this.container.appendChild(this.renderer.domElement);

    // postprocessing
    this.composer = new THREE.EffectComposer(this.renderer);
    let renderPass = new THREE.RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    this.outlinePass = new THREE.OutlinePass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      this.scene,
      this.camera
    );
    this.outlinePass.renderToScreen = true;
    this.composer.addPass(this.outlinePass);

    this.effectFXAA = new THREE.ShaderPass(THREE.FXAAShader);
    this.effectFXAA.uniforms["resolution"].value.set(
      1 / window.innerWidth,
      1 / window.innerHeight
    );
    this.effectFXAA.renderToScreen = true;
    this.composer.addPass(this.effectFXAA);

    // let horizontalBlur = new THREE.ShaderPass(THREE.HorizontalBlurShader);
    // this.composer.addPass(horizontalBlur);
    // let verticalBlur = new THREE.ShaderPass(THREE.VerticalBlurShader);
    // this.composer.addPass(verticalBlur);
    // let effectSobel = new THREE.ShaderPass(THREE.SobelOperatorShader);
    // effectSobel.renderToScreen = true;
    // effectSobel.uniforms.resolution.value.x = window.innerWidth;
    // effectSobel.uniforms.resolution.value.y = window.innerHeight;
    // this.composer.addPass(effectSobel);

    window.addEventListener(
      "resize",
      function () {
        game.onWindowResize();
      },
      false
    );

    // stats
    if (this.debug) {
      this.stats = new Stats();
      this.container.appendChild(this.stats.dom);
    }

    this.initSfx();

    // menu
    let menuItems = document.getElementsByClassName("menu-item");
    for (let item of menuItems) {
      item.addEventListener("click", () => {
        $(".section").hide();
        let id = item.children[0].getAttribute("href").substring(1);
        $(`#section-${id}`).show();
      });
    }
  }

  loadUSB(loader) {
    const game = this;

    loader.load(
      `${this.assetsPath}fbx/laptop.fbx`,
      function (object) {
        game.scene.add(object);

        const scale = 1;
        object.scale.set(scale, scale, scale);
        object.name = "laptop";
        object.position.set(0, 100, 40);
        object.castShadow = true;

        game.outlinePass.selectedObjects = [object];

        game.collect.push(object);

        object.traverse(function (child) {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        game.loadNextAnim(loader);
      },
      null,
      this.onError
    );
  }

  loadEnvironment(loader) {
    const game = this;

    loader.load(
      `${this.assetsPath}fbx/environment4.fbx`,
      function (object) {
        game.scene.add(object);
        game.doors = [];
        game.fans = [];

        object.receiveShadow = true;
        object.name = "Environment";
        let door = { trigger: null, proxy: [], doors: [] };

        let video = document.getElementById("video");
        video.play();

        let videoTexture = new THREE.VideoTexture(video);
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.maxFilter = THREE.LinearFilter;

        let videoMaterial = new THREE.MeshBasicMaterial({
          map: videoTexture,
          overdraw: true,
        });

        object.traverse(function (child) {
          if (child.isMesh) {
            if (child.name.includes("main")) {
              child.castShadow = true;
              child.receiveShadow = true;
            } else if (child.name.includes("ment_proxy")) {
              child.material.visible = false;
              game.environmentProxy = child;
            } else if (child.name.includes("door-proxy")) {
              child.material.visible = false;
              door.proxy.push(child);
              checkDoor();
            } else if (child.name.includes("laptop")) {
              game.laptop = child;
            } else if (child.name.includes("tv")) {
              game.tv = child;
              child.material = videoMaterial;
            } else if (child.name.includes("poster")) {
              game.poster = child;
            }
          }

          function checkDoor() {
            if (
              door.trigger !== null &&
              door.proxy.length == 2 &&
              door.doors.length == 2
            ) {
              game.doors.push(Object.assign({}, door));
              door = { trigger: null, proxy: [], doors: [] };
            }
          }
        });

        game.loadNextAnim(loader);
      },
      null,
      this.onError
    );
  }

  createDummyEnvironment() {
    const env = new THREE.Group();
    env.name = "Environment";
    this.scene.add(env);

    const geometry = new THREE.BoxBufferGeometry(150, 150, 150);
    const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });

    for (let x = -1000; x < 1000; x += 300) {
      for (let z = -1000; z < 1000; z += 300) {
        const block = new THREE.Mesh(geometry, material);
        block.position.set(x, 75, z);
        env.add(block);
      }
    }

    this.environmentProxy = env;
  }

  playerControl(forward, turn) {
    // console.log(`playerControl(${forward}), ${turn}`);
    turn = -turn;

    if (forward == 0 && turn == 0) {
      delete this.player.move;
    } else {
      this.player.move = { forward, turn };
    }

    if (forward > 0) {
      if (this.player.action != "walk" && this.player.action != "run")
        this.action = "walk";
    } else if (forward < -0.2) {
      if (this.player.action != "walk") this.action = "walk";
    } else {
      if (this.player.action == "walk" || this.player.action == "run")
        this.action = "ize_idle_rig";
    }
  }

  createCameras() {
    const back = new THREE.Object3D();
    back.position.set(0, 100, -250);
    back.parent = this.player.object;
    const wide = new THREE.Object3D();
    wide.position.set(178, 139, 465);
    wide.parent = this.player.object;

    this.player.cameras = { back, wide };
    game.activeCamera = game.player.cameras.back;
  }

  loadNextAnim(loader) {
    let anim = this.anims.pop();
    const game = this;
    loader.load(
      `${this.assetsPath}fbx/${anim}.fbx`,
      function (object) {
        game.player[anim] = object.animations[0];

        // Filter out track names
        const tracks = object.animations[0].tracks;
        for (let i = tracks.length - 1; i >= 0; i--) {
          const track = tracks[i];
          if (track.name.includes("_end")) {
            object.animations[0].tracks.splice(i, 1);
          }
          if (track.name.includes("mixamorig_")) {
            object.animations[0].tracks[i].name = track.name.replace(
              "mixamorig_",
              ""
            );
          }
        }

        if (game.anims.length > 0) {
          game.loadNextAnim(loader);
        } else {
          delete game.anims;
          game.action = "ize_idle_rig";
          game.initPlayerPosition();
          game.mode = game.modes.ACTIVE;
        }
      },
      null,
      this.onError
    );
  }

  initPlayerPosition() {
    //cast down
    const dir = new THREE.Vector3(0, -1, 0);
    const pos = this.player.object.position.clone();
    pos.y += 200;
    const raycaster = new THREE.Raycaster(pos, dir);
    const gravity = 30;
    const box = this.environmentProxy;

    const intersect = raycaster.intersectObject(box);
    if (intersect.length > 0) {
      this.player.object.position.y = pos.y - intersect[0].distance;
    }
  }

  getMousePosition(clientX, clientY) {
    const pos = new THREE.Vector2();
    pos.x = (clientX / this.renderer.domElement.clientWidth) * 2 - 1;
    pos.y = -(clientY / this.renderer.domElement.clientHeight) * 2 + 1;
    return pos;
  }

  showMessage(msg, fontSize = 20, onOK = null) {
    const txt = document.getElementById("message_text");
    txt.innerHTML = msg;
    txt.style.fontSize = fontSize + "px";
    const btn = document.getElementById("message_ok");
    const panel = document.getElementById("message");
    const game = this;
    if (onOK != null) {
      btn.onclick = function () {
        panel.style.display = "none";
        onOK.call(game);
      };
    } else {
      btn.onclick = function () {
        panel.style.display = "none";
      };
    }
    panel.style.display = "flex";
  }

  loadJSON(name, callback) {
    var xobj = new XMLHttpRequest();
    xobj.overrideMimeType("application/json");
    xobj.open("GET", `${name}.json`, true); // Replace 'my_data' with the path to your file
    xobj.onreadystatechange = function () {
      if (xobj.readyState == 4 && xobj.status == "200") {
        // Required use of an anonymous callback as .open will NOT return a value but simply returns undefined in asynchronous mode
        callback(xobj.responseText);
      }
    };
    xobj.send(null);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);

    this.effectFXAA.uniforms["resolution"].value.set(
      1 / window.innerWidth,
      1 / window.innerHeight
    );
  }

  set action(name) {
    if (this.player.action == name) return;
    const anim = this.player[name];
    const action = this.player.mixer.clipAction(anim, this.player.root);
    this.player.mixer.stopAllAction();
    this.player.action = name;
    action.timeScale =
      name == "walk" &&
      this.player.move != undefined &&
      this.player.move.forward < 0
        ? -0.3
        : 1;
    action.time = 0;
    action.fadeIn(0.5);
    if (name == "push-button" || name == "gather-objects")
      action.loop = THREE.LoopOnce;
    action.play();
    this.player.actionTime = Date.now();
  }

  movePlayer(dt) {
    const pos = this.player.object.position.clone();
    pos.y += 60;
    let dir = new THREE.Vector3();
    this.player.object.getWorldDirection(dir);
    if (this.player.move.forward < 0) dir.negate();
    let raycaster = new THREE.Raycaster(pos, dir);
    let blocked = false;
    const box = this.environmentProxy;

    if (this.environmentProxy != undefined) {
      const intersect = raycaster.intersectObject(box);
      if (intersect.length > 0) {
        if (intersect[0].distance < 50) blocked = true;
      }
    }

    if (!blocked) {
      if (this.player.move.forward > 0) {
        const speed = this.player.action == "run" ? 200 : 100;
        this.player.object.translateZ(dt * speed);
      } else {
        this.player.object.translateZ(-dt * 30);
      }
    }

    if (this.environmentProxy != undefined) {
      //cast left
      dir.set(-1, 0, 0);
      dir.applyMatrix4(this.player.object.matrix);
      dir.normalize();
      raycaster = new THREE.Raycaster(pos, dir);

      let intersect = raycaster.intersectObject(box);
      if (intersect.length > 0) {
        if (intersect[0].distance < 50)
          this.player.object.translateX(50 - intersect[0].distance);
      }

      //cast right
      dir.set(1, 0, 0);
      dir.applyMatrix4(this.player.object.matrix);
      dir.normalize();
      raycaster = new THREE.Raycaster(pos, dir);

      intersect = raycaster.intersectObject(box);
      if (intersect.length > 0) {
        if (intersect[0].distance < 50)
          this.player.object.translateX(intersect[0].distance - 50);
      }

      //cast down
      dir.set(0, -1, 0);
      pos.y += 200;
      raycaster = new THREE.Raycaster(pos, dir);
      const gravity = 30;

      intersect = raycaster.intersectObject(box);
      if (intersect.length > 0) {
        const targetY = pos.y - intersect[0].distance;
        if (targetY > this.player.object.position.y) {
          //Going up
          this.player.object.position.y =
            0.8 * this.player.object.position.y + 0.2 * targetY;
          this.player.velocityY = 0;
        } else if (targetY < this.player.object.position.y) {
          //Falling
          if (this.player.velocityY == undefined) this.player.velocityY = 0;
          this.player.velocityY += dt * gravity;
          this.player.object.position.y -= this.player.velocityY;
          if (this.player.object.position.y < targetY) {
            this.player.velocityY = 0;
            this.player.object.position.y = targetY;
          }
        }
      }
    }
  }

  animate() {
    const game = this;
    const dt = this.clock.getDelta();

    requestAnimationFrame(function () {
      game.animate();
    });

    if (this.tweens.length > 0) {
      this.tweens.forEach(function (tween) {
        tween.update(dt);
      });
    }

    if (this.player.mixer != undefined && this.mode == this.modes.ACTIVE) {
      this.player.mixer.update(dt);
    }

    if (this.player.action == "walk") {
      const elapsedTime = Date.now() - this.player.actionTime;
      // if (elapsedTime > 1000 && this.player.move.forward > 0)
      //   this.action = "run";
    }
    if (this.player.move != undefined) {
      if (this.player.move.forward != 0) this.movePlayer(dt);
      this.player.object.rotateY(this.player.move.turn * dt);
    }

    if (
      this.player.cameras != undefined &&
      this.player.cameras.active != undefined
    ) {
      this.camera.position.lerp(
        this.player.cameras.active.getWorldPosition(new THREE.Vector3()),
        this.cameraFade
      );
      let pos;
      if (this.cameraTarget != undefined) {
        this.camera.position.copy(this.cameraTarget.position);
        pos = this.cameraTarget.target;
      } else {
        pos = this.player.object.position.clone();
        pos.y += 60; // Edit this line to adjust camera Y position
      }
      this.camera.lookAt(pos);
    }

    this.actionBtn.style = "display:none;";
    let trigger = false;

    if (this.doors !== undefined) {
      this.doors.forEach(function (door) {
        if (
          game.player.object.position.distanceTo(door.trigger.position) < 100
        ) {
          game.actionBtn.style = "display:block;";
          game.onAction = {
            action: "push-button",
            mode: "open-doors",
            index: 0,
          };
          trigger = true;
        }
      });
    }

    if (this.collect !== undefined && !trigger) {
      this.collect.forEach(function (object) {
        if (
          object.visible &&
          game.player.object.position.distanceTo(object.position) < 100
        ) {
          game.actionBtn.style = "display:block;";
          game.onAction = {
            action: "gather-objects",
            mode: "collect",
            index: 0,
            src: "usb.jpg",
          };
          trigger = true;
        }
      });
    }

    if (!trigger) delete this.onAction;

    if (this.fans !== undefined) {
      let vol = 0;
      this.fans.forEach(function (fan) {
        const dist = fan.position.distanceTo(game.player.object.position);
        const tmpVol = 1 - dist / 1000;
        if (tmpVol > vol) vol = tmpVol;
        fan.rotateZ(dt);
      });
      this.sfx.fan.volume = vol;
    }

    if (this.tv !== undefined) {
      const dist = this.tv.position.distanceTo(game.player.object.position);
      if (dist < 150) {
        // near tv
        $("#menu-video, #bottom-title-video").addClass("highlighted");
        this.highlighted = "video";
        this.outlinePass.selectedObjects = [this.tv];
      } else {
        $("#menu-video, #bottom-title-video").removeClass("highlighted");
        if (this.highlighted === "video") {
          this.outlinePass.selectedObjects = [];
          this.highlighted = "";
        }
      }
    }

    if (this.laptop !== undefined) {
      const dist = this.laptop.position.distanceTo(game.player.object.position);
      if (dist < 80) {
        // near laptop
        $("#menu-contact, #bottom-title-contact").addClass("highlighted");
        this.highlighted = "contact";
        this.outlinePass.selectedObjects = [this.laptop];
      } else {
        $("#menu-contact, #bottom-title-contact").removeClass("highlighted");
        if (this.highlighted === "contact") {
          this.outlinePass.selectedObjects = [];
          this.highlighted = "";
        }
      }
    }

    if (this.poster !== undefined) {
      const dist = this.poster.position.distanceTo(game.player.object.position);
      if (dist < 140) {
        // near poster
        $("#menu-tour, #bottom-title-tour").addClass("highlighted");
        this.highlighted = "tour";
        this.outlinePass.selectedObjects = [this.poster];
      } else {
        $("#menu-tour, #bottom-title-tour").removeClass("highlighted");
        if (this.highlighted === "tour") {
          this.outlinePass.selectedObjects = [];
          this.highlighted = "";
        }
      }
    }

    this.composer.render();
    // this.renderer.render(this.scene, this.camera);

    if (this.stats != undefined) this.stats.update();
  }

  onError(error) {
    const msg = console.error(JSON.stringify(error));
    console.error(error.message);
  }
}
