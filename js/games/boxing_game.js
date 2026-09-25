/**
 * CyberBoxing VR (ShadowStrike) - Motion VR Boxing & Sparring Game
 * Punch with jabs, hooks, and uppercuts using real hand velocity & orientation!
 */
class CyberBoxingGame {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.active = false;
        this.score = 0;
        this.combo = 0;
        this.health = 100;
        this.maxHealth = 100;
        this.punchPower = 0;

        this.gloves = { Left: null, Right: null };
        this.prevPos = { Left: new THREE.Vector3(), Right: new THREE.Vector3() };
        this.droid = null;
        this.ringGroup = new THREE.Group();
        this.sparks = [];
        this.lights = [];

        this.targetZones = [];
        this.activeTargetIndex = 0;
        this.droidPunchTimer = 0;
        this.droidIncomingPunch = null;
        this.roundTimer = 60;
    }

    start() {
        this.active = true;
        this.score = 0;
        this.combo = 0;
        this.health = 100;
        this.sparks = [];
        this.roundTimer = 60;

        this.buildRing();
        this.buildGloves();
        this.buildSparringDroid();

        if (window.soundFx) {
            window.soundFx.playBoxingBell();
            window.soundFx.startBgm();
        }
    }

    buildRing() {
        this.ringGroup = new THREE.Group();

        // Canvas Floor
        const floorGeo = new THREE.PlaneGeometry(16, 16);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x090f20,
            roughness: 0.3,
            metalness: 0.5
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -2.2;
        this.ringGroup.add(floor);

        // Ring Ropes (3 levels)
        [-0.5, 0.4, 1.3].forEach((y) => {
            const ropeGeo = new THREE.TorusGeometry(7.5, 0.05, 8, 4);
            const ropeMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
            const rope = new THREE.Mesh(ropeGeo, ropeMat);
            rope.rotation.x = Math.PI / 2;
            rope.position.y = y;
            this.ringGroup.add(rope);
        });

        // Corner Posts
        const postGeo = new THREE.CylinderGeometry(0.2, 0.2, 4.5, 12);
        const postMat = new THREE.MeshStandardMaterial({ color: 0xff0055, metalness: 0.8 });
        [[-5, -5], [-5, 5], [5, -5], [5, 5]].forEach(([x, z]) => {
            const post = new THREE.Mesh(postGeo, postMat);
            post.position.set(x, 0, z);
            this.ringGroup.add(post);
        });

        // Overhead Arena Spotlights
        const spot1 = new THREE.SpotLight(0xffffff, 2.5);
        spot1.position.set(0, 8, 0);
        spot1.target.position.set(0, 0, -3);
        const amb = new THREE.AmbientLight(0x223355, 1.4);
        this.ringGroup.add(spot1, spot1.target, amb);
        this.lights.push(spot1, amb);

        this.scene.add(this.ringGroup);
    }

    buildGloves() {
        ['Left', 'Right'].forEach((side) => {
            const group = new THREE.Group();
            const color = (side === 'Right') ? 0x00f3ff : 0xff0055;

            // Main Glove Fist
            const gloveGeo = new THREE.SphereGeometry(0.35, 14, 14);
            gloveGeo.scale(1.0, 1.25, 1.4);
            const gloveMat = new THREE.MeshStandardMaterial({
                color: color,
                roughness: 0.2,
                metalness: 0.6,
                emissive: color,
                emissiveIntensity: 0.3
            });
            const glove = new THREE.Mesh(gloveGeo, gloveMat);
            group.add(glove);

            // Wrist Cuff
            const cuffGeo = new THREE.CylinderGeometry(0.26, 0.28, 0.3, 14);
            const cuffMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8 });
            const cuff = new THREE.Mesh(cuffGeo, cuffMat);
            cuff.rotation.x = Math.PI / 2;
            cuff.position.z = 0.45;
            group.add(cuff);

            // Glow knuckle plates
            const plateGeo = new THREE.BoxGeometry(0.4, 0.12, 0.15);
            const plateMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const plate = new THREE.Mesh(plateGeo, plateMat);
            plate.position.set(0, 0.1, -0.42);
            group.add(plate);

            group.position.set(0, -99, 0);
            this.scene.add(group);
            this.gloves[side] = group;
        });
    }

    buildSparringDroid() {
        const droidGroup = new THREE.Group();
        droidGroup.position.set(0, 0, -3.2);

        // Head / Visor
        const headGeo = new THREE.SphereGeometry(0.45, 14, 14);
        const headMat = new THREE.MeshStandardMaterial({ color: 0x222a3a, metalness: 0.8, roughness: 0.2 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.3;
        droidGroup.add(head);

        const visorGeo = new THREE.BoxGeometry(0.6, 0.18, 0.35);
        const visorMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
        const visor = new THREE.Mesh(visorGeo, visorMat);
        visor.position.set(0, 1.3, 0.32);
        droidGroup.add(visor);

        // Torso / Chest Plate
        const torsoGeo = new THREE.CylinderGeometry(0.65, 0.45, 1.4, 8);
        const torsoMat = new THREE.MeshStandardMaterial({ color: 0x151d2f, metalness: 0.7, roughness: 0.3 });
        const torso = new THREE.Mesh(torsoGeo, torsoMat);
        torso.position.y = 0.1;
        droidGroup.add(torso);

        // Target Hit Zones (Head, Left Rib, Right Rib, Chest)
        this.targetZones = [
            { name: 'HEAD', pos: new THREE.Vector3(0, 1.3, -2.8), radius: 0.5, mesh: null },
            { name: 'CHEST', pos: new THREE.Vector3(0, 0.3, -2.8), radius: 0.6, mesh: null },
            { name: 'LEFT_HOOK', pos: new THREE.Vector3(-0.7, 0.4, -2.9), radius: 0.5, mesh: null },
            { name: 'RIGHT_HOOK', pos: new THREE.Vector3(0.7, 0.4, -2.9), radius: 0.5, mesh: null }
        ];

        // Hit indicator ring
        const targetRingGeo = new THREE.RingGeometry(0.2, 0.35, 16);
        const targetRingMat = new THREE.MeshBasicMaterial({ color: 0xffe600, side: THREE.DoubleSide });
        this.targetRing = new THREE.Mesh(targetRingGeo, targetRingMat);
        this.scene.add(this.targetRing);
        this.pickNewTarget();

        this.scene.add(droidGroup);
        this.droid = droidGroup;
    }

    pickNewTarget() {
        this.activeTargetIndex = Math.floor(Math.random() * this.targetZones.length);
        const target = this.targetZones[this.activeTargetIndex];
        if (this.targetRing) {
            this.targetRing.position.copy(target.pos);
            this.targetRing.position.z += 0.2;
        }
    }

    createSparks(pos, colorHex) {
        for (let i = 0; i < 28; i++) {
            const geo = new THREE.SphereGeometry(0.045, 6, 6);
            const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 1 });
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(pos);
            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 8
            );
            this.scene.add(p);
            this.sparks.push({ mesh: p, vel, life: 0.6 });
        }
    }

    update(delta, trackingData) {
        if (!this.active) return;

        // Droid breathing / bobbing animation
        if (this.droid) {
            this.droid.position.y = Math.sin(performance.now() * 0.004) * 0.08;
            this.droid.rotation.y = Math.sin(performance.now() * 0.002) * 0.15;
        }

        if (this.targetRing) {
            this.targetRing.rotation.z += delta * 3;
        }

        // Update Boxing Gloves
        let leftActive = false;
        let rightActive = false;

        for (const hand of trackingData.hands) {
            const glove = this.gloves[hand.label];
            if (!glove) continue;

            if (hand.label === 'Left') leftActive = true;
            else rightActive = true;

            const worldX = hand.screenX * 2.8;
            const worldY = hand.screenY * 2.2;
            const worldZ = -1.8 - (hand.palm.z || 0) * 3;
            const targetPos = new THREE.Vector3(worldX, worldY, worldZ);

            glove.position.lerp(targetPos, 0.65);

            // True Hand Orientation: rotate glove with real wrist & hand
            if (hand.orientation && hand.orientation.matrix) {
                const rotMat = new THREE.Matrix4().fromArray(hand.orientation.matrix);
                const targetQuat = new THREE.Quaternion().setFromRotationMatrix(rotMat);
                // Glove faces outward/forward
                const offsetQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
                targetQuat.multiply(offsetQuat);
                glove.quaternion.slerp(targetQuat, 0.5);
            }

            // Detect Punch Strike
            const speed = hand.velocity ? hand.velocity.speed : 0;
            this.punchPower = Math.round(speed * 350); // Watt power gauge

            if (speed > 1.4) {
                this.checkPunchHit(glove.position, hand.label, speed);
            }

            this.prevPos[hand.label].copy(glove.position);
        }

        if (!leftActive) {
            this.leftLostTimer = (this.leftLostTimer || 0) + delta;
            if (this.leftLostTimer > 0.35 && this.gloves.Left) {
                this.gloves.Left.position.set(-99, -99, 0);
            }
        } else {
            this.leftLostTimer = 0;
        }

        if (!rightActive) {
            this.rightLostTimer = (this.rightLostTimer || 0) + delta;
            if (this.rightLostTimer > 0.35 && this.gloves.Right) {
                this.gloves.Right.position.set(99, 99, 0);
            }
        } else {
            this.rightLostTimer = 0;
        }

        // Update Sparks
        for (let i = this.sparks.length - 1; i >= 0; i--) {
            const s = this.sparks[i];
            s.mesh.position.addScaledVector(s.vel, delta);
            s.life -= delta * 1.8;
            s.mesh.material.opacity = s.life;
            if (s.life <= 0) {
                this.scene.remove(s.mesh);
                this.sparks.splice(i, 1);
            }
        }
    }

    checkPunchHit(glovePos, side, speed) {
        const target = this.targetZones[this.activeTargetIndex];
        if (!target) return;

        const dist = glovePos.distanceTo(target.pos);
        if (dist < target.radius + 0.3) {
            // Hit!
            const colorHex = (side === 'Right') ? 0x00f3ff : 0xff0055;
            this.combo++;
            const points = Math.round(150 * (1 + speed * 0.5));
            this.score += points;

            if (window.soundFx) {
                window.soundFx.playPunchImpact(speed);
            }

            this.createSparks(target.pos, colorHex);

            // Droid recoil
            if (this.droid) {
                this.droid.position.z -= 0.35;
                setTimeout(() => {
                    if (this.droid) this.droid.position.z = -3.2;
                }, 120);
            }

            this.pickNewTarget();
        }
    }

    stop() {
        this.active = false;
        if (this.ringGroup) this.scene.remove(this.ringGroup);
        if (this.droid) this.scene.remove(this.droid);
        if (this.targetRing) this.scene.remove(this.targetRing);
        if (this.gloves.Left) this.scene.remove(this.gloves.Left);
        if (this.gloves.Right) this.scene.remove(this.gloves.Right);

        for (const l of this.lights) this.scene.remove(l);
        for (const s of this.sparks) this.scene.remove(s.mesh);

        this.sparks = [];
        this.lights = [];
    }
}
