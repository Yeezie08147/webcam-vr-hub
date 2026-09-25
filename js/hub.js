/**
 * VRHub - 3D Holo-Deck & Spatial Game Hub
 * Manages Three.js rendering, spatial hand gestures, game pod selection, and game lifecycle.
 */
class VRHub {
    constructor() {
        this.container = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.currentGame = null;
        this.currentGameId = null;

        // Hub 3D Objects
        this.hubGroup = new THREE.Group();
        this.gamePods = [];
        this.particles = null;
        this.stars = null;
        this.spatialCursor = null;
        this.hoveredPod = null;
        this.pinchCooldown = 0;

        // Game registry
        this.games = {};

        // Clock
        this.clock = new THREE.Clock();
        this.stereoMode = false;
    }

    init(container) {
        this.container = container;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x060914);
        this.scene.fog = new THREE.FogExp2(0x060914, 0.025);

        // Camera
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
        this.camera.position.set(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.container.appendChild(this.renderer.domElement);

        // Build Holo-Deck
        this.buildHoloDeck();
        this.buildSpatialCursor();
        this.scene.add(this.hubGroup);

        // Register Games
        this.games['saber'] = new SaberStormGame(this.scene, this.camera);
        this.games['dodge'] = new CyberDodgeGame(this.scene, this.camera);
        this.games['boxing'] = new CyberBoxingGame(this.scene, this.camera);
        this.games['hole'] = new HoleInTheWallGame(this.scene, this.camera);
        this.games['chrono'] = new ChronoFreezeGame(this.scene, this.camera);
        this.games['spell'] = new SpellcasterGame(this.scene, this.camera);
        this.games['fruit'] = new BladeFruitGame(this.scene, this.camera);

        // Window resize
        window.addEventListener('resize', () => this.onWindowResize());

        // Mouse click fallback for desktop
        window.addEventListener('pointerdown', (e) => this.onPointerClick(e));

        // Start animation loop
        this.animate();
    }

    buildHoloDeck() {
        // Neon Hex Floor Grid
        const grid = new THREE.GridHelper(80, 40, 0x00f3ff, 0x112244);
        grid.position.y = -2.5;
        this.hubGroup.add(grid);

        // Ambient particles / Starfield
        const starGeo = new THREE.BufferGeometry();
        const starCount = 800;
        const starPositions = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount * 3; i += 3) {
            starPositions[i] = (Math.random() - 0.5) * 100;
            starPositions[i + 1] = (Math.random() - 0.5) * 60;
            starPositions[i + 2] = (Math.random() - 0.5) * 100;
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        const starMat = new THREE.PointsMaterial({ color: 0x00f3ff, size: 0.25, transparent: true, opacity: 0.7 });
        this.stars = new THREE.Points(starGeo, starMat);
        this.hubGroup.add(this.stars);

        // Central Holographic Platform
        const platGeo = new THREE.CylinderGeometry(4.5, 5, 0.4, 32);
        const platMat = new THREE.MeshStandardMaterial({ color: 0x0d142b, metalness: 0.8, roughness: 0.2 });
        const platform = new THREE.Mesh(platGeo, platMat);
        platform.position.y = -2.6;
        this.hubGroup.add(platform);

        // Ring Lights
        const ringGeo = new THREE.TorusGeometry(4.7, 0.08, 8, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -2.4;
        this.hubGroup.add(ring);

        // Ambient and Directional light
        const amb = new THREE.AmbientLight(0x223355, 1.8);
        const dir = new THREE.DirectionalLight(0xffffff, 1.2);
        dir.position.set(0, 10, 5);
        this.hubGroup.add(amb, dir);

        // Build 7 Game Pods in an arc
        const podData = [
            { id: 'saber', title: 'SaberStorm VR', desc: 'Beat Saber Rhythm Slicing', color: 0xff0055, angle: -0.9 },
            { id: 'dodge', title: 'CyberDodge VR', desc: 'Duck & Lean Bullet-Time', color: 0x00f3ff, angle: -0.6 },
            { id: 'boxing', title: 'CyberBoxing VR', desc: 'ShadowStrike Motion Sparring', color: 0xff7700, angle: -0.3 },
            { id: 'hole', title: 'Hole In The Wall VR', desc: 'Pose Matching Body Game', color: 0xffd700, angle: 0.0 },
            { id: 'chrono', title: 'ChronoFreeze VR', desc: 'Time Moves When You Move', color: 0xff0033, angle: 0.3 },
            { id: 'spell', title: 'Spellcaster VR', desc: 'Hand Gesture Magic Combat', color: 0xaa00ff, angle: 0.6 },
            { id: 'fruit', title: 'BladeFruit VR', desc: '3D Blade Fruit Slicing', color: 0x39ff14, angle: 0.9 }
        ];

        const radius = 7.4;
        podData.forEach((data) => {
            const pod = this.createGamePod(data, radius);
            this.gamePods.push(pod);
            this.hubGroup.add(pod.group);
        });
    }

    createGamePod(data, radius) {
        const group = new THREE.Group();
        const x = Math.sin(data.angle) * radius;
        const z = -Math.cos(data.angle) * radius;
        group.position.set(x, 0.4, z);
        group.lookAt(0, 0.4, 0);

        // Glass Podium Card
        const cardGeo = new THREE.BoxGeometry(2.3, 3.2, 0.15);
        const cardMat = new THREE.MeshPhysicalMaterial({
            color: 0x0a1428,
            metalness: 0.2,
            roughness: 0.1,
            transmission: 0.6,
            thickness: 0.5,
            transparent: true,
            opacity: 0.85
        });
        const card = new THREE.Mesh(cardGeo, cardMat);
        group.add(card);

        // Glowing Border Frame
        const frameGeo = new THREE.EdgesGeometry(cardGeo);
        const frameMat = new THREE.LineBasicMaterial({ color: data.color, linewidth: 2 });
        const frame = new THREE.LineSegments(frameGeo, frameMat);
        group.add(frame);

        // 3D Icon Floating above Card
        let iconMesh;
        if (data.id === 'saber') {
            const h1 = new THREE.CylinderGeometry(0.06, 0.06, 1.6, 8);
            const m1 = new THREE.MeshBasicMaterial({ color: 0xff0055 });
            const s1 = new THREE.Mesh(h1, m1);
            s1.rotation.z = Math.PI / 4;

            const h2 = new THREE.CylinderGeometry(0.06, 0.06, 1.6, 8);
            const m2 = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
            const s2 = new THREE.Mesh(h2, m2);
            s2.rotation.z = -Math.PI / 4;

            iconMesh = new THREE.Group();
            iconMesh.add(s1, s2);
        } else if (data.id === 'dodge') {
            const g = new THREE.TorusGeometry(0.65, 0.12, 12, 24);
            const m = new THREE.MeshBasicMaterial({ color: 0x00f3ff, wireframe: true });
            iconMesh = new THREE.Mesh(g, m);
        } else if (data.id === 'boxing') {
            const g = new THREE.SphereGeometry(0.42, 12, 12);
            g.scale(1.0, 1.25, 1.35);
            const m = new THREE.MeshStandardMaterial({
                color: 0xff7700,
                metalness: 0.8,
                roughness: 0.2,
                emissive: 0xff4400,
                emissiveIntensity: 0.5
            });
            iconMesh = new THREE.Mesh(g, m);
        } else if (data.id === 'hole') {
            const wallG = new THREE.Group();
            const slab1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 0.1), new THREE.MeshBasicMaterial({ color: 0xffd700 }));
            slab1.position.y = 0.45;
            const slab2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 0.1), new THREE.MeshBasicMaterial({ color: 0xffd700 }));
            slab2.position.y = -0.45;
            const side1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.55, 0.1), new THREE.MeshBasicMaterial({ color: 0xffd700 }));
            side1.position.x = -0.45;
            const side2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.55, 0.1), new THREE.MeshBasicMaterial({ color: 0xffd700 }));
            side2.position.x = 0.45;
            const holeHolo = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.26, 8), new THREE.MeshBasicMaterial({ color: 0x00f3ff, wireframe: true }));
            wallG.add(slab1, slab2, side1, side2, holeHolo);
            iconMesh = wallG;
        } else if (data.id === 'chrono') {
            const g = new THREE.OctahedronGeometry(0.6, 0);
            const m = new THREE.MeshBasicMaterial({ color: 0xff0033, wireframe: true });
            iconMesh = new THREE.Mesh(g, m);
        } else if (data.id === 'spell') {
            const g = new THREE.IcosahedronGeometry(0.65, 1);
            const m = new THREE.MeshBasicMaterial({ color: 0xaa00ff, wireframe: true });
            iconMesh = new THREE.Mesh(g, m);
        } else {
            const g = new THREE.OctahedronGeometry(0.65);
            const m = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
            iconMesh = new THREE.Mesh(g, m);
        }
        iconMesh.position.set(0, 0.6, 0.4);
        group.add(iconMesh);

        // Dynamic Canvas Texture for Card Text
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(10, 16, 32, 0.9)';
        ctx.fillRect(0, 0, 512, 256);
        ctx.strokeStyle = `#${data.color.toString(16).padStart(6, '0')}`;
        ctx.lineWidth = 6;
        ctx.strokeRect(6, 6, 500, 244);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(data.title, 256, 110);

        ctx.fillStyle = '#88aacc';
        ctx.font = '22px sans-serif';
        ctx.fillText(data.desc, 256, 160);

        ctx.fillStyle = `#${data.color.toString(16).padStart(6, '0')}`;
        ctx.font = 'bold 20px monospace';
        ctx.fillText('PINCH OR CLICK TO PLAY', 256, 215);

        const tex = new THREE.CanvasTexture(canvas);
        const labelGeo = new THREE.PlaneGeometry(2.0, 1.0);
        const labelMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
        const label = new THREE.Mesh(labelGeo, labelMat);
        label.position.set(0, -0.6, 0.12);
        group.add(label);

        return {
            id: data.id,
            group,
            card,
            frame,
            iconMesh,
            color: data.color,
            baseY: 0.4,
            isHovered: false
        };
    }

    buildSpatialCursor() {
        this.handAvatars = {
            Left: this.createCyberHand(0xff0055, 'Left'),
            Right: this.createCyberHand(0x00f3ff, 'Right')
        };
        this.hubGroup.add(this.handAvatars.Left.group);
        this.hubGroup.add(this.handAvatars.Right.group);
        this.hubGroup.add(this.handAvatars.Left.laserGroup);
        this.hubGroup.add(this.handAvatars.Right.laserGroup);
        this.hubGroup.add(this.handAvatars.Left.reticleGroup);
        this.hubGroup.add(this.handAvatars.Right.reticleGroup);
    }

    createCyberHand(colorHex, side) {
        const group = new THREE.Group();

        // 1. Sleek Cyber Palm Chassis
        const palmGeo = new THREE.BoxGeometry(0.36, 0.42, 0.12);
        const palmMat = new THREE.MeshStandardMaterial({
            color: 0x0c1424,
            metalness: 0.85,
            roughness: 0.25,
            emissive: colorHex,
            emissiveIntensity: 0.25
        });
        const palm = new THREE.Mesh(palmGeo, palmMat);
        group.add(palm);

        // Armor Plate Backing
        const armorGeo = new THREE.BoxGeometry(0.32, 0.38, 0.04);
        const armorMat = new THREE.MeshStandardMaterial({ color: 0x18243c, metalness: 0.9, roughness: 0.1 });
        const armor = new THREE.Mesh(armorGeo, armorMat);
        armor.position.z = -0.06;
        group.add(armor);

        // Glowing Plasma Core Crystal (Repulsor)
        const coreGeo = new THREE.OctahedronGeometry(0.11);
        const coreMat = new THREE.MeshBasicMaterial({ color: colorHex });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.z = 0.07;
        group.add(core);

        // Core Halo Ring
        const coreHaloGeo = new THREE.RingGeometry(0.12, 0.16, 16);
        const coreHaloMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        const coreHalo = new THREE.Mesh(coreHaloGeo, coreHaloMat);
        coreHalo.position.z = 0.075;
        group.add(coreHalo);

        // Metallic Wrist Cuff
        const cuffGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.22, 14);
        const cuffMat = new THREE.MeshStandardMaterial({ color: 0x070b14, metalness: 0.95, roughness: 0.2 });
        const cuff = new THREE.Mesh(cuffGeo, cuffMat);
        cuff.position.y = -0.32;
        group.add(cuff);

        // 2. Articulated 5-Finger Kinematics (Proximal + Distal + Tip)
        const fingers = [];
        const isRight = side === 'Right';
        const fingerLayout = [
            { id: 'thumb', x: (isRight ? -0.22 : 0.22), y: -0.06, proxLen: 0.16, distLen: 0.14, angleZ: (isRight ? 0.6 : -0.6) },
            { id: 'index', x: (isRight ? -0.11 : 0.11), y: 0.21, proxLen: 0.20, distLen: 0.18, angleZ: 0 },
            { id: 'middle', x: 0.0, y: 0.23, proxLen: 0.22, distLen: 0.20, angleZ: 0 },
            { id: 'ring', x: (isRight ? 0.11 : -0.11), y: 0.21, proxLen: 0.20, distLen: 0.18, angleZ: 0 },
            { id: 'pinky', x: (isRight ? 0.21 : -0.21), y: 0.16, proxLen: 0.16, distLen: 0.14, angleZ: (isRight ? -0.2 : 0.2) }
        ];

        let indexTipMesh = null;

        fingerLayout.forEach((fl) => {
            const root = new THREE.Group();
            root.position.set(fl.x, fl.y, 0);
            root.rotation.z = fl.angleZ;

            // Proximal bone
            const proxGeo = new THREE.CylinderGeometry(0.032, 0.036, fl.proxLen, 8);
            const boneMat = new THREE.MeshStandardMaterial({ color: 0x141f36, metalness: 0.8, roughness: 0.3 });
            const proxMesh = new THREE.Mesh(proxGeo, boneMat);
            proxMesh.position.y = fl.proxLen / 2;
            root.add(proxMesh);

            // Knuckle Joint
            const jointGeo = new THREE.SphereGeometry(0.04, 8, 8);
            const jointMat = new THREE.MeshBasicMaterial({ color: colorHex });
            const joint = new THREE.Mesh(jointGeo, jointMat);
            joint.position.y = fl.proxLen;
            root.add(joint);

            // Distal group (hinges at knuckle joint)
            const distGroup = new THREE.Group();
            distGroup.position.y = fl.proxLen;

            const distGeo = new THREE.CylinderGeometry(0.026, 0.03, fl.distLen, 8);
            const distMesh = new THREE.Mesh(distGeo, boneMat);
            distMesh.position.y = fl.distLen / 2;
            distGroup.add(distMesh);

            // Glowing Fingertip Emitter
            const tipGeo = new THREE.SphereGeometry(0.038, 8, 8);
            const tipMat = new THREE.MeshBasicMaterial({ color: fl.id === 'index' ? 0xffffff : colorHex });
            const tipMesh = new THREE.Mesh(tipGeo, tipMat);
            tipMesh.position.y = fl.distLen;
            distGroup.add(tipMesh);

            root.add(distGroup);
            group.add(root);

            if (fl.id === 'index') {
                indexTipMesh = tipMesh;
            }

            fingers.push({
                id: fl.id,
                root,
                distGroup,
                tipMesh
            });
        });

        // 3. Dynamic Laser Beam (in world/hub coordinates)
        const laserGroup = new THREE.Group();
        const laserCoreGeo = new THREE.CylinderGeometry(0.012, 0.012, 1.0, 8);
        const laserCoreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const laserCore = new THREE.Mesh(laserCoreGeo, laserCoreMat);

        const laserAuraGeo = new THREE.CylinderGeometry(0.038, 0.038, 1.0, 8);
        const laserAuraMat = new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.65,
            blending: THREE.AdditiveBlending
        });
        const laserAura = new THREE.Mesh(laserAuraGeo, laserAuraMat);
        laserGroup.add(laserCore, laserAura);
        laserGroup.visible = false;

        // 4. Holographic Targeting Reticle with Dwell Meter
        const reticleGroup = new THREE.Group();

        // Inner pinpoint dot
        const dotGeo = new THREE.CircleGeometry(0.035, 12);
        const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        reticleGroup.add(dot);

        // Middle crosshair diamond ring
        const midGeo = new THREE.RingGeometry(0.07, 0.11, 4);
        const midMat = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, wireframe: true });
        const midRing = new THREE.Mesh(midGeo, midMat);
        reticleGroup.add(midRing);

        // Outer holographic ring
        const outerGeo = new THREE.RingGeometry(0.18, 0.22, 24);
        const outerMat = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
        const outerRing = new THREE.Mesh(outerGeo, outerMat);
        reticleGroup.add(outerRing);

        // Dwell circular progress arc
        const dwellGeo = new THREE.RingGeometry(0.24, 0.30, 32, 1, 0, 0.001);
        const dwellMat = new THREE.MeshBasicMaterial({
            color: 0x39ff14,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.95
        });
        const dwellRing = new THREE.Mesh(dwellGeo, dwellMat);
        reticleGroup.add(dwellRing);
        reticleGroup.visible = false;

        group.position.set(0, -99, 0);

        return {
            group,
            palm,
            armor,
            core,
            coreHalo,
            fingers,
            indexTip: indexTipMesh,
            laserGroup,
            laserCore,
            laserAura,
            reticleGroup,
            reticleDot: dot,
            reticleMid: midRing,
            reticleOuter: outerRing,
            dwellRing,
            colorHex,
            side,
            updateDwell: (pct) => {
                if (pct <= 0.01) {
                    dwellRing.visible = false;
                } else {
                    dwellRing.visible = true;
                    dwellRing.geometry.dispose();
                    dwellRing.geometry = new THREE.RingGeometry(0.24, 0.30, 32, 1, -Math.PI / 2, Math.PI * 2 * pct);
                }
            }
        };
    }

    onPointerClick(e) {
        if (this.currentGame) return; // In-game
        const mouse = new THREE.Vector2(
            (e.clientX / window.innerWidth) * 2 - 1,
            -(e.clientY / window.innerHeight) * 2 + 1
        );
        this.raycastAndSelect(mouse);
    }

    raycastAndSelect(screenCoords) {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(screenCoords, this.camera);

        const cardMeshes = this.gamePods.map(p => p.card);
        const hits = raycaster.intersectObjects(cardMeshes);

        if (hits.length > 0) {
            const hitMesh = hits[0].object;
            const pod = this.gamePods.find(p => p.card === hitMesh);
            if (pod) {
                this.launchGame(pod.id);
            }
        }
    }

    launchGame(gameId) {
        if (window.soundFx) {
            window.soundFx.playUiClick();
        }

        if (gameId === 'hole') {
            this.currentGameId = 'hole';
            // Pause parent camera so iframe has exclusive access to the webcam hardware
            if (window.visionTracker && window.visionTracker.pauseCamera) {
                window.visionTracker.pauseCamera();
            }

            // Hide Holo-deck & Hub hands
            this.hubGroup.visible = false;
            ['Left', 'Right'].forEach(side => {
                if (this.handAvatars && this.handAvatars[side]) {
                    this.handAvatars[side].group.visible = false;
                    if (this.handAvatars[side].laserGroup) this.handAvatars[side].laserGroup.visible = false;
                    if (this.handAvatars[side].reticleGroup) this.handAvatars[side].reticleGroup.visible = false;
                }
            });
            document.getElementById('hub-overlay').style.display = 'none';

            // Launch GitHub Hole In The Wall in the embedded in-app frame
            const container = document.getElementById('hole-game-container');
            const iframe = document.getElementById('hole-game-iframe');
            if (container && iframe) {
                container.style.display = 'block';
                iframe.src = 'games/hole-in-the-wall/index.html';
            }
            return;
        }

        if (!this.games[gameId]) return;

        this.currentGameId = gameId;
        this.currentGame = this.games[gameId];

        // Hide Holo-deck & Hub hands
        this.hubGroup.visible = false;
        ['Left', 'Right'].forEach(side => {
            if (this.handAvatars && this.handAvatars[side]) {
                this.handAvatars[side].group.visible = false;
                if (this.handAvatars[side].laserGroup) this.handAvatars[side].laserGroup.visible = false;
                if (this.handAvatars[side].reticleGroup) this.handAvatars[side].reticleGroup.visible = false;
            }
        });

        // Show game HUD
        document.getElementById('hub-overlay').style.display = 'none';
        document.getElementById('game-hud').style.display = 'flex';
        document.getElementById('game-title-hud').textContent = gameId.toUpperCase() + ' VR';

        this.currentGame.start();
    }

    exitToHub() {
        // Close embedded Hole In The Wall frame if active
        const holeContainer = document.getElementById('hole-game-container');
        const holeIframe = document.getElementById('hole-game-iframe');
        if (holeContainer && holeIframe) {
            holeContainer.style.display = 'none';
            holeIframe.src = '';
        }

        // Resume parent camera if returning from hole game
        if (window.visionTracker && window.visionTracker.resumeCamera) {
            window.visionTracker.resumeCamera();
        }

        if (this.currentGame) {
            this.currentGame.stop();
            this.currentGame = null;
            this.currentGameId = null;
        }

        // Show Holo-Deck & Hub hands
        this.hubGroup.visible = true;
        ['Left', 'Right'].forEach(side => {
            if (this.handAvatars && this.handAvatars[side]) {
                this.handAvatars[side].group.visible = true;
            }
        });
        this.camera.position.set(0, 0, 0);

        // Update HUD
        document.getElementById('hub-overlay').style.display = 'flex';
        document.getElementById('game-hud').style.display = 'none';
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const delta = Math.min(this.clock.getDelta(), 0.1);

        const trackingData = window.visionTracker ? window.visionTracker.getTrackingData() : { hands: [], head: {} };

        if (this.currentGame) {
            this.currentGame.update(delta, trackingData);
            this.updateGameHud();
        } else {
            this.updateHub(delta, trackingData);
        }

        this.renderer.render(this.scene, this.camera);
    }

    updateHub(delta, trackingData) {
        // Rotate stars & ambient effects
        if (this.stars) this.stars.rotation.y += delta * 0.02;

        // Animate game pod icons
        this.gamePods.forEach(p => {
            if (p.iconMesh) {
                p.iconMesh.rotation.y += delta * 1.5;
                p.iconMesh.rotation.x = Math.sin(performance.now() * 0.002) * 0.2;
            }
        });

        this.pinchCooldown = Math.max(0, this.pinchCooldown - delta);
        const handsSeen = { Left: false, Right: false };
        let anyHover = null;

        // Update Hand Avatars with 3D position & precision laser pointing
        for (const hand of trackingData.hands) {
            const avatar = this.handAvatars ? this.handAvatars[hand.label] : null;
            if (!avatar) continue;

            handsSeen[hand.label] = true;

            // 1. Target 3D Hand Position (from filtered palm)
            const worldX = hand.screenX * 3.4;
            const worldY = hand.screenY * 2.4 - 0.15;
            const worldZ = -2.6 - (hand.palm.z || 0) * 2.5;
            avatar.group.position.lerp(new THREE.Vector3(worldX, worldY, worldZ), 0.6);

            // 2. Precision Index Pointer Screen Position
            const pointerX = hand.pointer ? hand.pointer.screenX : hand.screenX;
            const pointerY = hand.pointer ? hand.pointer.screenY : hand.screenY;

            // 3. Raycast through index pointer screen coordinates
            const pointerRaycaster = new THREE.Raycaster();
            pointerRaycaster.setFromCamera(new THREE.Vector2(pointerX, pointerY), this.camera);
            const cardMeshes = this.gamePods.map(p => p.card);
            const hits = pointerRaycaster.intersectObjects(cardMeshes);

            let targetPoint = null;
            let targetNormal = new THREE.Vector3(0, 0, 1);
            let hitPod = null;

            if (hits.length > 0) {
                targetPoint = hits[0].point.clone();
                if (hits[0].face) {
                    targetNormal.copy(hits[0].face.normal).applyQuaternion(hits[0].object.quaternion);
                }
                hitPod = this.gamePods.find(p => p.card === hits[0].object);
            } else {
                // Magnetic proximity snap: check if ray is near any pod
                let minPodDist = 1.35;
                for (const pod of this.gamePods) {
                    const podCenter = pod.group.position.clone().add(new THREE.Vector3(0, 0.4, 0));
                    const distToRay = pointerRaycaster.ray.distanceToPoint(podCenter);
                    if (distToRay < minPodDist) {
                        minPodDist = distToRay;
                        hitPod = pod;
                        targetPoint = podCenter.clone().add(new THREE.Vector3(0, 0, 0.15));
                        targetNormal.set(0, 0, 1).applyQuaternion(pod.group.quaternion);
                        break;
                    }
                }
                if (!targetPoint) {
                    targetPoint = pointerRaycaster.ray.origin.clone().addScaledVector(pointerRaycaster.ray.direction, 8.5);
                }
            }

            // 4. Aim the hand model directly at the targetPoint!
            const aimDir = targetPoint.clone().sub(avatar.group.position).normalize();
            let normalVec = new THREE.Vector3(0, 0, 1);
            if (hand.orientation && hand.orientation.normal) {
                normalVec.set(hand.orientation.normal.x, hand.orientation.normal.y, hand.orientation.normal.z).normalize();
            }
            const sideVec = new THREE.Vector3().crossVectors(aimDir, normalVec).normalize();
            const orthoNormal = new THREE.Vector3().crossVectors(sideVec, aimDir).normalize();
            const aimMatrix = new THREE.Matrix4().makeBasis(sideVec, aimDir, orthoNormal);
            const targetQuat = new THREE.Quaternion().setFromRotationMatrix(aimMatrix);
            avatar.group.quaternion.slerp(targetQuat, 0.55);

            // 5. Articulate fingers with real curls!
            if (hand.curls) {
                const c = hand.curls;
                // Thumb
                avatar.fingers[0].root.rotation.x = c.thumb * 0.4;
                avatar.fingers[0].distGroup.rotation.x = c.thumb * 0.8;
                // Index
                avatar.fingers[1].root.rotation.x = c.index * 1.1;
                avatar.fingers[1].distGroup.rotation.x = c.index * 1.2;
                // Middle
                avatar.fingers[2].root.rotation.x = c.middle * 1.2;
                avatar.fingers[2].distGroup.rotation.x = c.middle * 1.3;
                // Ring
                avatar.fingers[3].root.rotation.x = c.ring * 1.2;
                avatar.fingers[3].distGroup.rotation.x = c.ring * 1.3;
                // Pinky
                avatar.fingers[4].root.rotation.x = c.pinky * 1.1;
                avatar.fingers[4].distGroup.rotation.x = c.pinky * 1.2;
            }

            // Core repulsor scale during pinch
            if (hand.isPinching) {
                avatar.core.scale.set(1.5, 1.5, 1.5);
            } else {
                avatar.core.scale.set(1.0, 1.0, 1.0);
            }

            // 6. Update Laser Beam from Index Fingertip to Target Point
            const tipWorld = new THREE.Vector3();
            if (avatar.indexTip) {
                avatar.indexTip.getWorldPosition(tipWorld);
            } else {
                tipWorld.copy(avatar.group.position);
            }

            const beamVec = targetPoint.clone().sub(tipWorld);
            const beamDist = beamVec.length();

            avatar.laserGroup.position.copy(tipWorld).addScaledVector(beamVec, 0.5);
            avatar.laserGroup.lookAt(targetPoint);
            avatar.laserGroup.rotateX(Math.PI / 2);
            avatar.laserCore.scale.set(1, beamDist, 1);
            avatar.laserAura.scale.set(1, beamDist, 1);
            avatar.laserGroup.visible = true;

            // 7. Reticle & Interaction Logic
            if (hitPod) {
                anyHover = hitPod;
                avatar.reticleGroup.position.copy(targetPoint).addScaledVector(targetNormal, 0.05);
                avatar.reticleGroup.lookAt(targetPoint.clone().add(targetNormal));
                avatar.reticleGroup.visible = true;

                // Animate reticle crosshair
                avatar.reticleMid.rotation.z += delta * 3;
                const pulse = 1.0 + Math.sin(performance.now() * 0.009) * 0.12;
                avatar.reticleOuter.scale.set(pulse, pulse, pulse);

                if (this.hoveredPod !== hitPod) {
                    this.hoveredPod = hitPod;
                    this.dwellTimer = 0;
                    if (window.soundFx) window.soundFx.playUiHover();
                }

                // Elevate card
                hitPod.group.position.y = THREE.MathUtils.lerp(hitPod.group.position.y, hitPod.baseY + 0.35, 0.25);
                hitPod.card.material.opacity = 1.0;

                // Dwell Progress (auto-select if held for 0.75s)
                this.dwellTimer = (this.dwellTimer || 0) + delta;
                const dwellPct = Math.min(1.0, this.dwellTimer / 0.75);
                avatar.updateDwell(dwellPct);

                // Check Triggers: Pinch, Dwell Complete, or Forward Push
                const isForwardPush = hand.velocity && hand.velocity.z < -1.8;
                if ((hand.isPinching || dwellPct >= 1.0 || isForwardPush) && this.pinchCooldown <= 0) {
                    this.pinchCooldown = 1.2;
                    this.launchGame(hitPod.id);
                }
            } else {
                avatar.reticleGroup.visible = false;
                avatar.updateDwell(0);
                this.dwellTimer = 0;
            }
        }

        // Hide unseen hands and lasers
        ['Left', 'Right'].forEach(side => {
            if (!handsSeen[side] && this.handAvatars && this.handAvatars[side]) {
                this.handAvatars[side].group.position.set(0, -99, 0);
                if (this.handAvatars[side].laserGroup) this.handAvatars[side].laserGroup.visible = false;
                if (this.handAvatars[side].reticleGroup) this.handAvatars[side].reticleGroup.visible = false;
            }
        });

        // Reset unhovered pods
        if (!anyHover && this.hoveredPod) {
            this.hoveredPod.group.position.y = THREE.MathUtils.lerp(this.hoveredPod.group.position.y, this.hoveredPod.baseY, 0.2);
            this.hoveredPod.card.material.opacity = 0.85;
            this.hoveredPod = null;
        }
    }

    updateGameHud() {
        if (!this.currentGame) return;
        const g = this.currentGame;

        const scoreElem = document.getElementById('hud-score');
        const comboElem = document.getElementById('hud-combo');
        const hpBar = document.getElementById('hud-hp-bar');

        if (scoreElem) scoreElem.textContent = g.score || 0;
        if (comboElem) {
            if (g.matchPercent !== undefined) {
                comboElem.textContent = `MATCH: ${Math.round(g.matchPercent)}% | ${g.combo}x`;
            } else {
                comboElem.textContent = g.combo ? `${g.combo}x COMBO` : (g.multiplier ? `${g.multiplier}x` : '');
            }
        }
        if (hpBar) {
            let pct = 100;
            if (g.strikes !== undefined && g.maxStrikes) {
                pct = Math.max(0, 100 - (g.strikes / g.maxStrikes) * 100);
            } else if (g.health !== undefined) {
                pct = Math.max(0, Math.min(100, g.health));
            }
            hpBar.style.width = pct + '%';
            if (pct < 35) hpBar.style.backgroundColor = '#ff0055';
            else hpBar.style.backgroundColor = '#00f3ff';
        }
    }
}

window.vrHub = new VRHub();
