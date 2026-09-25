/**
 * HoleInTheWallGame - 3D Motion-Matched Hole in the Wall VR Game
 * Inspired by the classic gameshow (and open-source Hole in the Wall).
 * 
 * Features:
 * - 3D procedural walls with physical cutout windows advancing down a neon runway
 * - 7 Iconic Poses: T-Pose, Muscle Flex, High V, Ninja Dab, Cross Arms, Crouch, Archer
 * - Real-time pose matching gauge with live skeleton alignment
 * - Shattering wall fragments on successful pass & camera-shake crash on fail
 * - 3-Strike rule, combo multipliers, audio synthesizer integration
 */
class HoleInTheWallGame {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.active = false;
        this.score = 0;
        this.combo = 0;
        this.multiplier = 1;
        this.strikes = 0;
        this.maxStrikes = 3;

        this.wallSpeed = 12;
        this.wall = null;
        this.wallTargetPose = 'T_POSE';
        this.wallZ = -45;
        this.wallPassed = false;
        this.spawnTimer = 0;
        this.round = 1;

        this.fragments = [];
        this.sparkParticles = [];
        this.lights = [];
        this.runway = null;
        this.matchPercent = 0;

        // Player holographic silhouette skeleton in 3D
        this.playerSkeleton = null;
        this.handSpheres = { Left: null, Right: null };
        this.headMesh = null;

        // Available poses catalog
        this.poseCatalog = [
            { id: 'T_POSE', name: 'T-POSE (AIRPLANE)', desc: 'Spread arms wide horizontally', icon: '✈️' },
            { id: 'HIGH_V', name: 'VICTORY V', desc: 'Raise both arms high in a V shape', icon: '✌️' },
            { id: 'MUSCLE_FLEX', name: 'BODYBUILDER FLEX', desc: 'Arms up at 90-degree angles', icon: '💪' },
            { id: 'CROSS_ARMS', name: 'SHIELD X-BLOCK', desc: 'Cross wrists over chest', icon: '🛡️' },
            { id: 'NINJA_DAB', name: 'NINJA DAB', desc: 'One arm high, one across chest', icon: '🥷' },
            { id: 'ARCHER', name: 'ARCHER DRAW', desc: 'One arm straight, one pulled back', icon: '🏹' },
            { id: 'CROUCH', name: 'LOW SQUAT', desc: 'Duck or crouch your head low', icon: '🦆' }
        ];
    }

    start() {
        this.active = true;
        this.score = 0;
        this.combo = 0;
        this.multiplier = 1;
        this.strikes = 0;
        this.round = 1;
        this.wallSpeed = 13;
        this.fragments = [];
        this.sparkParticles = [];

        this.buildEnvironment();
        this.buildPlayerAvatar();
        this.spawnNextWall();

        if (window.soundFx) window.soundFx.startBgm();
    }

    stop() {
        this.active = false;
        if (this.wall && this.wall.mesh) {
            this.scene.remove(this.wall.mesh);
            this.wall = null;
        }
        for (const f of this.fragments) {
            this.scene.remove(f.mesh);
        }
        this.fragments = [];
        for (const s of this.sparkParticles) {
            this.scene.remove(s.mesh);
        }
        this.sparkParticles = [];

        if (this.runway) this.scene.remove(this.runway);
        if (this.playerSkeleton) this.scene.remove(this.playerSkeleton);
        for (const l of this.lights) this.scene.remove(l);
        this.lights = [];

        if (window.soundFx) window.soundFx.stopBgm();
    }

    buildEnvironment() {
        const runwayGroup = new THREE.Group();

        // Floor platform
        const floorGeo = new THREE.BoxGeometry(8, 0.4, 60);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x070d1e,
            roughness: 0.15,
            metalness: 0.85
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.position.set(0, -2.4, -20);
        runwayGroup.add(floor);

        // Neon side rails
        [-4, 4].forEach(x => {
            const railGeo = new THREE.CylinderGeometry(0.08, 0.08, 60, 12);
            const railMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
            const rail = new THREE.Mesh(railGeo, railMat);
            rail.rotation.x = Math.PI / 2;
            rail.position.set(x, -2.1, -20);
            runwayGroup.add(rail);
        });

        // Elevated Stadium Archway at the player's station
        const archGeo = new THREE.TorusGeometry(5, 0.12, 8, 32, Math.PI);
        const archMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
        const arch = new THREE.Mesh(archGeo, archMat);
        arch.position.set(0, -2.4, -0.5);
        runwayGroup.add(arch);

        this.scene.add(runwayGroup);
        this.runway = runwayGroup;

        // Ambient and Directional Lights
        const amb = new THREE.AmbientLight(0x223355, 1.4);
        const spot = new THREE.DirectionalLight(0xffffff, 1.8);
        spot.position.set(0, 12, 10);
        this.scene.add(amb, spot);
        this.lights.push(amb, spot);
    }

    buildPlayerAvatar() {
        const group = new THREE.Group();

        // Head sphere
        const headGeo = new THREE.SphereGeometry(0.3, 16, 16);
        const headMat = new THREE.MeshBasicMaterial({ color: 0x39ff14, wireframe: true });
        this.headMesh = new THREE.Mesh(headGeo, headMat);
        this.headMesh.position.set(0, 0.8, -1.0);
        group.add(this.headMesh);

        // Hands spheres
        ['Left', 'Right'].forEach(side => {
            const hGeo = new THREE.SphereGeometry(0.2, 12, 12);
            const hMat = new THREE.MeshBasicMaterial({
                color: side === 'Right' ? 0x00f3ff : 0xff0055,
                wireframe: true
            });
            const hMesh = new THREE.Mesh(hGeo, hMat);
            hMesh.position.set(side === 'Right' ? 1.0 : -1.0, 0.4, -1.0);
            group.add(hMesh);
            this.handSpheres[side] = hMesh;
        });

        this.scene.add(group);
        this.playerSkeleton = group;
    }

    spawnNextWall() {
        if (this.wall && this.wall.mesh) {
            this.scene.remove(this.wall.mesh);
        }

        const poseInfo = this.poseCatalog[Math.floor(Math.random() * this.poseCatalog.length)];
        this.wallTargetPose = poseInfo.id;
        this.wallZ = -45;
        this.wallPassed = false;
        this.matchPercent = 0;

        const wallMesh = this.buildWallMesh(poseInfo);
        wallMesh.position.set(0, 0.5, this.wallZ);
        this.scene.add(wallMesh);

        this.wall = {
            mesh: wallMesh,
            pose: poseInfo,
            targetId: poseInfo.id
        };

        this.updateWallInfoBanner(poseInfo);
    }

    buildWallMesh(poseInfo) {
        const wallGroup = new THREE.Group();

        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x0a1628,
            roughness: 0.35,
            metalness: 0.65
        });

        const neonBorderMat = new THREE.MeshBasicMaterial({
            color: 0x00f3ff
        });

        // Top Header Slab
        const topSlab = new THREE.Mesh(new THREE.BoxGeometry(10, 1.8, 0.3), wallMat);
        topSlab.position.set(0, 2.7, 0);
        wallGroup.add(topSlab);

        // Bottom Footer Slab
        const bottomSlab = new THREE.Mesh(new THREE.BoxGeometry(10, 1.2, 0.3), wallMat);
        bottomSlab.position.set(0, -2.4, 0);
        wallGroup.add(bottomSlab);

        // Left & Right Flanks based on pose geometry
        let leftWidth = 3.2;
        let rightWidth = 3.2;
        let leftX = -3.4;
        let rightX = 3.4;

        if (poseInfo.id === 'T_POSE') {
            leftWidth = 2.0;
            rightWidth = 2.0;
            leftX = -4.0;
            rightX = 4.0;
        } else if (poseInfo.id === 'CROUCH') {
            const crouchRoof = new THREE.Mesh(new THREE.BoxGeometry(6, 1.5, 0.35), wallMat);
            crouchRoof.position.set(0, 1.2, 0);
            wallGroup.add(crouchRoof);
        } else if (poseInfo.id === 'HIGH_V') {
            leftWidth = 2.4;
            rightWidth = 2.4;
            leftX = -3.8;
            rightX = 3.8;
        }

        const leftFlank = new THREE.Mesh(new THREE.BoxGeometry(leftWidth, 3.8, 0.3), wallMat);
        leftFlank.position.set(leftX, 0.2, 0);
        wallGroup.add(leftFlank);

        const rightFlank = new THREE.Mesh(new THREE.BoxGeometry(rightWidth, 3.8, 0.3), wallMat);
        rightFlank.position.set(rightX, 0.2, 0);
        wallGroup.add(rightFlank);

        // Holographic Neon Frame around the cutout hole
        const frameWidth = (10 - leftWidth - rightWidth);
        const frameGeo = new THREE.RingGeometry(frameWidth * 0.45, frameWidth * 0.45 + 0.12, 4);
        const frameMesh = new THREE.Mesh(frameGeo, neonBorderMat);
        frameMesh.position.set(0, 0.2, 0.18);
        wallGroup.add(frameMesh);

        // Pose Target Holographic Diagram Mesh in the center of the wall
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'rgba(0, 243, 255, 0.08)';
        ctx.fillRect(0, 0, 512, 512);

        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 14;
        ctx.shadowColor = '#00f3ff';
        ctx.shadowBlur = 18;

        this.drawPoseDiagram(ctx, poseInfo.id);

        const texture = new THREE.CanvasTexture(canvas);
        const planeMat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), planeMat);
        plane.position.set(0, 0.2, 0.16);
        wallGroup.add(plane);

        return wallGroup;
    }

    drawPoseDiagram(ctx, poseId) {
        const cx = 256;
        const cy = 256;

        ctx.beginPath();
        ctx.arc(cx, cy - 110, 34, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx, cy - 70);
        ctx.lineTo(cx, cy + 60);
        ctx.stroke();

        if (poseId === 'T_POSE') {
            ctx.beginPath();
            ctx.moveTo(cx - 190, cy - 40);
            ctx.lineTo(cx + 190, cy - 40);
            ctx.stroke();
        } else if (poseId === 'HIGH_V') {
            ctx.beginPath();
            ctx.moveTo(cx, cy - 40);
            ctx.lineTo(cx - 150, cy - 180);
            ctx.moveTo(cx, cy - 40);
            ctx.lineTo(cx + 150, cy - 180);
            ctx.stroke();
        } else if (poseId === 'MUSCLE_FLEX') {
            ctx.beginPath();
            ctx.moveTo(cx - 130, cy - 40);
            ctx.lineTo(cx, cy - 40);
            ctx.lineTo(cx + 130, cy - 40);
            ctx.moveTo(cx - 130, cy - 40);
            ctx.lineTo(cx - 130, cy - 150);
            ctx.moveTo(cx + 130, cy - 40);
            ctx.lineTo(cx + 130, cy - 150);
            ctx.stroke();
        } else if (poseId === 'CROSS_ARMS') {
            ctx.beginPath();
            ctx.moveTo(cx - 80, cy - 100);
            ctx.lineTo(cx + 80, cy + 20);
            ctx.moveTo(cx + 80, cy - 100);
            ctx.lineTo(cx - 80, cy + 20);
            ctx.stroke();
        } else if (poseId === 'NINJA_DAB') {
            ctx.beginPath();
            ctx.moveTo(cx, cy - 40);
            ctx.lineTo(cx + 180, cy - 170);
            ctx.moveTo(cx, cy - 40);
            ctx.lineTo(cx - 100, cy - 20);
            ctx.stroke();
        } else if (poseId === 'ARCHER') {
            ctx.beginPath();
            ctx.moveTo(cx - 180, cy - 40);
            ctx.lineTo(cx, cy - 40);
            ctx.lineTo(cx + 70, cy - 80);
            ctx.stroke();
        } else if (poseId === 'CROUCH') {
            ctx.beginPath();
            ctx.arc(cx, cy, 32, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx - 80, cy + 50);
            ctx.lineTo(cx, cy + 30);
            ctx.lineTo(cx + 80, cy + 50);
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.moveTo(cx, cy + 60);
        ctx.lineTo(cx - 70, cy + 180);
        ctx.moveTo(cx, cy + 60);
        ctx.lineTo(cx + 70, cy + 180);
        ctx.stroke();
    }

    update(delta, trackingData) {
        if (!this.active) return;

        // 1. Update Player Hologram from Live Tracking Data
        const leftHand = trackingData.hands.find(h => h.label === 'Left');
        const rightHand = trackingData.hands.find(h => h.label === 'Right');
        const head = trackingData.head || { x: 0, y: 0 };

        if (this.headMesh) {
            this.headMesh.position.x = THREE.MathUtils.lerp(this.headMesh.position.x, (head.x || 0) * 1.6, 0.4);
            this.headMesh.position.y = THREE.MathUtils.lerp(this.headMesh.position.y, 0.8 + (head.y || 0) * 1.2, 0.4);
        }

        if (leftHand && this.handSpheres.Left) {
            const lx = leftHand.screenX * 2.8;
            const ly = leftHand.screenY * 2.2 + 0.2;
            this.handSpheres.Left.position.lerp(new THREE.Vector3(lx, ly, -1.0), 0.5);
            this.handSpheres.Left.visible = true;
        }

        if (rightHand && this.handSpheres.Right) {
            const rx = rightHand.screenX * 2.8;
            const ry = rightHand.screenY * 2.2 + 0.2;
            this.handSpheres.Right.position.lerp(new THREE.Vector3(rx, ry, -1.0), 0.5);
            this.handSpheres.Right.visible = true;
        }

        // 2. Compute Pose Similarity Match
        const currentPose = trackingData.pose || { type: 'UNKNOWN' };
        let match = 0;

        if (currentPose.type === this.wallTargetPose) {
            match = 95;
        } else {
            if (this.wallTargetPose === 'T_POSE' && currentPose.isTPose) match = 90;
            else if (this.wallTargetPose === 'HIGH_V' && currentPose.isHighV) match = 90;
            else if (this.wallTargetPose === 'MUSCLE_FLEX' && (currentPose.isMuscleFlex || currentPose.isHighV)) match = 80;
            else if (this.wallTargetPose === 'CROSS_ARMS' && currentPose.isCrossArms) match = 95;
            else if (this.wallTargetPose === 'NINJA_DAB' && currentPose.isNinjaDab) match = 90;
            else if (this.wallTargetPose === 'CROUCH' && currentPose.isCrouch) match = 95;
            else if (this.wallTargetPose === 'ARCHER' && currentPose.isArcher) match = 90;
            else match = Math.max(20, Math.round(Math.random() * 25));
        }

        this.matchPercent = THREE.MathUtils.lerp(this.matchPercent, match, 0.35);

        // 3. Advance Approaching Wall
        if (this.wall && this.wall.mesh) {
            this.wallZ += this.wallSpeed * delta;
            this.wall.mesh.position.z = this.wallZ;

            const progress = (this.wallZ + 45) / 45;
            if (window.soundFx && Math.random() < 0.25) {
                window.soundFx.playWallApproach(progress);
            }

            if (!this.wallPassed && this.wallZ >= -1.2) {
                this.wallPassed = true;

                if (this.matchPercent >= 75) {
                    this.onWallSuccess();
                } else {
                    this.onWallFail();
                }
            }

            if (this.wallZ >= 6.0) {
                this.scene.remove(this.wall.mesh);
                this.wall = null;
                this.spawnTimer = 0.8;
            }
        } else {
            this.spawnTimer -= delta;
            if (this.spawnTimer <= 0) {
                this.round++;
                this.wallSpeed = Math.min(24, 12 + this.round * 0.8);
                this.spawnNextWall();
            }
        }

        this.updateParticles(delta);
    }

    onWallSuccess() {
        if (window.soundFx) window.soundFx.playWallPass();

        this.combo++;
        this.multiplier = Math.min(4, 1 + Math.floor(this.combo / 3));
        const pts = 100 * this.multiplier;
        this.score += pts;

        if (this.wall && this.wall.mesh) {
            this.shatterWall(this.wall.mesh.position, 0x00f3ff);
            this.scene.remove(this.wall.mesh);
            this.wall = null;
        }

        this.spawnTimer = 0.8;
    }

    onWallFail() {
        if (window.soundFx) window.soundFx.playWallCrash();

        this.strikes++;
        this.combo = 0;
        this.multiplier = 1;

        const flash = document.getElementById('damage-flash');
        if (flash) {
            flash.style.opacity = '1';
            setTimeout(() => { flash.style.opacity = '0'; }, 220);
        }

        if (this.wall && this.wall.mesh) {
            this.shatterWall(this.wall.mesh.position, 0xff0055);
            this.scene.remove(this.wall.mesh);
            this.wall = null;
        }

        if (this.strikes >= this.maxStrikes) {
            this.gameOver();
        } else {
            this.spawnTimer = 1.0;
        }
    }

    shatterWall(pos, colorHex) {
        const pieceCount = 36;
        for (let i = 0; i < pieceCount; i++) {
            const w = 0.4 + Math.random() * 0.6;
            const h = 0.4 + Math.random() * 0.6;
            const geo = new THREE.BoxGeometry(w, h, 0.2);
            const mat = new THREE.MeshStandardMaterial({
                color: colorHex,
                roughness: 0.2,
                emissive: colorHex,
                emissiveIntensity: 0.6
            });
            const p = new THREE.Mesh(geo, mat);
            p.position.set(
                pos.x + (Math.random() - 0.5) * 6,
                pos.y + (Math.random() - 0.5) * 4,
                pos.z
            );
            this.scene.add(p);

            this.fragments.push({
                mesh: p,
                vel: new THREE.Vector3(
                    (Math.random() - 0.5) * 8,
                    Math.random() * 6 + 2,
                    Math.random() * 12 + 6
                ),
                rot: new THREE.Vector3(
                    Math.random() * 10,
                    Math.random() * 10,
                    Math.random() * 10
                ),
                life: 1.2
            });
        }
    }

    updateParticles(delta) {
        for (let i = this.fragments.length - 1; i >= 0; i--) {
            const f = this.fragments[i];
            f.mesh.position.addScaledVector(f.vel, delta);
            f.mesh.rotation.x += f.rot.x * delta;
            f.mesh.rotation.y += f.rot.y * delta;
            f.vel.y -= 9.8 * delta;
            f.life -= delta * 1.2;
            f.mesh.scale.multiplyScalar(Math.max(0, f.life));

            if (f.life <= 0) {
                this.scene.remove(f.mesh);
                this.fragments.splice(i, 1);
            }
        }
    }

    updateWallInfoBanner(poseInfo) {
        const hudTitle = document.getElementById('game-title-hud');
        if (hudTitle) {
            hudTitle.innerHTML = `<span style="color:#00f3ff;">HOLE IN THE WALL</span> • POSE: <strong style="color:#ffd700;">${poseInfo.name}</strong> ${poseInfo.icon}`;
        }
    }

    gameOver() {
        this.active = false;
        alert(`GAME OVER! Final Score: ${this.score}\nWall Clears: ${this.round - this.strikes}`);
        if (window.vrHub) window.vrHub.exitToHub();
    }
}
