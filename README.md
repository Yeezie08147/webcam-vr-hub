# 🥽 Webcam VR Game Hub

[![Lovable](https://img.shields.io/badge/Lovable-Import%20to%20Lovable-7C3AED?style=for-the-badge&logo=lovable)](https://lovable.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Platform: Web & VR](https://img.shields.io/badge/Platform-Web%20%7C%20VR-00f0ff?style=for-the-badge)](https://github.com/Yeezie08147/webcam-vr-hub)

A fully immersive **Webcam VR Holo-Deck** featuring **7 full motion-controlled 3D games** plus the imported TV game show classic **Hole In The Wall VR** — requiring **NO VR headset**, **NO controllers**, and **NO paid APIs**.

Playable in modern browsers using only a standard laptop or desktop webcam!

---

## 🎮 Included Games

1. **🧱 Hole In The Wall VR (GitHub Edition & 3D Runway)**
   - Inspired by the iconic Japanese/American game show (`davidchoo12/hole-in-the-wall-game`).
   - Neon styrofoam walls with 7 body cutout shapes (`T_POSE`, `HIGH_V`, `MUSCLE_FLEX`, `CROSS_ARMS`, `NINJA_DAB`, `ARCHER`, `CROUCH`) approaching you down the runway.
   - Shatters into glowing crystals when matching poses $\ge 80\%$.
   - Bundled with 100% offline TensorFlow.js & PoseNet models.

2. **⚔️ Cyber Saber (Beat Rhythm)**
   - Dual neon energy sabers (Cyan & Magenta) tracking your hands 1:1.
   - Slice incoming rhythmic beat cubes on target with orientation matching.

3. **🥊 Cyber Boxing (Shadow Knockout)**
   - High-speed boxing training with heavy punching bags, combo multipliers, and jab/hook impact particles.

4. **⚡ Bullet Dodge (Superhot Time Dilation)**
   - Matrix-style projectile dodging with real-time head and upper-body tracking.
   - Time moves when you move!

5. **⏳ Chrono Freeze (Tactical Time Control)**
   - Freeze and manipulate falling cyber shards with open palm gesture controls.

6. **✨ Spell Caster (Elemental Gesture Combat)**
   - Cast fireballs, ice shields, and lightning arcs by performing magic hand seals.

7. **🍉 Fruit Ninja 3D (Spatial Blade)**
   - Slice flying watermelons, oranges, and pineapples in full 3D spatial arcs while dodging hazardous bombs.

---

## ⚡ Zero-Lag Tracking & Precision Orientation Engine

- **60–120 FPS Real-Time Inference**: Powered by MediaPipe Hands Lite (`modelComplexity: 0`) decoupled from rendering via an offscreen tensor pipeline.
- **1€ (One-Euro) Adaptive Filter**: Eliminates all microscopic jitter when holding still while maintaining zero latency during rapid strikes and swings.
- **Orthonormal 3D Hand Coordinate Frames**: Constructs mathematical Forward, Transverse, and Normal axes with SLERP quaternion interpolation, eliminating axis flipping and gimbal lock.
- **Dead-Reckoning Velocity Persistence**: Prevents hands or sabers from vanishing when moving ultra-fast or during momentary camera occlusion.

---

## 🚀 How to Import into Lovable

1. Open [lovable.dev](https://lovable.dev).
2. Click **"Import from GitHub"**.
3. Enter repository: **`Yeezie08147/webcam-vr-hub`**.
4. Lovable will immediately import the project, set up the Vite dev server, and render the interactive preview directly inside the Lovable canvas!

---

## 💻 Local Development

```bash
# Clone the repository
git clone https://github.com/Yeezie08147/webcam-vr-hub.git
cd webcam-vr-hub

# Option A: Run with Vite
npm install
npm run dev

# Option B: Run with Python zero-dependency server
python server.py
# Open http://localhost:8765
```

---

## 📜 License
MIT License. 100% Free and Open Source.
