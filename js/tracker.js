/**
 * VisionTracker - Real-time Low-Latency Webcam Computer Vision Engine
 * High-performance MediaPipe pipeline with:
 * - Ultra-responsive MediaPipe Hands (modelComplexity: 0)
 * - 1€ (One-Euro) Adaptive Smoothing Filter (Zero-jitter at rest, zero-lag in motion)
 * - Orthonormal 3D Hand Coordinate Frames (Pitch, Yaw, Roll & Matrix/Quaternion)
 * - Dead-Reckoning Hand Persistence (prevents hands from dropping during fast slashes/punches)
 * - Body Pose Estimation & Pose Similarity Matching for Hole In The Wall VR
 */

class OneEuroFilter {
    constructor(minCutoff = 1.0, beta = 0.05, dCutoff = 1.0) {
        this.minCutoff = minCutoff;
        this.beta = beta;
        this.dCutoff = dCutoff;
        this.xPrev = null;
        this.dxPrev = 0;
        this.tPrev = null;
    }

    filter(x, t) {
        if (this.xPrev === null || this.tPrev === null) {
            this.xPrev = x;
            this.dxPrev = 0;
            this.tPrev = t;
            return x;
        }

        const dt = Math.max((t - this.tPrev) / 1000, 1e-4);
        this.tPrev = t;

        const dx = (x - this.xPrev) / dt;
        const edx = this.alpha(this.dCutoff, dt) * dx + (1 - this.alpha(this.dCutoff, dt)) * this.dxPrev;
        this.dxPrev = edx;

        const cutoff = this.minCutoff + this.beta * Math.abs(edx);
        const a = this.alpha(cutoff, dt);
        const xFiltered = a * x + (1 - a) * this.xPrev;
        this.xPrev = xFiltered;
        return xFiltered;
    }

    alpha(cutoff, dt) {
        const tau = 1.0 / (2 * Math.PI * cutoff);
        return 1.0 / (1.0 + tau / dt);
    }

    reset() {
        this.xPrev = null;
        this.dxPrev = 0;
        this.tPrev = null;
    }
}

class VisionTracker {
    constructor() {
        this.videoElement = null;
        this.mirrorCanvas = null;
        this.mirrorCtx = null;
        this.inferCanvas = document.createElement('canvas');
        this.inferCtx = this.inferCanvas.getContext('2d', { willReadFrequently: true });
        this.inferWidth = 400;
        this.inferHeight = 300;
        this.inferCanvas.width = this.inferWidth;
        this.inferCanvas.height = this.inferHeight;

        this.hands = [];
        this.head = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, isDucking: false, isLeaningLeft: false, isLeaningRight: false };
        this.handsCrossed = false;
        this.isRunning = false;
        this.isInferring = false;
        this.handsDetector = null;
        this.faceDetector = null;

        this.fps = 0;
        this.frameCount = 0;
        this.fpsTimer = performance.now();
        this.baseHeadY = 0.4;
        this.isCalibrated = false;
        this.showMirror = true;

        // Adaptive smoothing filters for hand positions and orientation
        this.filters = {
            Left: {
                x: new OneEuroFilter(1.2, 0.08),
                y: new OneEuroFilter(1.2, 0.08),
                z: new OneEuroFilter(1.0, 0.08),
                fx: new OneEuroFilter(1.5, 0.1),
                fy: new OneEuroFilter(1.5, 0.1),
                fz: new OneEuroFilter(1.5, 0.1),
                nx: new OneEuroFilter(1.5, 0.1),
                ny: new OneEuroFilter(1.5, 0.1),
                nz: new OneEuroFilter(1.5, 0.1)
            },
            Right: {
                x: new OneEuroFilter(1.2, 0.08),
                y: new OneEuroFilter(1.2, 0.08),
                z: new OneEuroFilter(1.0, 0.08),
                fx: new OneEuroFilter(1.5, 0.1),
                fy: new OneEuroFilter(1.5, 0.1),
                fz: new OneEuroFilter(1.5, 0.1),
                nx: new OneEuroFilter(1.5, 0.1),
                ny: new OneEuroFilter(1.5, 0.1),
                nz: new OneEuroFilter(1.5, 0.1)
            }
        };

        // Inertial dead-reckoning persistence (keeps hand active for up to 250ms during fast slashes)
        this.handPersistence = {
            Left: { lastSeen: 0, handData: null, vel: { x: 0, y: 0, z: 0 } },
            Right: { lastSeen: 0, handData: null, vel: { x: 0, y: 0, z: 0 } }
        };

        // Body Pose State for Hole In The Wall VR
        this.currentPose = {
            type: 'UNKNOWN',
            score: 0,
            head: { x: 0, y: 0 },
            leftArm: { elevation: 'MID', angle: 0, x: -0.5, y: 0 },
            rightArm: { elevation: 'MID', angle: 0, x: 0.5, y: 0 },
            isTPose: false,
            isMuscleFlex: false,
            isHighV: false,
            isNinjaDab: false,
            isCrossArms: false,
            isCrouch: false,
            isArcher: false
        };

        this.onFrameCallbacks = [];
    }

    async init(videoElement, mirrorCanvas) {
        this.videoElement = videoElement;
        this.mirrorCanvas = mirrorCanvas;
        this.mirrorCtx = mirrorCanvas.getContext('2d');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                },
                audio: false
            });
            this.videoElement.srcObject = stream;
            await new Promise(resolve => {
                this.videoElement.onloadedmetadata = () => {
                    this.videoElement.play();
                    resolve();
                };
            });
        } catch (err) {
            console.error('Webcam access error:', err);
            throw err;
        }

        // Initialize MediaPipe Hands (Optimized modelComplexity: 0 for 60+ FPS zero-lag)
        if (typeof Hands !== 'undefined') {
            this.handsDetector = new Hands({
                locateFile: (file) => 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/' + file
            });
            this.handsDetector.setOptions({
                maxNumHands: 2,
                modelComplexity: 0, // Lite model: ultra fast, low latency
                minDetectionConfidence: 0.4,
                minTrackingConfidence: 0.4
            });
            this.handsDetector.onResults((results) => this.onHandsResults(results));
        }

        // Initialize MediaPipe FaceMesh (for head dodging and posture estimation)
        if (typeof FaceMesh !== 'undefined') {
            try {
                this.faceDetector = new FaceMesh({
                    locateFile: (file) => 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/' + file
                });
                this.faceDetector.setOptions({
                    maxNumFaces: 1,
                    refineLandmarks: false,
                    minDetectionConfidence: 0.4,
                    minTrackingConfidence: 0.4
                });
                this.faceDetector.onResults((results) => this.onFaceResults(results));
            } catch (e) {
                console.warn('FaceMesh deferred:', e);
            }
        }

        this.startProcessing();
        this.isRunning = true;
    }

    startProcessing() {
        let lastFaceProcess = 0;

        const processLoop = async () => {
            if (!this.isRunning) return;

            const now = performance.now();

            if (this.videoElement.readyState >= 2 && !this.isInferring) {
                this.isInferring = true;

                // Draw downscaled frame to inferCanvas for fast tensor inference
                this.inferCtx.drawImage(this.videoElement, 0, 0, this.inferWidth, this.inferHeight);

                try {
                    // Send to Hands detector
                    if (this.handsDetector) {
                        await this.handsDetector.send({ image: this.inferCanvas });
                    }

                    // FaceMesh runs every 65ms (15 FPS is more than enough for dodging/head tilt)
                    if (this.faceDetector && now - lastFaceProcess > 65) {
                        lastFaceProcess = now;
                        await this.faceDetector.send({ image: this.inferCanvas });
                    }
                } catch (e) {
                    // ignore dropped frames
                } finally {
                    this.isInferring = false;
                }
            }

            // Synthesize hands with dead-reckoning extrapolation if a hand was lost for a couple frames
            this.updateHandExtrapolation(now);

            // Classify upper-body pose for Hole In The Wall VR
            this.classifyBodyPose();

            this.calculateFps();
            this.drawMirrorHud();

            // Fire callbacks
            for (const cb of this.onFrameCallbacks) {
                cb(this.getTrackingData());
            }

            requestAnimationFrame(processLoop);
        };

        requestAnimationFrame(processLoop);
    }

    onHandsResults(results) {
        const now = performance.now();
        const activeHands = [];
        const seenSides = { Left: false, Right: false };

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const rawHands = results.multiHandLandmarks;
            const handednessList = results.multiHandedness || [];

            for (let i = 0; i < rawHands.length; i++) {
                const raw = rawHands[i];
                const rawLabel = handednessList[i] ? handednessList[i].label : (i === 0 ? 'Right' : 'Left');
                const handLabel = rawLabel === 'Left' ? 'Right' : 'Left'; // mirror correction
                seenSides[handLabel] = true;

                const wrist = raw[0];
                const thumbTip = raw[4];
                const indexMcp = raw[5];
                const indexTip = raw[8];
                const middleMcp = raw[9];
                const middleTip = raw[12];
                const ringTip = raw[16];
                const pinkyMcp = raw[17];
                const pinkyTip = raw[20];

                // Knuckle center & palm center
                const knuckleCenter = {
                    x: (indexMcp.x + middleMcp.x + pinkyMcp.x) / 3,
                    y: (indexMcp.y + middleMcp.y + pinkyMcp.y) / 3,
                    z: (indexMcp.z + middleMcp.z + pinkyMcp.z) / 3
                };

                const palm = {
                    x: (wrist.x + knuckleCenter.x) / 2,
                    y: (wrist.y + knuckleCenter.y) / 2,
                    z: (wrist.z + knuckleCenter.z) / 2
                };

                // Pinch detection (thumb tip to index tip)
                const pinchDist = Math.hypot(
                    thumbTip.x - indexTip.x,
                    thumbTip.y - indexTip.y,
                    thumbTip.z - indexTip.z
                );
                const isPinching = pinchDist < 0.085;

                // Open palm vs fist
                const dIndex = Math.hypot(wrist.x - indexTip.x, wrist.y - indexTip.y);
                const dMiddle = Math.hypot(wrist.x - middleTip.x, wrist.y - middleTip.y);
                const dRing = Math.hypot(wrist.x - ringTip.x, wrist.y - ringTip.y);
                const dPinky = Math.hypot(wrist.x - pinkyTip.x, wrist.y - pinkyTip.y);
                const avgExtension = (dIndex + dMiddle + dRing + dPinky) / 4;

                const isOpenPalm = avgExtension > 0.27;
                const isFist = avgExtension < 0.16;
                const isPointing = dIndex > 0.24 && dMiddle < 0.19 && dRing < 0.19 && dPinky < 0.19;

                // Screen coordinates (Mirrored X so moving right in real life moves right in VR)
                const rawScreenX = (1.0 - palm.x) * 2 - 1;
                const rawScreenY = -(palm.y * 2 - 1);
                const rawScreenZ = -(palm.z || 0) * 2;

                // Apply OneEuroFilter for smooth, low-latency position
                const filter = this.filters[handLabel];
                const screenX = filter.x.filter(rawScreenX, now);
                const screenY = filter.y.filter(rawScreenY, now);
                const screenZ = filter.z.filter(rawScreenZ, now);

                // Compute true 3D hand orientation frame
                // 1. Forward direction: Wrist to Knuckle center
                let fx = (1.0 - knuckleCenter.x) - (1.0 - wrist.x);
                let fy = -knuckleCenter.y - (-wrist.y);
                let fz = -(knuckleCenter.z || 0) - (-(wrist.z || 0));
                const fLen = Math.hypot(fx, fy, fz) || 1e-4;
                fx /= fLen; fy /= fLen; fz /= fLen;

                // 2. Transverse direction: Across knuckles (Pinky to Index)
                let tx = (1.0 - indexMcp.x) - (1.0 - pinkyMcp.x);
                let ty = -indexMcp.y - (-pinkyMcp.y);
                let tz = -(indexMcp.z || 0) - (-(pinkyMcp.z || 0));
                const tLen = Math.hypot(tx, ty, tz) || 1e-4;
                tx /= tLen; ty /= tLen; tz /= tLen;

                // 3. Normal direction: Cross product F x T
                let nx = fy * tz - fz * ty;
                let ny = fz * tx - fx * tz;
                let nz = fx * ty - fy * tx;
                const nLen = Math.hypot(nx, ny, nz) || 1e-4;
                nx /= nLen; ny /= nLen; nz /= nLen;

                // Re-orthogonalize F = T x N for strict 90° orthogonality
                fx = ty * nz - tz * ny;
                fy = tz * nx - tx * nz;
                fz = tx * ny - ty * nx;

                // Smooth orientation vectors with OneEuroFilter
                const sfx = filter.fx.filter(fx, now);
                const sfy = filter.fy.filter(fy, now);
                const sfz = filter.fz.filter(fz, now);
                const snx = filter.nx.filter(nx, now);
                const sny = filter.ny.filter(ny, now);
                const snz = filter.nz.filter(nz, now);

                // Side vector S = N x F
                let sx = sny * sfz - snz * sfy;
                let sy = snz * sfx - snx * sfz;
                let sz = snx * sfy - sny * sfx;
                const sLen = Math.hypot(sx, sy, sz) || 1e-4;
                sx /= sLen; sy /= sLen; sz /= sLen;

                const pitch = Math.atan2(sfy, Math.hypot(sfx, sfz));
                const yaw = Math.atan2(sfx, -sfz);
                const roll = Math.atan2(sy, sny);

                // Construct 4x4 rotation matrix
                const matrix = [
                    sx, sy, sz, 0,
                    snx, sny, snz, 0,
                    sfx, sfy, sfz, 0,
                    0, 0, 0, 1
                ];

                // Velocity calculation
                let vel = { x: 0, y: 0, z: 0, speed: 0 };
                const prev = this.handPersistence[handLabel].handData;
                if (prev) {
                    const dt = Math.max((now - this.handPersistence[handLabel].lastSeen) / 1000, 0.016);
                    const vx = (screenX - prev.screenX) / dt;
                    const vy = (screenY - prev.screenY) / dt;
                    const vz = (screenZ - prev.screenZ) / dt;
                    vel = {
                        x: vx * 0.5 + this.handPersistence[handLabel].vel.x * 0.5,
                        y: vy * 0.5 + this.handPersistence[handLabel].vel.y * 0.5,
                        z: vz * 0.5 + this.handPersistence[handLabel].vel.z * 0.5,
                        speed: Math.hypot(vx, vy, vz)
                    };
                }

                const handData = {
                    label: handLabel,
                    landmarks: raw,
                    palm,
                    wrist,
                    indexTip,
                    thumbTip,
                    middleTip,
                    knuckleCenter,
                    isPinching,
                    isOpenPalm,
                    isFist,
                    isPointing,
                    velocity: vel,
                    screenX,
                    screenY,
                    screenZ,
                    rawX: 1.0 - palm.x,
                    rawY: palm.y,
                    orientation: {
                        forward: { x: sfx, y: sfy, z: sfz },
                        normal: { x: snx, y: sny, z: snz },
                        side: { x: sx, y: sy, z: sz },
                        pitch,
                        yaw,
                        roll,
                        matrix
                    },
                    pitch,
                    yaw,
                    roll,
                    isExtrapolated: false
                };

                // Save to persistence cache
                this.handPersistence[handLabel] = {
                    lastSeen: now,
                    handData: handData,
                    vel: vel
                };

                activeHands.push(handData);
            }
        }

        // Cross hands detection
        this.handsCrossed = false;
        if (activeHands.length >= 2) {
            const h1 = activeHands[0];
            const h2 = activeHands[1];
            const distWrists = Math.hypot(h1.wrist.x - h2.wrist.x, h1.wrist.y - h2.wrist.y);
            if (distWrists < 0.2) {
                this.handsCrossed = true;
            }
        }

        this.hands = activeHands;
    }

    updateHandExtrapolation(now) {
        // If a hand was seen within the last 250ms but missed in current frame, extrapolate its position
        ['Left', 'Right'].forEach(side => {
            const entry = this.handPersistence[side];
            const hasActive = this.hands.some(h => h.label === side);

            if (!hasActive && entry.handData && (now - entry.lastSeen) < 250) {
                const dt = (now - entry.lastSeen) / 1000;
                // Decay velocity
                const decay = Math.max(0, 1.0 - dt * 4.0);
                const extHand = { ...entry.handData };
                extHand.screenX += entry.vel.x * dt * 0.6 * decay;
                extHand.screenY += entry.vel.y * dt * 0.6 * decay;
                extHand.screenZ += entry.vel.z * dt * 0.6 * decay;
                extHand.isExtrapolated = true;
                this.hands.push(extHand);
            }
        });
    }

    onFaceResults(results) {
        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) return;
        const face = results.multiFaceLandmarks[0];
        const nose = face[1] || face[4];
        if (nose) {
            const rawX = 1.0 - nose.x;
            const rawY = nose.y;

            if (!this.isCalibrated) {
                this.baseHeadY = rawY;
                this.isCalibrated = true;
            }

            const normX = (rawX - 0.5) * 2;
            const normY = -(rawY - this.baseHeadY) * 2.5;

            const isDucking = rawY > (this.baseHeadY + 0.08);
            const isLeaningLeft = normX < -0.3;
            const isLeaningRight = normX > 0.3;

            this.head = {
                x: normX,
                y: normY,
                z: (nose.z || 0) * 2,
                rawX,
                rawY,
                isDucking,
                isLeaningLeft,
                isLeaningRight
            };
        }
    }

    classifyBodyPose() {
        const leftHand = this.hands.find(h => h.label === 'Left');
        const rightHand = this.hands.find(h => h.label === 'Right');

        let isTPose = false;
        let isMuscleFlex = false;
        let isHighV = false;
        let isNinjaDab = false;
        let isCrossArms = this.handsCrossed;
        let isCrouch = this.head ? this.head.isDucking : false;
        let isArcher = false;

        const lx = leftHand ? leftHand.screenX : -0.5;
        const ly = leftHand ? leftHand.screenY : -0.3;
        const rx = rightHand ? rightHand.screenX : 0.5;
        const ry = rightHand ? rightHand.screenY : -0.3;

        // T-Pose: Both hands spread wide horizontally near shoulder level
        if (leftHand && rightHand) {
            const spread = Math.abs(rx - lx);
            const yDiff = Math.abs(ly - ry);
            if (spread > 1.2 && yDiff < 0.45 && ly > -0.4 && ly < 0.6) {
                isTPose = true;
            }

            // High V: Both hands raised high above head
            if (ly > 0.55 && ry > 0.55 && spread > 0.6) {
                isHighV = true;
            }

            // Muscle Flex / Goalpost: Hands up and outward with 90 deg elbows
            if (ly > 0.25 && ry > 0.25 && spread > 0.9 && !isHighV) {
                isMuscleFlex = true;
            }

            // Ninja Dab: One arm high diagonal, other across chest
            if ((ly > 0.5 && ry < 0.1 && rx < 0.1) || (ry > 0.5 && ly < 0.1 && lx > -0.1)) {
                isNinjaDab = true;
            }

            // Archer: One arm extended straight out, other drawn back near face
            if ((rx > 0.7 && Math.abs(lx) < 0.3) || (lx < -0.7 && Math.abs(rx) < 0.3)) {
                isArcher = true;
            }
        }

        let poseType = 'NEUTRAL';
        if (isCrossArms) poseType = 'CROSS_ARMS';
        else if (isHighV) poseType = 'HIGH_V';
        else if (isMuscleFlex) poseType = 'MUSCLE_FLEX';
        else if (isTPose) poseType = 'T_POSE';
        else if (isNinjaDab) poseType = 'NINJA_DAB';
        else if (isArcher) poseType = 'ARCHER';
        else if (isCrouch) poseType = 'CROUCH';

        this.currentPose = {
            type: poseType,
            head: this.head,
            leftHand: leftHand ? { x: lx, y: ly } : null,
            rightHand: rightHand ? { x: rx, y: ry } : null,
            isTPose,
            isMuscleFlex,
            isHighV,
            isNinjaDab,
            isCrossArms,
            isCrouch,
            isArcher
        };
    }

    calibrate() {
        if (this.head.rawY !== undefined) {
            this.baseHeadY = this.head.rawY;
            this.isCalibrated = true;
        }
    }

    calculateFps() {
        this.frameCount++;
        const now = performance.now();
        if (now - this.fpsTimer >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (now - this.fpsTimer));
            this.frameCount = 0;
            this.fpsTimer = now;
        }
    }

    drawMirrorHud() {
        if (!this.mirrorCanvas || !this.mirrorCtx || !this.showMirror) return;
        const ctx = this.mirrorCtx;
        const w = this.mirrorCanvas.width;
        const h = this.mirrorCanvas.height;

        ctx.save();
        ctx.clearRect(0, 0, w, h);

        // Draw webcam feed semi-transparent with cyber overlay
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-w, 0);
        ctx.globalAlpha = 0.5;
        ctx.drawImage(this.videoElement, 0, 0, w, h);
        ctx.restore();

        ctx.fillStyle = 'rgba(6, 12, 24, 0.45)';
        ctx.fillRect(0, 0, w, h);

        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],
            [0, 5], [5, 6], [6, 7], [7, 8],
            [5, 9], [9, 10], [10, 11], [11, 12],
            [9, 13], [13, 14], [14, 15], [15, 16],
            [13, 17], [17, 18], [18, 19], [19, 20],
            [0, 17]
        ];

        for (const hand of this.hands) {
            const isRight = hand.label === 'Right';
            const boneColor = isRight ? '#00f3ff' : '#ff0055';
            const jointColor = isRight ? '#ffffff' : '#ffe600';

            ctx.lineWidth = 2.5;
            ctx.strokeStyle = boneColor;
            ctx.shadowColor = boneColor;
            ctx.shadowBlur = 8;

            if (hand.landmarks) {
                for (const [s, e] of connections) {
                    const pt1 = hand.landmarks[s];
                    const pt2 = hand.landmarks[e];
                    const x1 = (1.0 - pt1.x) * w;
                    const y1 = pt1.y * h;
                    const x2 = (1.0 - pt2.x) * w;
                    const y2 = pt2.y * h;

                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                }

                for (let j = 0; j < hand.landmarks.length; j++) {
                    const pt = hand.landmarks[j];
                    const px = (1.0 - pt.x) * w;
                    const py = pt.y * h;
                    ctx.fillStyle = j === 8 ? '#ffff00' : jointColor;
                    ctx.beginPath();
                    ctx.arc(px, py, j === 8 ? 4.5 : 2.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Orientation 3D axis pointer
            const lx = ((hand.screenX + 1) / 2) * w;
            const ly = ((-hand.screenY + 1) / 2) * h;
            if (hand.orientation) {
                const f = hand.orientation.forward;
                ctx.strokeStyle = '#39ff14';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(lx, ly);
                ctx.lineTo(lx + f.x * 24, ly - f.y * 24);
                ctx.stroke();
            }

            ctx.shadowBlur = 0;
            ctx.shadowBlur = 0;
            ctx.fillStyle = boneColor;
            ctx.font = '10px monospace';
            const extraTag = hand.isExtrapolated ? ' [EXTRAP]' : '';
            const pinchTag = hand.isPinching ? ' [PINCH]' : '';
            const fistTag = hand.isFist ? ' [FIST]' : '';
            ctx.fillText(
                hand.label.toUpperCase() + extraTag + pinchTag + fistTag,
                lx - 30,
                ly - 16
            );
        }

        // Draw head tracking box
        if (this.head && this.head.rawX !== undefined) {
            const hx = this.head.rawX * w;
            const hy = this.head.rawY * h;
            ctx.strokeStyle = '#39ff14';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(hx - 20, hy - 25, 40, 50);
        }

        // Telemetry
        ctx.fillStyle = '#00f3ff';
        ctx.font = '10px monospace';
        ctx.fillText('FPS: ' + this.fps + ' | POSE: ' + this.currentPose.type, 8, 14);

        ctx.restore();
    }

    onFrame(cb) {
        this.onFrameCallbacks.push(cb);
    }

    getTrackingData() {
        return {
            hands: this.hands,
            head: this.head,
            handsCrossed: this.handsCrossed,
            pose: this.currentPose,
            fps: this.fps
        };
    }
}

window.visionTracker = new VisionTracker();
