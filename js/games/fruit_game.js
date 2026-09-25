/**
 * BladeFruit VR - Motion Blade Fruit Slicing Game
 * Slice flying 3D fruits with your hands leaving neon plasma blade trails, avoid bombs!
 */
class BladeFruitGame {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.active = false;
        this.score = 0;
        this.combo = 0;
        this.strikes = 0;
        this.maxStrikes = 3;

        this.fruits = [];
        this.slicedHalves = [];
        this.juiceParticles = [];
        this.bladeTrails = { Left: [], Right: [] };
        this.spawnTimer = 0;
        this.lights = [];

        this.handMeshes = { Left: null, Right: null };
        this.prevHandPos = { Left: null, Right: null };
    }

    start() {
        this.active = true;
        this.score = 0;
        this.combo = 0;
        this.strikes = 0;
        this.fruits = [];
        this.slicedHalves = [];
        this.juiceParticles = [];
        this.spawnTimer = 0;

        this.buildEnvironment();
        this.buildHandBlades();
        if (window.soundFx) window.soundFx.startBgm();
    }

    buildEnvironment() {
        // Dojo Dojo / Cyber Kitchen backdrop
        const wallGeo = new THREE.PlaneGeometry(30, 20);
        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x111625,
            roughness: 0.6,
            metalness: 0.2
        });
        const wall = new THREE.Mesh(wallGeo, wallMat);
        wall.position.set(0, 2, -12);
        this.scene.add(wall);
        this.wall = wall;

        // Wooden / Carbon cutting counter
        const counterGeo = new THREE.BoxGeometry(18, 1, 6);
        const counterMat = new THREE.MeshStandardMaterial({
            color: 0x1a120b,
            roughness: 0.4
        });
        const counter = new THREE.Mesh(counterGeo, counterMat);
        counter.position.set(0, -3.5, -4);
        this.scene.add(counter);
        this.counter = counter;

        // Lights
        const amb = new THREE.AmbientLight(0xffffff, 1.2);
        const spot = new THREE.SpotLight(0xffeedd, 2.5);
        spot.position.set(0, 10, 2);
        this.scene.add(amb);
        this.scene.add(spot);
        this.lights.push(amb, spot);
    }

    buildHandBlades() {
        // Glowing Energy Blades on hands
        ['Left', 'Right'].forEach(side => {
            const group = new THREE.Group();
            const color = side === 'Right' ? 0x00f3ff : 0xff0055;

            const bladeGeo = new THREE.ConeGeometry(0.12, 1.2, 8);
            const bladeMat = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.85
            });
            const mesh = new THREE.Mesh(bladeGeo, bladeMat);
            mesh.rotation.x = Math.PI / 2;
            group.add(mesh);

            this.scene.add(group);
            this.handMeshes[side] = group;
        });
    }

    spawnFruitWave() {
        const count = 1 + Math.floor(Math.random() * 3);
        const types = [
            { name: 'WATERMELON', color: 0x22aa33, innerColor: 0xff2244, radius: 0.55 },
            { name: 'ORANGE', color: 0xff8800, innerColor: 0xffbb00, radius: 0.45 },
            { name: 'APPLE', color: 0xee2222, innerColor: 0xffffee, radius: 0.4 },
            { name: 'STAR', color: 0xffdd00, innerColor: 0xffffff, radius: 0.35, isSpecial: true },
            { name: 'BOMB', color: 0x222222, innerColor: 0xff0000, radius: 0.5, isBomb: true }
        ];

        for (let i = 0; i < count; i++) {
            const t = types[Math.floor(Math.random() * types.length)];
            const geo = t.isSpecial
                ? new THREE.OctahedronGeometry(t.radius)
                : new THREE.SphereGeometry(t.radius, 14, 14);

            const mat = new THREE.MeshStandardMaterial({
                color: t.color,
                roughness: 0.3,
                emissive: t.isBomb ? 0x550000 : 0x000000
            });
            const mesh = new THREE.Mesh(geo, mat);

            // Spawn below screen and toss upward
            const startX = (Math.random() - 0.5) * 4.0;
            const startY = -4.5;
            const startZ = -3.5 - Math.random() * 1.5;
            mesh.position.set(startX, startY, startZ);

            const velX = -startX * (0.8 + Math.random() * 0.5);
            const velY = 11 + Math.random() * 3.5;
            const velZ = (Math.random() - 0.5) * 1.5;

            this.scene.add(mesh);
            this.fruits.push({
                info: t,
                mesh,
                vel: new THREE.Vector3(velX, velY, velZ),
                rot: new THREE.Vector3(Math.random() * 4, Math.random() * 4, Math.random() * 4),
                sliced: false
            });
        }
    }

    createJuiceSplash(pos, colorHex) {
        for (let i = 0; i < 20; i++) {
            const geo = new THREE.SphereGeometry(0.06, 6, 6);
            const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 1 });
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(pos);
            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 8
            );
            this.scene.add(p);
            this.juiceParticles.push({ mesh: p, vel, life: 0.6 });
        }
    }

    createHalves(pos, fruitInfo) {
        const halfGeo = new THREE.SphereGeometry(fruitInfo.radius, 12, 6, 0, Math.PI);
        const mat = new THREE.MeshStandardMaterial({ color: fruitInfo.innerColor, roughness: 0.2 });

        const p1 = new THREE.Mesh(halfGeo, mat);
        p1.position.copy(pos);
        const p2 = new THREE.Mesh(halfGeo, mat);
        p2.position.copy(pos);
        p2.rotation.y = Math.PI;

        this.scene.add(p1);
        this.scene.add(p2);

        this.slicedHalves.push({
            mesh: p1,
            vel: new THREE.Vector3(-2 - Math.random() * 2, 2 + Math.random() * 2, 0),
            life: 1.2
        });
        this.slicedHalves.push({
            mesh: p2,
            vel: new THREE.Vector3(2 + Math.random() * 2, 2 + Math.random() * 2, 0),
            life: 1.2
        });
    }

    update(delta, trackingData) {
        if (!this.active) return;

        // Position hand blades from tracking
        const currentHands = {};
        for (const hand of trackingData.hands) {
            currentHands[hand.label] = hand;
            const mesh = this.handMeshes[hand.label];
            if (mesh) {
                const targetPos = new THREE.Vector3(hand.screenX * 3.0, hand.screenY * 2.2, -3.5);
                mesh.position.lerp(targetPos, 0.5);

                // True 3D wrist & hand orientation for energy blade
                if (hand.orientation && hand.orientation.matrix) {
                    const rotMat = new THREE.Matrix4().fromArray(hand.orientation.matrix);
                    const targetQuat = new THREE.Quaternion().setFromRotationMatrix(rotMat);
                    mesh.quaternion.slerp(targetQuat, 0.6);
                }

                // Check slicing against fruits if moving fast enough
                const speed = hand.velocity ? hand.velocity.speed : 0;
                if (speed > 0.4 || true) {
                    this.checkFruitCollisions(mesh.position, hand.label);
                }
            }
        }

        // Hide unseen hand blades with persistence
        ['Left', 'Right'].forEach(side => {
            if (!currentHands[side]) {
                this.bladeLostTimers = this.bladeLostTimers || {};
                this.bladeLostTimers[side] = (this.bladeLostTimers[side] || 0) + delta;
                if (this.bladeLostTimers[side] > 0.35 && this.handMeshes[side]) {
                    this.handMeshes[side].position.set(99, 99, 0);
                }
            } else if (this.bladeLostTimers) {
                this.bladeLostTimers[side] = 0;
            }
        });

        // Spawn waves
        this.spawnTimer += delta;
        if (this.spawnTimer > 2.0) {
            this.spawnTimer = 0;
            this.spawnFruitWave();
        }

        // Update fruits physics
        for (let i = this.fruits.length - 1; i >= 0; i--) {
            const f = this.fruits[i];
            f.vel.y -= 14 * delta; // Gravity
            f.mesh.position.addScaledVector(f.vel, delta);
            f.mesh.rotation.x += f.rot.x * delta;
            f.mesh.rotation.y += f.rot.y * delta;

            // Missed normal fruit falling below screen
            if (f.mesh.position.y < -5.0) {
                if (!f.info.isBomb && !f.sliced) {
                    this.strikes++;
                    if (this.strikes >= this.maxStrikes) {
                        // Game over trigger if needed
                    }
                }
                this.scene.remove(f.mesh);
                this.fruits.splice(i, 1);
            }
        }

        // Update sliced halves
        for (let i = this.slicedHalves.length - 1; i >= 0; i--) {
            const h = this.slicedHalves[i];
            h.vel.y -= 16 * delta;
            h.mesh.position.addScaledVector(h.vel, delta);
            h.life -= delta;
            if (h.life <= 0) {
                this.scene.remove(h.mesh);
                this.slicedHalves.splice(i, 1);
            }
        }

        // Update juice
        for (let i = this.juiceParticles.length - 1; i >= 0; i--) {
            const j = this.juiceParticles[i];
            j.vel.y -= 14 * delta;
            j.mesh.position.addScaledVector(j.vel, delta);
            j.life -= delta * 1.6;
            j.mesh.material.opacity = j.life;
            if (j.life <= 0) {
                this.scene.remove(j.mesh);
                this.juiceParticles.splice(i, 1);
            }
        }
    }

    checkFruitCollisions(bladePos, handSide) {
        for (let i = this.fruits.length - 1; i >= 0; i--) {
            const f = this.fruits[i];
            if (f.sliced) continue;

            const dist = bladePos.distanceTo(f.mesh.position);
            if (dist < f.info.radius + 0.5) {
                f.sliced = true;

                if (f.info.isBomb) {
                    // Exploded bomb!
                    this.strikes = Math.min(this.maxStrikes, this.strikes + 1);
                    this.score = Math.max(0, this.score - 200);
                    if (window.soundFx) window.soundFx.playBombExplosion();
                    this.createJuiceSplash(f.mesh.position, 0xff2200);
                } else {
                    // Sliced fruit!
                    this.score += (f.info.isSpecial ? 300 : 100);
                    if (window.soundFx) window.soundFx.playFruitSlice();
                    this.createJuiceSplash(f.mesh.position, f.info.innerColor);
                    this.createHalves(f.mesh.position, f.info);
                }

                this.scene.remove(f.mesh);
                this.fruits.splice(i, 1);
            }
        }
    }

    stop() {
        this.active = false;
        if (this.wall) this.scene.remove(this.wall);
        if (this.counter) this.scene.remove(this.counter);
        if (this.handMeshes.Left) this.scene.remove(this.handMeshes.Left);
        if (this.handMeshes.Right) this.scene.remove(this.handMeshes.Right);

        for (const l of this.lights) this.scene.remove(l);
        for (const f of this.fruits) this.scene.remove(f.mesh);
        for (const h of this.slicedHalves) this.scene.remove(h.mesh);
        for (const p of this.juiceParticles) this.scene.remove(p.mesh);

        this.fruits = [];
        this.slicedHalves = [];
        this.juiceParticles = [];
        this.lights = [];
    }
}
