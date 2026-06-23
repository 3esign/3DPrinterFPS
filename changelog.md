# Changelog

All notable changes to the 3D Printer Simulator will be documented in this file.

## [2026-06-23] - WebGL Crash Fix & Automation Setup
### Fixed
- Fixed a persistent console error crash (`Cannot read properties of undefined (reading 'render')`) in `main.js`'s `animate()` loop when WebGL fails to initialize. Added a check to early-return from `animate()` if `renderer` is undefined.

### Added
- Created `push-to-github.ps1` in the project root to automate local building, pushing to GitHub, and directly deploying to Vercel using the credentials from `secrets.local`.
- Created `secrets.local` placeholder for Git-ignored local GitHub and Vercel credentials.
- Created `.agents/AGENTS.md` rule file to enforce automatic push instructions and changelog maintenance rules for future agents.

### Removed
- Removed the temporary overlay Debug Log from `index.html` to prevent harmless third-party extension errors (e.g. MetaMask) from displaying.
