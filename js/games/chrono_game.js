/**
 * ChronoFreeze VR - Time Moves Only When You Move (SUPERHOT style)
 * Stand still and time freezes! Dodge bullets in bullet-time and shatter red crystal bots!
 */
class ChronoFreezeGame {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.active = false;
        this.score = 0;
        this.combo = 0;
        this.health = 100;
        this.maxHealth = 100;

        this.timeScale = 1.0;
        this.crystalBots = [];
        this.bullets = [];
        this.shards = [];
        this.shurikens = [];
        this.spawnTimer = 0;
        this.lights = [];

        this.handAvatars = { Left: null, Right: null };
        this.cooldowns = { Left: 0, Right: 0 };
    }

    start() {
        this.active = true;
        this.score = 0;
        this.combo = 0;
        this.health = 100;
        this.timeScale = 0.1;
        this.crystalBots = [];
        this.bullets = [];
        this.shards = [];
        this.shurikens = [];
        this.spawnTimer = 0;

        this.buildEnvironment();
        this.buildHandCrystals();

        if (window.soundFx) {
            window.soundFx.playTimeFreeze(true);
            window.soundFx.startBgm();
        }
    }

    buildEnvironment() {
        // Minimalist high-contrast white & slate room
        const roomGeo = new THREE.BoxGeometry(30, 20, 40);
        const roomMat = new THREE.MeshStandardMaterial({
            color: 0x070b16,
            roughness: 0.1,
            metalness: 0.8,
            side: THREE.BackSide
        });
        this.room = new THREE.Mesh(roomGeo, roomMat);
        this.room.position.set(0, 5, -10);
        this.scene.add(this.room);

        // Floor Grid Lines
        const grid = new THREE.GridHelper(40, 20, 0xff0055, 0x1e293b);
        grid.position.y = -2.2;
        this.grid = grid;
        this.scene.add(grid);

        // Lights
        const amb = new THREE.AmbientLight(0xffffff, 1.4);
        const dir = new THREE.DirectionalLight(0xff3366, 1.8);
        dir.position.set(5, 12, 5);
        this.scene.add(amb);
        this.scene.add(dir);
        this.lights.push(amb, dir);
    }

    buildHandCrystals() {
        ['Left', 'Right'].forEach((side) => {
            const group = new THREE.Group();
            const color = (side === 'Right') ? 0x00f3ff : 0xffaa00;

            // Translucent glowing prism gauntlet
            const geo = new THREE.OctahedronGeometry(0.28, 1);
            const mat = new THREE.MeshPhysicalMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 0.5,
                metalness: 0.1,
                roughness: 0.1,
                transmission: 0.8,
                transparent: true,
                opacity: 0.85
            });
            const mesh = new THREE.Mesh(geo, mat);
            group.add(mesh);

            // Shuriken ready indicator
            const starGeo = new THREE.RingGeometry(0.1, 0.25, 4);
            const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
            const star = new THREE.Mesh(starGeo, starMat);
            star.rotation.x = Math.PI / 2;
            group.add(star);

            group.position.set(0, -99, 0);
            this.scene.add(group);
            this.handAvatars[side] = group;
        });
    }

    spawnCrystalBot() {
        const botGroup = new THREE.Group();

        // Faceted red crystal head & torso
        const headGeo = new THREE.IcosahedronGeometry(0.5, 0);
        const botMat = new THREE.MeshStandardMaterial({
            color: 0xff0033,
            roughness: 0.2,
            metalness: 0.3,
            flatShading: true,
            emissive: 0x990022,
            emissiveIntensity: 0.4
        });
        const head = new THREE.Mesh(headGeo, botMat);
        head.position.y = 0.8;
        botGroup.add(head);

        const bodyGeo = new THREE.ConeGeometry(0.55, 1.4, 5);
        const body = new THREE.Mesh(bodyGeo, botMat);
        body.position.y = -0.2;
        botGroup.add(body);

        // Position in front arc
        const angle = (Math.random() - 0.5) * Math.PI * 0.6;
        const dist = 14 + Math.random() * 8;
        botGroup.position.set(Math.sin(angle) * dist, (Math.random() - 0.3) * 3, -Math.cos(angle) * dist);

        this.scene.add(botGroup);
        this.crystalBots.push({
            group: botGroup,
            shootTimer: 1.5 + Math.random() * 2.0,
            active: true
        });
    }

    spawnBullet(pos, targetPos) {
        const geo = new THREE.CylinderGeometry(0.08, 0.08, 0.7, 6);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
        const bullet = new THREE.Mesh(geo, mat);
        bullet.position.copy(pos);

        // Point towards target
        const dir = targetPos.clone().sub(pos).normalize();
        bullet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

        this.scene.add(bullet);
        this.bullets.push({
            mesh: bullet,
            vel: dir.multiplyScalar(12),
            life: 6.0
        });
    }

    throwShuriken(handPos, targetVec) {
        const geo = new THREE.OctahedronGeometry(0.3, 0);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00f3ff, wireframe: true });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(handPos);

        const dir = targetVec.clone().sub(handPos).normalize();
        this.scene.add(mesh);
        this.shurikens.push({
            mesh,
            vel: dir.multiplyScalar(22),
            life: 3.0
        });

        if (window.soundFx) window.soundFx.playFruitSlice();
    }

    shatterCrystal(pos, colorHex = 0xff0033) {
        for (let i = 0; i < 24; i++) {
            const geo = new THREE.TetrahedronGeometry(0.12 + Math.random() * 0.15, 0);
            const mat = new THREE.MeshStandardMaterial({
                color: colorHex,
                flatShading: true,
                roughness: 0.1,
                metalness: 0.8
            });
            const shard = new THREE.Mesh(geo, mat);
            shard.position.copy(pos);
            const vel = new THREE.Vector3(
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 8 + 2,
                (Math.random() - 0.5) * 8
            );
            this.scene.add(shard);
            this.shards.push({
                mesh: shard,
                vel,
                rot: new THREE.Vector3(Math.random() * 6, Math.random() * 6, 0),
                life: 1.5
            });
        }
    }

    update(delta, trackingData) {
        if (!this.active) return;

        // Calculate player motion speed
        let totalSpeed = 0;
        for (const h of trackingData.hands) {
            totalSpeed += (h.velocity ? h.velocity.speed : 0);
        }
        if (trackingData.head) {
            totalSpeed += Math.abs(trackingData.head.x || 0) * 0.5;
        }

        // TIME DILATION: Stand still = time crawls at 4%! Move = time flows at 100%!
        this.timeScale = Math.min(1.0, Math.max(0.04, totalSpeed * 0.7));
        const effectiveDelta = delta * this.timeScale;

        // Position hand crystals with true 3D orientation
        let leftSeen = false;
        let rightSeen = false;

        for (const hand of trackingData.hands) {
            const avatar = this.handAvatars[hand.label];
            if (!avatar) continue;

            if (hand.label === 'Left') leftSeen = true;
            else rightSeen = true;

            const worldX = hand.screenX * 2.8;
            const worldY = hand.screenY * 2.2;
            const targetPos = new THREE.Vector3(worldX, worldY, -1.8);
            avatar.position.lerp(targetPos, 0.55);

            // True orientation
            if (hand.orientation && hand.orientation.matrix) {
                const rotMat = new THREE.Matrix4().fromArray(hand.orientation.matrix);
                avatar.quaternion.setFromRotationMatrix(rotMat);
            }

            // Throw shuriken on Open Palm forward flick
            this.cooldowns[hand.label] = Math.max(0, this.cooldowns[hand.label] - delta);
            if (hand.isOpenPalm && this.cooldowns[hand.label] <= 0) {
                const targetVec = new THREE.Vector3(worldX * 2.5, worldY * 2.5, -20);
                this.throwShuriken(avatar.position, targetVec);
                this.cooldowns[hand.label] = 0.4;
            }

            // Deflect/catch nearby bullets
            for (let i = this.bullets.length - 1; i >= 0; i--) {
                const b = this.bullets[i];
                if (avatar.position.distanceTo(b.mesh.position) < 0.8) {
                    // Shatter bullet!
                    this.shatterCrystal(b.mesh.position, 0x00f3ff);
                    if (window.soundFx) window.soundFx.playGlassShatter();
                    this.scene.remove(b.mesh);
                    this.bullets.splice(i, 1);
                    this.score += 50;
                }
            }
        }

        if (!leftSeen && this.handAvatars.Left) this.handAvatars.Left.position.set(-99, -99, 0);
        if (!rightSeen && this.handAvatars.Right) this.handAvatars.Right.position.set(99, 99, 0);

        // Spawn bots
        this.spawnTimer += effectiveDelta;
        if (this.spawnTimer > 2.8 && this.crystalBots.length < 5) {
            this.spawnTimer = 0;
            this.spawnCrystalBot();
        }

        // Update Bots
        for (let i = this.crystalBots.length - 1; i >= 0; i--) {
            const bot = this.crystalBots[i];
            bot.group.rotation.y += effectiveDelta * 0.5;

            bot.shootTimer -= effectiveDelta;
            if (bot.shootTimer <= 0) {
                bot.shootTimer = 2.0 + Math.random() * 2.0;
                const playerHead = new THREE.Vector3(0, 0, 0);
                this.spawnBullet(bot.group.position, playerHead);
            }
        }

        // Update Bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.mesh.position.addScaledVector(b.vel, effectiveDelta);
            b.life -= effectiveDelta;

            // Hit player check
            if (b.mesh.position.z > 0.0) {
                this.health = Math.max(0, this.health - 20);
                this.shatterCrystal(b.mesh.position, 0xff0055);
                if (window.soundFx) window.soundFx.playBombExplosion();
                this.scene.remove(b.mesh);
                this.bullets.splice(i, 1);
                continue;
            }

            if (b.life <= 0) {
                this.scene.remove(b.mesh);
                this.bullets.splice(i, 1);
            }
        }

        // Update Player Shurikens
        for (let i = this.shurikens.length - 1; i >= 0; i--) {
            const s = this.shurikens[i];
            s.mesh.position.addScaledVector(s.vel, effectiveDelta * 2.0); // Player attacks move faster
            s.mesh.rotation.y += delta * 12;
            s.life -= delta;

            // Hit check against bots
            for (let j = this.crystalBots.length - 1; j >= 0; j--) {
                const bot = this.crystalBots[j];
                if (s.mesh.position.distanceTo(bot.group.position) < 1.4) {
                    // Bot shattered!
                    this.shatterCrystal(bot.group.position, 0xff0033);
                    if (window.soundFx) window.soundFx.playGlassShatter();
                    this.scene.remove(bot.group);
                    this.crystalBots.splice(j, 1);
                    this.score += 300;
                    this.combo++;
                    s.life = 0;
                    break;
                }
            }

            if (s.life <= 0) {
                this.scene.remove(s.mesh);
                this.shurikens.splice(i, 1);
            }
        }

        // Update Glass Shards
        for (let i = this.shards.length - 1; i >= 0; i--) {
            const sh = this.shards[i];
            sh.vel.y -= 9.8 * effectiveDelta;
            sh.mesh.position.addScaledVector(sh.vel, effectiveDelta);
            sh.mesh.rotation.x += sh.rot.x * effectiveDelta;
            sh.life -= effectiveDelta;
            if (sh.life <= 0) {
                this.scene.remove(sh.mesh);
                this.shards.splice(i, 1);
            }
        }
    }

    stop() {
        this.active = false;
        if (this.room) this.scene.remove(this.room);
        if (this.grid) this.scene.remove(this.grid);
        if (this.handAvatars.Left) this.scene.remove(this.handAvatars.Left);
        if (this.handAvatars.Right) this.scene.remove(this.handAvatars.Right);

        for (const l of this.lights) this.scene.remove(l);
        for (const b of this.crystalBots) this.scene.remove(b.group);
        for (const bl of this.bullets) this.scene.remove(bl.mesh);
        for (const sh of this.shards) this.scene.remove(sh.mesh);
        for (const sk of this.shurikens) this.scene.remove(sk.mesh);

        this.crystalBots = [];
        this.bullets = [];
        this.shards = [];
        this.shurikens = [];
        this.lights = [];
    }
}
