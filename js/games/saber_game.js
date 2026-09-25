/**
 * SaberStorm VR - Rhythm & Light-Saber Slicing Game
 * Red and Blue lightsabers attached to your real hands slicing rhythmic cubes!
 */
class SaberStormGame {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.active = false;
        this.score = 0;
        this.combo = 0;
        this.multiplier = 1;
        this.health = 100;
        this.maxHealth = 100;
        
        this.blocks = [];
        this.cutPieces = [];
        this.sparks = [];
        this.spawnTimer = 0;
        this.bpm = 124;
        this.speed = 18; // units per second towards camera

        this.leftSaber = null;
        this.rightSaber = null;
        this.tunnel = null;
        this.lights = [];

        this.prevLeftPos = new THREE.Vector3();
        this.prevRightPos = new THREE.Vector3();
    }

    start() {
        this.active = true;
        this.score = 0;
        this.combo = 0;
        this.multiplier = 1;
        this.health = 100;
        this.blocks = [];
        this.cutPieces = [];
        this.sparks = [];

        this.buildEnvironment();
        this.buildSabers();
        if (window.soundFx) window.soundFx.startBgm();
    }

    buildEnvironment() {
        // Neon grid tunnel
        const tunnelGeo = new THREE.CylinderGeometry(14, 14, 120, 16, 20, true);
        const tunnelMat = new THREE.MeshBasicMaterial({
            color: 0x0a1030,
            wireframe: true,
            transparent: true,
            opacity: 0.35,
            side: THREE.BackSide
        });
        this.tunnel = new THREE.Mesh(tunnelGeo, tunnelMat);
        this.tunnel.rotation.x = Math.PI / 2;
        this.tunnel.position.z = -50;
        this.scene.add(this.tunnel);

        // Platform
        const platGeo = new THREE.BoxGeometry(6, 0.4, 20);
        const platMat = new THREE.MeshStandardMaterial({
            color: 0x050815,
            roughness: 0.2,
            metalness: 0.8
        });
        this.platform = new THREE.Mesh(platGeo, platMat);
        this.platform.position.set(0, -2, -6);
        this.scene.add(this.platform);

        // Ambient and directional light
        const amb = new THREE.AmbientLight(0x223355, 1.2);
        const dir = new THREE.DirectionalLight(0xffffff, 1.5);
        dir.position.set(0, 15, 10);
        this.scene.add(amb);
        this.scene.add(dir);
        this.lights.push(amb, dir);
    }

    buildSabers() {
        // Red Saber (Left)
        this.leftSaber = this.createSaberMesh(0xff0055, 0xff7799);
        this.scene.add(this.leftSaber);

        // Blue Saber (Right)
        this.rightSaber = this.createSaberMesh(0x00f3ff, 0x88ffff);
        this.scene.add(this.rightSaber);
    }

    createSaberMesh(coreColor, glowColor) {
        const group = new THREE.Group();

        // Hilt
        const hiltGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.5, 16);
        const hiltMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.2 });
        const hilt = new THREE.Mesh(hiltGeo, hiltMat);
        hilt.position.y = -0.25;
        group.add(hilt);

        // Blade Core
        const bladeGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.6, 16);
        const bladeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.y = 0.8;
        group.add(blade);

        // Blade Outer Glow
        const glowGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.62, 16);
        const glowMat = new THREE.MeshBasicMaterial({
            color: coreColor,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.y = 0.8;
        group.add(glow);

        // Point Light
        const pLight = new THREE.PointLight(coreColor, 2.5, 5);
        pLight.position.y = 1.0;
        group.add(pLight);

        // Hide initially until hand is seen
        group.position.set(0, -999, 0);
        return group;
    }

    spawnBeatBlock() {
        // Random lane: -1.8, -0.6, 0.6, 1.8
        const lanes = [-1.8, -0.6, 0.6, 1.8];
        const heights = [-0.6, 0.4, 1.4];
        const lane = lanes[Math.floor(Math.random() * lanes.length)];
        const height = heights[Math.floor(Math.random() * heights.length)];
        
        // Hand type: Left (Red) or Right (Blue)
        const isRight = Math.random() > 0.5;
        const color = isRight ? 0x00f3ff : 0xff0055;
        const dirTypes = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'DOT'];
        const dir = dirTypes[Math.floor(Math.random() * dirTypes.length)];

        const size = 0.65;
        const geo = new THREE.BoxGeometry(size, size, size);
        const mat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.15,
            metalness: 0.3,
            emissive: color,
            emissiveIntensity: 0.35
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(lane, height, -45);

        // Arrow or center indicator
        const arrowGeo = new THREE.ConeGeometry(0.18, 0.35, 4);
        const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const arrow = new THREE.Mesh(arrowGeo, arrowMat);
        arrow.position.z = 0.34;

        if (dir === 'UP') arrow.rotation.z = 0;
        else if (dir === 'DOWN') arrow.rotation.z = Math.PI;
        else if (dir === 'LEFT') arrow.rotation.z = Math.PI / 2;
        else if (dir === 'RIGHT') arrow.rotation.z = -Math.PI / 2;
        else arrow.scale.set(0.6, 0.6, 0.6);

        mesh.add(arrow);

        this.scene.add(mesh);
        this.blocks.push({
            mesh,
            isRight,
            dir,
            active: true
        });
    }

    createSparks(pos, colorHex) {
        const count = 30;
        for (let i = 0; i < count; i++) {
            const geo = new THREE.SphereGeometry(0.04, 6, 6);
            const mat = new THREE.MeshBasicMaterial({
                color: colorHex,
                transparent: true,
                opacity: 1,
                blending: THREE.AdditiveBlending
            });
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(pos);
            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 8 + 2,
                (Math.random() - 0.5) * 8
            );
            this.scene.add(p);
            this.sparks.push({ mesh: p, vel, life: 1.0 });
        }
    }

    createCutHalves(pos, colorHex, cutDir) {
        const halfGeo = new THREE.BoxGeometry(0.6, 0.3, 0.6);
        const mat = new THREE.MeshStandardMaterial({
            color: colorHex,
            roughness: 0.2,
            emissive: colorHex,
            emissiveIntensity: 0.4
        });

        const p1 = new THREE.Mesh(halfGeo, mat);
        p1.position.copy(pos);
        p1.position.y += 0.15;

        const p2 = new THREE.Mesh(halfGeo, mat);
        p2.position.copy(pos);
        p2.position.y -= 0.15;

        this.scene.add(p1);
        this.scene.add(p2);

        this.cutPieces.push({
            mesh: p1,
            vel: new THREE.Vector3(Math.random() * 2 - 1, 3 + Math.random() * 2, -2),
            rot: new THREE.Vector3(Math.random() * 8, Math.random() * 8, 0),
            life: 1.2
        });

        this.cutPieces.push({
            mesh: p2,
            vel: new THREE.Vector3(Math.random() * 2 - 1, -2 - Math.random() * 2, -2),
            rot: new THREE.Vector3(Math.random() * 8, Math.random() * 8, 0),
            life: 1.2
        });
    }

    update(delta, trackingData) {
        if (!this.active) return;

        // Animate tunnel
        if (this.tunnel) {
            this.tunnel.rotation.z += delta * 0.15;
        }

        // Update Sabers from tracking hands
        let leftSeen = false;
        let rightSeen = false;

        for (const hand of trackingData.hands) {
            // Map 2D/3D tracking coordinate to 3D world space
            // Screen bounds roughly [-3.5, 3.5] in X, [-2, 2.5] in Y, [-3, -1] in Z
            const worldX = hand.screenX * 2.8;
            const worldY = hand.screenY * 2.2 + 0.2;
            const worldZ = -2.2 - (hand.palm.z || 0) * 3;

            const targetPos = new THREE.Vector3(worldX, worldY, worldZ);

            const saber = (hand.label === 'Left') ? this.leftSaber : this.rightSaber;
            const prevPos = (hand.label === 'Left') ? this.prevLeftPos : this.prevRightPos;

            if (saber) {
                if (hand.label === 'Left') leftSeen = true;
                else rightSeen = true;

                saber.position.lerp(targetPos, 0.75);

                // True 3D wrist & hand orientation
                if (hand.orientation && hand.orientation.matrix) {
                    const rotMat = new THREE.Matrix4().fromArray(hand.orientation.matrix);
                    const targetQuat = new THREE.Quaternion().setFromRotationMatrix(rotMat);
                    // Blade points forward and upward along grip
                    const tiltAxis = new THREE.Vector3(1, 0, 0);
                    const offsetQuat = new THREE.Quaternion().setFromAxisAngle(tiltAxis, -Math.PI / 3.2);
                    targetQuat.multiply(offsetQuat);
                    saber.quaternion.slerp(targetQuat, 0.65);
                } else {
                    const dPos = saber.position.clone().sub(prevPos);
                    saber.rotation.z = -dPos.x * 3.5;
                    saber.rotation.x = -Math.PI / 4 + dPos.y * 3.5;
                }
                prevPos.copy(saber.position);

                if (hand.velocity && hand.velocity.speed > 1.2 && Math.random() < 0.2) {
                    if (window.soundFx) window.soundFx.playSaberSwing(hand.velocity.speed);
                }
            }
        }

        if (!leftSeen) {
            this.leftLostTimer = (this.leftLostTimer || 0) + delta;
            if (this.leftLostTimer > 0.35 && this.leftSaber) {
                this.leftSaber.position.set(-99, -99, 0);
            }
        } else {
            this.leftLostTimer = 0;
        }

        if (!rightSeen) {
            this.rightLostTimer = (this.rightLostTimer || 0) + delta;
            if (this.rightLostTimer > 0.35 && this.rightSaber) {
                this.rightSaber.position.set(99, 99, 0);
            }
        } else {
            this.rightLostTimer = 0;
        }

        // Spawn blocks
        this.spawnTimer += delta;
        const spawnInterval = 60 / this.bpm; // ~0.48s
        if (this.spawnTimer >= spawnInterval) {
            this.spawnTimer = 0;
            this.spawnBeatBlock();
        }

        // Update blocks & check saber collisions
        for (let i = this.blocks.length - 1; i >= 0; i--) {
            const b = this.blocks[i];
            b.mesh.position.z += this.speed * delta;

            // Check slicing collision with sabers
            const bPos = b.mesh.position;
            const hitDist = 1.1;

            if (b.active && bPos.z > -4.5 && bPos.z < 0.5) {
                // Left saber check
                if (!b.isRight && leftSeen) {
                    const dist = this.leftSaber.position.distanceTo(bPos);
                    if (dist < hitDist) {
                        this.sliceBlock(b, false);
                        this.blocks.splice(i, 1);
                        continue;
                    }
                }
                // Right saber check
                if (b.isRight && rightSeen) {
                    const dist = this.rightSaber.position.distanceTo(bPos);
                    if (dist < hitDist) {
                        this.sliceBlock(b, true);
                        this.blocks.splice(i, 1);
                        continue;
                    }
                }
            }

            // Missed note
            if (bPos.z > 2.0) {
                this.scene.remove(b.mesh);
                this.blocks.splice(i, 1);
                this.combo = 0;
                this.multiplier = 1;
                this.health = Math.max(0, this.health - 6);
            }
        }

        // Update cut pieces
        for (let i = this.cutPieces.length - 1; i >= 0; i--) {
            const piece = this.cutPieces[i];
            piece.vel.y -= 9.8 * delta;
            piece.mesh.position.addScaledVector(piece.vel, delta);
            piece.mesh.rotation.x += piece.rot.x * delta;
            piece.mesh.rotation.y += piece.rot.y * delta;
            piece.life -= delta;
            if (piece.life <= 0) {
                this.scene.remove(piece.mesh);
                this.cutPieces.splice(i, 1);
            }
        }

        // Update spark particles
        for (let i = this.sparks.length - 1; i >= 0; i--) {
            const s = this.sparks[i];
            s.vel.y -= 12 * delta;
            s.mesh.position.addScaledVector(s.vel, delta);
            s.life -= delta * 1.5;
            s.mesh.material.opacity = s.life;
            if (s.life <= 0) {
                this.scene.remove(s.mesh);
                this.sparks.splice(i, 1);
            }
        }
    }

    sliceBlock(b, isRight) {
        b.active = false;
        const colorHex = isRight ? 0x00f3ff : 0xff0055;

        this.combo++;
        this.multiplier = Math.min(8, 1 + Math.floor(this.combo / 8));
        this.score += 100 * this.multiplier;
        this.health = Math.min(this.maxHealth, this.health + 4);

        if (window.soundFx) window.soundFx.playSaberHit(isRight);

        this.createSparks(b.mesh.position, colorHex);
        this.createCutHalves(b.mesh.position, colorHex, b.dir);
        this.scene.remove(b.mesh);
    }

    stop() {
        this.active = false;
        if (this.tunnel) this.scene.remove(this.tunnel);
        if (this.platform) this.scene.remove(this.platform);
        if (this.leftSaber) this.scene.remove(this.leftSaber);
        if (this.rightSaber) this.scene.remove(this.rightSaber);

        for (const l of this.lights) this.scene.remove(l);
        for (const b of this.blocks) this.scene.remove(b.mesh);
        for (const c of this.cutPieces) this.scene.remove(c.mesh);
        for (const s of this.sparks) this.scene.remove(s.mesh);

        this.blocks = [];
        this.cutPieces = [];
        this.sparks = [];
        this.lights = [];
    }
}
