# 3D Printer Simulator Agent Rules

## Git Push & Vercel Deployments
Because the agent environment runs with a sandboxed dummy `GITHUB_TOKEN` (`github_pat_antigravitydummytoken`), direct `git push` commands will fail or trigger interactive credential prompts that hang the background task.
- To push updates, you MUST use the script `push-to-github.ps1` in the project root.
- The script reads the user's real GitHub token from `secrets.local` (which is gitignored).
- If `secrets.local` contains `YOUR_GITHUB_TOKEN_HERE` or is missing, ask the user to fill in their real GitHub token in `secrets.local` to proceed. Do NOT try to run Git push interactively.

## Changelog & History
- You MUST maintain a log of changes in `changelog.md` in the project root.
- Before making changes, read `changelog.md` to understand context.
- After completing tasks, append a summary of changes, the date, and the goal of the current session to `changelog.md`.
