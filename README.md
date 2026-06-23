# 🛠️ 3D Printer Simulator (FPS Mode)

A premium, interactive 3D Printer Simulator built with **Three.js** and **Vite**. Step into the perspective of a 3D printer nozzle, drive it manually in real-time, customize extrusion parameters, and export your creations directly to STL files.

Live Demo: [printfps.vercel.app](https://printfps.vercel.app)

---

## 🎮 Interactive Controls

| Control | Action |
|:---|:---|
| **`Left-Click` (on screen)** | Start / Lock Pointer to center |
| **`W` `A` `S` `D`** | Move Nozzle (drive the print) |
| **`Space`** | Step Up 1 Layer (Increase Z Height) |
| **`Shift`** | Step Down 1 Layer (Decrease Z Height) |
| **`Left-Click` (held)** | Extrude Filament (Draw / Print) |
| **`Right-Click` (held) + Mouse** | Orbit Camera (3rd Person View) |
| **`V`** | Toggle View (First Person vs. Third Person Orbit) |
| **`+` / `-` or Scroll Wheel** | Zoom In / Zoom Out |
| **`ESC`** | Show Menu / Unlock Pointer |

---

## ✨ Features

- **Dual View Modes**:
  - **First Person (Nozzle Cam)**: The camera follows closely behind the print head, moving dynamically as you print.
  - **Third Person (Orbit Mode)**: Free orbit around the build plate to inspect your print from any angle using right-click to rotate and mouse wheel to zoom.
- **Advanced Slicing/Extrusion Simulation**:
  - Adjust parameters on the fly: **Layer Width**, **Layer Height**, **Print Speed**, **Nozzle Temperature**, **Flow Rate**, and **Acceleration**.
  - Dynamic filament width calculation based on flow rate, speed, temperature, and nozzle scale.
- **Export STL**: High-fidelity triangulation exporter to convert your extruded paths into clean, watertight 3D models ready for real slicing and physical printing!
- **Status Tracking**: Live UI showing Nozzle height (Z-axis in mm) and filament usage.
- **Reset**: Instant hotkey and UI button to reset the build plate and nozzle.

---

## 🚀 Tech Stack

- **Core**: HTML5, Vanilla CSS3 (Glassmorphism, custom glow effects, Outfit font)
- **Engine**: [Three.js](https://threejs.org/) (BufferGeometry, LineSegments, SpriteText, InstancedMesh)
- **Bundler**: Vite
- **Deployment**: Vercel

---

## 📦 Getting Started

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/3esign/3DPrinterFPS.git
   cd 3DPrinterFPS
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the local development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```
