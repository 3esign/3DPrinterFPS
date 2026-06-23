# Changelog

All notable changes to the 3D Printer Simulator will be documented in this file.

## [2026-06-23] - WebGL Crash Fix & Automation Setup
### Fixed
- Fixed a persistent console error crash (`Cannot read properties of undefined (reading 'render')`) in `main.js`'s `animate()` loop when WebGL fails to initialize. Added a check to early-return from `animate()` if `renderer` is undefined.

### Added
- Created `push-to-github.ps1` in the project root to automate local building and pushing to GitHub using the token from `secrets.local`.
- Created `secrets.local` placeholder for Git-ignored local GitHub credentials.
- Created `.agents/AGENTS.md` rule file to enforce automatic push instructions and changelog maintenance rules for future agents.
