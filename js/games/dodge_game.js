/**
 * CyberDodge VR - Head & Torso Motion Dodging Game
 * Duck under high lasers, lean left/right, and trigger slow-motion bullet time!
 */
class CyberDodgeGame {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.active = false;
        this.score = 0;
        this.distance = 0;
        this.health = 100;
        this.maxHealth = 100;
        this.speed = 22;
        this.obstacles = [];
        this.particles = [];
        this.bulletTimeTimer = 0;
        this.timeDilation = 1.0;
        this.spawnTimer = 0;
        this.playerHitbox = new THREE.Vector3(0, 0, 0);

        this.grid = null;
        this.playerVisor = null;
        this.lights = [];
    }

    start() {
        this.active = true;
        this.score = 0;
        this.distance = 0;
        this.health = 100;
        this.obstacles = [];
        this.particles = [];
        this.bulletTimeTimer = 0;
        this.timeDilation = 1.0;
        this.spawnTimer = 0;

        this.buildEnvironment();
        if (window.soundFx) window.soundFx.startBgm();
    }

    buildEnvironment() {
        // High speed retro floor grid
        const gridHelper = new THREE.GridHelper(200, 50, 0xff00aa, 0x00f3ff);
        gridHelper.position.y = -2.5;
        this.grid = gridHelper;
        this.scene.add(gridHelper);

        // Ceiling grid
        const ceilGrid = new THREE.GridHelper(200, 50, 0x00f3ff, 0x112244);
        ceilGrid.position.y = 5.0;
        this.ceilGrid = ceilGrid;
        this.scene.add(ceilGrid);

        // Holographic Player Head Visor
        const visorGeo = new THREE.RingGeometry(0.15, 0.22, 16);
        const visorMat = new THREE.MeshBasicMaterial({
            color: 0x39ff14,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        });
        this.playerVisor = new THREE.Mesh(visorGeo, visorMat);
        this.scene.add(this.playerVisor);

        // Lighting
        const amb = new THREE.AmbientLight(0x1a2244, 1.5);
        const pLight = new THREE.PointLight(0x00f3ff, 2, 20);
        pLight.position.set(0, 2, 0);
        this.scene.add(amb);
        this.scene.add(pLight);
        this.lights.push(amb, pLight);
    }

    spawnObstacle() {
        // Types: 'DUCK' (high beam), 'LEAN_LEFT' (blocks right side), 'LEAN_RIGHT' (blocks left side), 'PLASMA_ORB' (aimed at center)
        const types = ['DUCK', 'LEAN_LEFT', 'LEAN_RIGHT', 'PLASMA_ORB'];
        const type = types[Math.floor(Math.random() * types.length)];
        const zSpawn = -80;

        if (type === 'DUCK') {
            // High horizontal laser wall: height spans Y: -0.2 to 3.0. Player MUST duck below Y: -0.4
            const geo = new THREE.BoxGeometry(7, 2.4, 0.4);
            const mat = new THREE.MeshStandardMaterial({
                color: 0xff0055,
                emissive: 0xff0033,
                emissiveIntensity: 0.8,
                roughness: 0.2,
                transparent: true,
                opacity: 0.85
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(0, 1.2, zSpawn);

            // Warning holographic text / stripes
            this.scene.add(mesh);
            this.obstacles.push({
                type,
                mesh,
                minY: 0.0, // must duck below this
                xRange: [-3.5, 3.5],
                active: true,
                passed: false
            });
        } else if (type === 'LEAN_LEFT') {
            // Blocks middle and right side: spans X: -0.3 to 3.5. Player MUST lean left (X < -0.8)
            const geo = new THREE.BoxGeometry(4.2, 5.0, 0.4);
            const mat = new THREE.MeshStandardMaterial({
                color: 0xffaa00,
                emissive: 0xff7700,
                emissiveIntensity: 0.7,
                roughness: 0.2
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(1.6, 0.5, zSpawn);
            this.scene.add(mesh);
            this.obstacles.push({
                type,
                mesh,
                xRange: [-0.4, 3.5],
                yRange: [-2.0, 3.5],
                active: true,
                passed: false
            });
        } else if (type === 'LEAN_RIGHT') {
            // Blocks middle and left side: spans X: -3.5 to 0.3. Player MUST lean right (X > 0.8)
            const geo = new THREE.BoxGeometry(4.2, 5.0, 0.4);
            const mat = new THREE.MeshStandardMaterial({
                color: 0xffaa00,
                emissive: 0xff7700,
                emissiveIntensity: 0.7,
                roughness: 0.2
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(-1.6, 0.5, zSpawn);
            this.scene.add(mesh);
            this.obstacles.push({
                type,
                mesh,
                xRange: [-3.5, 0.4],
                yRange: [-2.0, 3.5],
                active: true,
                passed: false
            });
        } else if (type === 'PLASMA_ORB') {
            // Giant energy plasma sphere
            const geo = new THREE.SphereGeometry(1.0, 16, 16);
            const mat = new THREE.MeshBasicMaterial({
                color: 0x9900ff,
                wireframe: true
            });
            const mesh = new THREE.Mesh(geo, mat);
            const xOffset = (Math.random() - 0.5) * 2.5;
            mesh.position.set(xOffset, 0.2, zSpawn);
            this.scene.add(mesh);
            this.obstacles.push({
                type,
                mesh,
                radius: 1.1,
                active: true,
                passed: false
            });
        }
    }

    update(delta, trackingData) {
        if (!this.active) return;

        // Apply bullet time slow motion
        if (this.bulletTimeTimer > 0) {
            this.bulletTimeTimer -= delta;
            this.timeDilation = 0.35;
            if (this.bulletTimeTimer <= 0) {
                this.timeDilation = 1.0;
                if (window.soundFx) window.soundFx.playBulletTime(false);
            }
        } else {
            this.timeDilation = 1.0;
        }

        const effectiveDelta = delta * this.timeDilation;
        this.distance += this.speed * effectiveDelta;
        this.score = Math.floor(this.distance * 10);

        // Move grid to simulate high-speed motion
        if (this.grid) {
            this.grid.position.z = (this.grid.position.z + this.speed * effectiveDelta) % 4;
        }
        if (this.ceilGrid) {
            this.ceilGrid.position.z = (this.ceilGrid.position.z + this.speed * effectiveDelta) % 4;
        }

        // Head tracking updates player hitbox & VR camera parallax
        const head = trackingData.head;
        const targetX = head.x * 2.5; // [-2.5, 2.5]
        const targetY = head.y * 1.5; // [-1.5, 1.5]

        this.playerHitbox.x += (targetX - this.playerHitbox.x) * 0.3;
        this.playerHitbox.y += (targetY - this.playerHitbox.y) * 0.3;
        this.playerHitbox.z = 0;

        // Update player visor indicator
        if (this.playerVisor) {
            this.playerVisor.position.set(this.playerHitbox.x, this.playerHitbox.y, -1.8);
            this.playerVisor.rotation.z += delta * 2;
        }

        // Real-time camera parallax (leans camera subtly with player's head)
        this.camera.position.x = this.playerHitbox.x * 0.45;
        this.camera.position.y = this.playerHitbox.y * 0.35;

        // Spawn obstacles
        this.spawnTimer += effectiveDelta;
        if (this.spawnTimer > 1.3) {
            this.spawnTimer = 0;
            this.spawnObstacle();
        }

        // Update obstacles
        const px = this.playerHitbox.x;
        const py = this.playerHitbox.y;

        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];
            obs.mesh.position.z += this.speed * effectiveDelta;
            const oz = obs.mesh.position.z;

            // Collision check window
            if (obs.active && oz > -1.5 && oz < 1.0) {
                let hit = false;
                let closeCall = false;

                if (obs.type === 'DUCK') {
                    // If player did not duck below minY
                    if (py > obs.minY) {
                        hit = true;
                    } else if (py > obs.minY - 0.25) {
                        closeCall = true;
                    }
                } else if (obs.type === 'LEAN_LEFT' || obs.type === 'LEAN_RIGHT') {
                    if (px >= obs.xRange[0] && px <= obs.xRange[1]) {
                        hit = true;
                    } else if (Math.abs(px - obs.xRange[0]) < 0.3 || Math.abs(px - obs.xRange[1]) < 0.3) {
                        closeCall = true;
                    }
                } else if (obs.type === 'PLASMA_ORB') {
                    const dist = Math.hypot(px - obs.mesh.position.x, py - obs.mesh.position.y);
                    if (dist < obs.radius) {
                        hit = true;
                    } else if (dist < obs.radius + 0.4) {
                        closeCall = true;
                    }
                }

                if (hit) {
                    obs.active = false;
                    this.health = Math.max(0, this.health - 25);
                    if (window.soundFx) window.soundFx.playBombExplosion();
                    this.flashRed();
                } else if (closeCall && !obs.passed && this.bulletTimeTimer <= 0) {
                    // Trigger bullet time!
                    this.bulletTimeTimer = 1.0;
                    obs.passed = true;
                    this.score += 250;
                    if (window.soundFx) {
                        window.soundFx.playBulletTime(true);
                        window.soundFx.playDodgeWhoosh();
                    }
                }
            }

            // Remove passed obstacles
            if (oz > 5.0) {
                this.scene.remove(obs.mesh);
                this.obstacles.splice(i, 1);
            }
        }
    }

    flashRed() {
        const hud = document.getElementById('damage-flash');
        if (hud) {
            hud.style.opacity = '0.7';
            setTimeout(() => { hud.style.opacity = '0'; }, 200);
        }
    }

    stop() {
        this.active = false;
        this.camera.position.set(0, 0, 0);
        if (this.grid) this.scene.remove(this.grid);
        if (this.ceilGrid) this.scene.remove(this.ceilGrid);
        if (this.playerVisor) this.scene.remove(this.playerVisor);

        for (const l of this.lights) this.scene.remove(l);
        for (const o of this.obstacles) this.scene.remove(o.mesh);

        this.obstacles = [];
        this.lights = [];
    }
}
