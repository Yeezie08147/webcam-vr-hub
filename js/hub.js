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
            Left: this.createCyberHand(0xff0055),
            Right: this.createCyberHand(0x00f3ff)
        };
        this.hubGroup.add(this.handAvatars.Left.group);
        this.hubGroup.add(this.handAvatars.Right.group);
    }

    createCyberHand(colorHex) {
        const group = new THREE.Group();

        // Palm chassis
        const palmGeo = new THREE.BoxGeometry(0.38, 0.44, 0.14);
        const palmMat = new THREE.MeshStandardMaterial({
            color: 0x101a2e,
            metalness: 0.8,
            roughness: 0.2,
            emissive: colorHex,
            emissiveIntensity: 0.35
        });
        const palm = new THREE.Mesh(palmGeo, palmMat);
        group.add(palm);

        // Glowing Palm Core Crystal
        const coreGeo = new THREE.OctahedronGeometry(0.12);
        const coreMat = new THREE.MeshBasicMaterial({ color: colorHex });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.z = 0.09;
        group.add(core);

        // Wrist cuff
        const cuffGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.24, 12);
        const cuffMat = new THREE.MeshStandardMaterial({ color: 0x080e1a, metalness: 0.9, roughness: 0.3 });
        const cuff = new THREE.Mesh(cuffGeo, cuffMat);
        cuff.position.y = -0.34;
        group.add(cuff);

        // 5 Articulated Finger Rays
        const fingerRays = [];
        const fingerOffsets = [
            { x: -0.22, y: -0.05, len: 0.28 }, // thumb
            { x: -0.12, y: 0.22, len: 0.38 },  // index
            { x: -0.01, y: 0.24, len: 0.42 },  // middle
            { x: 0.10, y: 0.22, len: 0.38 },   // ring
            { x: 0.20, y: 0.16, len: 0.30 }    // pinky
        ];

        fingerOffsets.forEach((fo) => {
            const fGroup = new THREE.Group();
            fGroup.position.set(fo.x, fo.y, 0);

            const segGeo = new THREE.CylinderGeometry(0.035, 0.035, fo.len, 8);
            const segMat = new THREE.MeshBasicMaterial({ color: colorHex });
            const seg = new THREE.Mesh(segGeo, segMat);
            seg.position.y = fo.len / 2;
            fGroup.add(seg);

            const tipGeo = new THREE.SphereGeometry(0.045, 8, 8);
            const tipMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const tip = new THREE.Mesh(tipGeo, tipMat);
            tip.position.y = fo.len;
            fGroup.add(tip);

            group.add(fGroup);
            fingerRays.push(fGroup);
        });

        // Glowing Laser Pointer shooting forward from index finger along +Y
        const laserGeo = new THREE.CylinderGeometry(0.015, 0.015, 16, 8);
        const laserMat = new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.75,
            blending: THREE.AdditiveBlending
        });
        const laser = new THREE.Mesh(laserGeo, laserMat);
        laser.position.set(-0.12, 0.22 + 8.0, 0);
        group.add(laser);

        // Reticle target on card
        const reticleGeo = new THREE.RingGeometry(0.08, 0.16, 16);
        const reticleMat = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide });
        const reticle = new THREE.Mesh(reticleGeo, reticleMat);
        reticle.visible = false;
        this.hubGroup.add(reticle);

        group.position.set(0, -99, 0);

        return {
            group,
            palm,
            core,
            fingerRays,
            laser,
            reticle,
            colorHex
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
            // Hide Holo-deck & Hub hands
            this.hubGroup.visible = false;
            if (this.handAvatars) {
                this.handAvatars.Left.group.visible = false;
                this.handAvatars.Right.group.visible = false;
                this.handAvatars.Left.reticle.visible = false;
                this.handAvatars.Right.reticle.visible = false;
            }
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
        if (this.handAvatars) {
            this.handAvatars.Left.group.visible = false;
            this.handAvatars.Right.group.visible = false;
            this.handAvatars.Left.reticle.visible = false;
            this.handAvatars.Right.reticle.visible = false;
        }

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

        if (this.currentGame) {
            this.currentGame.stop();
            this.currentGame = null;
            this.currentGameId = null;
        }

        // Show Holo-Deck & Hub hands
        this.hubGroup.visible = true;
        if (this.handAvatars) {
            this.handAvatars.Left.group.visible = true;
            this.handAvatars.Right.group.visible = true;
        }
        this.camera.position.set(0, 0, 0);

        // Update HUD
        document.getElementById('hub-overlay').style.display = 'flex';
        document.getElementById('game-hud').style.display = 'none';
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

        // Update Hand Avatars with 3D position & true orientation
        for (const hand of trackingData.hands) {
            const avatar = this.handAvatars ? this.handAvatars[hand.label] : null;
            if (!avatar) continue;

            handsSeen[hand.label] = true;

            const worldX = hand.screenX * 3.6;
            const worldY = hand.screenY * 2.6 - 0.2;
            const worldZ = -2.8 - (hand.palm.z || 0) * 3;
            avatar.group.position.lerp(new THREE.Vector3(worldX, worldY, worldZ), 0.55);

            // True Hand Orientation in 3D VR Hub
            if (hand.orientation && hand.orientation.matrix) {
                const rotMat = new THREE.Matrix4().fromArray(hand.orientation.matrix);
                const targetQuat = new THREE.Quaternion().setFromRotationMatrix(rotMat);
                avatar.group.quaternion.slerp(targetQuat, 0.45);
            }

            // Finger articulation (pinch, fist, open)
            if (hand.isPinching) {
                avatar.fingerRays[0].rotation.z = 0.5;
                avatar.fingerRays[1].rotation.z = -0.3;
                avatar.core.scale.set(1.4, 1.4, 1.4);
            } else if (hand.isFist) {
                avatar.fingerRays.forEach(f => f.rotation.x = 1.2);
                avatar.core.scale.set(0.8, 0.8, 0.8);
            } else {
                avatar.fingerRays.forEach(f => {
                    f.rotation.x = 0;
                    f.rotation.z = 0;
                });
                avatar.core.scale.set(1.0, 1.0, 1.0);
            }

            // Laser Pointer Raycast towards game pods
            const laserDir = new THREE.Vector3(0, 1, 0).applyQuaternion(avatar.group.quaternion).normalize();
            const laserOrigin = avatar.group.position.clone();
            const raycaster = new THREE.Raycaster(laserOrigin, laserDir);
            const cardMeshes = this.gamePods.map(p => p.card);
            const hits = raycaster.intersectObjects(cardMeshes);

            if (hits.length > 0) {
                const hit = hits[0];
                avatar.reticle.position.copy(hit.point);
                avatar.reticle.position.z += 0.05;
                avatar.reticle.visible = true;

                const pod = this.gamePods.find(p => p.card === hit.object);
                if (pod) {
                    anyHover = pod;
                    if (this.hoveredPod !== pod) {
                        this.hoveredPod = pod;
                        if (window.soundFx) window.soundFx.playUiHover();
                    }
                    pod.group.position.y = pod.baseY + 0.35;
                    pod.card.material.opacity = 1.0;

                    // Mid-air Pinch to select!
                    if (hand.isPinching && this.pinchCooldown <= 0) {
                        this.pinchCooldown = 1.0;
                        this.launchGame(pod.id);
                    }
                }
            } else {
                avatar.reticle.visible = false;
            }
        }

        // Hide unseen hands
        ['Left', 'Right'].forEach(side => {
            if (!handsSeen[side] && this.handAvatars && this.handAvatars[side]) {
                this.handAvatars[side].group.position.set(0, -99, 0);
                this.handAvatars[side].reticle.visible = false;
            }
        });

        // Reset unhovered pods
        if (!anyHover && this.hoveredPod) {
            this.hoveredPod.group.position.y = this.hoveredPod.baseY;
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
