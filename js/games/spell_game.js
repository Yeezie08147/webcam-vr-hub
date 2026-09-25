/**
 * Spellcaster VR - Hand Gesture Magic Combat Game
 * Cast fireballs with open palms, shoot lightning with pinches, and raise hex shields by crossing wrists!
 */
class SpellcasterGame {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.active = false;
        this.score = 0;
        this.health = 100;
        this.maxHealth = 100;

        this.drones = [];
        this.playerSpells = [];
        this.enemyLasers = [];
        this.particles = [];
        this.spawnTimer = 0;

        this.shieldMesh = null;
        this.shieldActive = false;
        this.lights = [];
        this.cooldowns = { Left: 0, Right: 0, Pinch: 0 };
    }

    start() {
        this.active = true;
        this.score = 0;
        this.health = 100;
        this.drones = [];
        this.playerSpells = [];
        this.enemyLasers = [];
        this.particles = [];
        this.spawnTimer = 0;
        this.cooldowns = { Left: 0, Right: 0, Pinch: 0 };

        this.buildEnvironment();
        this.buildShield();
        if (window.soundFx) window.soundFx.startBgm();
    }

    buildEnvironment() {
        // Sci-Fi Citadel Arena
        const arenaGeo = new THREE.CylinderGeometry(25, 25, 30, 24, 1, true);
        const arenaMat = new THREE.MeshStandardMaterial({
            color: 0x090d1f,
            roughness: 0.8,
            metalness: 0.3,
            side: THREE.BackSide
        });
        this.arena = new THREE.Mesh(arenaGeo, arenaMat);
        this.scene.add(this.arena);

        // Ambient & Rim Lights
        const amb = new THREE.AmbientLight(0x334466, 1.2);
        const rim = new THREE.DirectionalLight(0x8844ff, 1.8);
        rim.position.set(0, 10, -5);
        this.scene.add(amb);
        this.scene.add(rim);
        this.lights.push(amb, rim);
    }

    buildShield() {
        // Hexagonal Prismatic Shield
        const shieldGeo = new THREE.CircleGeometry(2.4, 6);
        const shieldMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            wireframe: true,
            transparent: true,
            opacity: 0.0,
            side: THREE.DoubleSide
        });
        this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
        this.shieldMesh.position.set(0, 0, -2);
        this.scene.add(this.shieldMesh);
    }

    spawnDrone() {
        const droneGroup = new THREE.Group();

        // Core sphere
        const coreGeo = new THREE.SphereGeometry(0.5, 12, 12);
        const coreMat = new THREE.MeshStandardMaterial({
            color: 0xff2200,
            emissive: 0xff0000,
            emissiveIntensity: 0.6,
            metalness: 0.7
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        droneGroup.add(core);

        // Rotating outer ring
        const ringGeo = new THREE.TorusGeometry(0.8, 0.08, 8, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        droneGroup.add(ring);

        // Position in 3D fan in front of player
        const angle = (Math.random() - 0.5) * Math.PI * 0.7;
        const dist = 18 + Math.random() * 8;
        const x = Math.sin(angle) * dist;
        const y = (Math.random() - 0.2) * 4;
        const z = -Math.cos(angle) * dist;

        droneGroup.position.set(x, y, z);
        this.scene.add(droneGroup);

        this.drones.push({
            group: droneGroup,
            ring,
            shootTimer: 1.5 + Math.random() * 2.0,
            hp: 2,
            active: true
        });
    }

    castFireball(handPos, targetVec) {
        const geo = new THREE.SphereGeometry(0.35, 12, 12);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xff7700
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(handPos);

        const light = new THREE.PointLight(0xff7700, 3, 6);
        mesh.add(light);
        this.scene.add(mesh);

        const dir = targetVec.clone().sub(handPos).normalize();
        this.playerSpells.push({
            type: 'FIREBALL',
            mesh,
            vel: dir.multiplyScalar(28),
            life: 2.5
        });

        if (window.soundFx) window.soundFx.playFireballCast();
    }

    castLightning(handPos, targetVec) {
        const geo = new THREE.CylinderGeometry(0.08, 0.08, 3.5, 6);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(handPos);
        mesh.rotation.x = Math.PI / 2;

        this.scene.add(mesh);
        const dir = targetVec.clone().sub(handPos).normalize();
        this.playerSpells.push({
            type: 'LIGHTNING',
            mesh,
            vel: dir.multiplyScalar(42),
            life: 1.2
        });

        if (window.soundFx) window.soundFx.playLightning();
    }

    createExplosion(pos, colorHex) {
        for (let i = 0; i < 25; i++) {
            const geo = new THREE.SphereGeometry(0.08, 6, 6);
            const mat = new THREE.MeshBasicMaterial({
                color: colorHex,
                transparent: true,
                opacity: 1
            });
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(pos);
            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10
            );
            this.scene.add(p);
            this.particles.push({ mesh: p, vel, life: 0.8 });
        }
    }

    update(delta, trackingData) {
        if (!this.active) return;

        // Update cooldowns
        this.cooldowns.Left = Math.max(0, this.cooldowns.Left - delta);
        this.cooldowns.Right = Math.max(0, this.cooldowns.Right - delta);
        this.cooldowns.Pinch = Math.max(0, this.cooldowns.Pinch - delta);

        // Shield activation (hands crossed)
        this.shieldActive = trackingData.handsCrossed;
        if (this.shieldMesh) {
            this.shieldMesh.material.opacity = this.shieldActive ? 0.75 : 0.0;
            this.shieldMesh.rotation.z += delta * 1.5;
        }

        // Gesture detection for casting
        for (const hand of trackingData.hands) {
            const worldX = hand.screenX * 2.8;
            const worldY = hand.screenY * 2.2;
            const handPos = new THREE.Vector3(worldX, worldY, -1.8);
            const targetVec = new THREE.Vector3(worldX * 2.5, worldY * 2.5, -25);

            // 1. Open Palm Fireball
            if (hand.isOpenPalm && !this.shieldActive && this.cooldowns[hand.label] <= 0) {
                this.castFireball(handPos, targetVec);
                this.cooldowns[hand.label] = 0.45;
            }

            // 2. Pinch Lightning Bolt
            if (hand.isPinching && !this.shieldActive && this.cooldowns.Pinch <= 0) {
                this.castLightning(handPos, targetVec);
                this.cooldowns.Pinch = 0.22;
            }
        }

        // Spawn drones
        this.spawnTimer += delta;
        if (this.spawnTimer > 2.2 && this.drones.length < 6) {
            this.spawnTimer = 0;
            this.spawnDrone();
        }

        // Update drones
        for (let i = this.drones.length - 1; i >= 0; i--) {
            const d = this.drones[i];
            d.ring.rotation.x += delta * 2;
            d.ring.rotation.y += delta * 3;

            // Hover bobbing
            d.group.position.y += Math.sin(performance.now() * 0.003 + i) * 0.01;

            // Drone shooting
            d.shootTimer -= delta;
            if (d.shootTimer <= 0) {
                d.shootTimer = 2.0 + Math.random() * 1.5;
                // Shoot laser towards player (0, 0, 0)
                const laserGeo = new THREE.SphereGeometry(0.2, 8, 8);
                const laserMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
                const laser = new THREE.Mesh(laserGeo, laserMat);
                laser.position.copy(d.group.position);
                this.scene.add(laser);

                const dir = new THREE.Vector3(0, 0, 0).sub(d.group.position).normalize();
                this.enemyLasers.push({
                    mesh: laser,
                    vel: dir.multiplyScalar(15),
                    life: 3.0
                });
            }
        }

        // Update player spells
        for (let i = this.playerSpells.length - 1; i >= 0; i--) {
            const spell = this.playerSpells[i];
            spell.mesh.position.addScaledVector(spell.vel, delta);
            spell.life -= delta;

            // Check hit against drones
            for (let j = this.drones.length - 1; j >= 0; j--) {
                const drone = this.drones[j];
                if (spell.mesh.position.distanceTo(drone.group.position) < 1.4) {
                    drone.hp -= (spell.type === 'FIREBALL' ? 2 : 1);
                    this.createExplosion(spell.mesh.position, spell.type === 'FIREBALL' ? 0xff7700 : 0x00f3ff);

                    if (drone.hp <= 0) {
                        this.scene.remove(drone.group);
                        this.drones.splice(j, 1);
                        this.score += 250;
                        if (window.soundFx) window.soundFx.playBombExplosion();
                    }
                    spell.life = 0;
                    break;
                }
            }

            if (spell.life <= 0) {
                this.scene.remove(spell.mesh);
                this.playerSpells.splice(i, 1);
            }
        }

        // Update enemy lasers
        for (let i = this.enemyLasers.length - 1; i >= 0; i--) {
            const laser = this.enemyLasers[i];
            laser.mesh.position.addScaledVector(laser.vel, delta);
            laser.life -= delta;

            // Deflected by shield?
            if (this.shieldActive && laser.mesh.position.z > -2.3 && laser.mesh.position.z < -1.5) {
                if (Math.hypot(laser.mesh.position.x, laser.mesh.position.y) < 2.3) {
                    // Deflect!
                    this.createExplosion(laser.mesh.position, 0x00ffff);
                    if (window.soundFx) window.soundFx.playShield();
                    laser.life = 0;
                    this.score += 50;
                }
            } else if (laser.mesh.position.z > 0.0) {
                // Hit player!
                this.health = Math.max(0, this.health - 15);
                this.createExplosion(laser.mesh.position, 0xff0055);
                if (window.soundFx) window.soundFx.playBombExplosion();
                laser.life = 0;
            }

            if (laser.life <= 0) {
                this.scene.remove(laser.mesh);
                this.enemyLasers.splice(i, 1);
            }
        }

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.mesh.position.addScaledVector(p.vel, delta);
            p.life -= delta * 1.5;
            p.mesh.material.opacity = p.life;
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.particles.splice(i, 1);
            }
        }
    }

    stop() {
        this.active = false;
        if (this.arena) this.scene.remove(this.arena);
        if (this.shieldMesh) this.scene.remove(this.shieldMesh);

        for (const l of this.lights) this.scene.remove(l);
        for (const d of this.drones) this.scene.remove(d.group);
        for (const s of this.playerSpells) this.scene.remove(s.mesh);
        for (const el of this.enemyLasers) this.scene.remove(el.mesh);
        for (const p of this.particles) this.scene.remove(p.mesh);

        this.drones = [];
        this.playerSpells = [];
        this.enemyLasers = [];
        this.particles = [];
        this.lights = [];
    }
}
