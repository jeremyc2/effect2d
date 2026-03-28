# Beacon Run

`Beacon Run` is the first real small game pressure-test for `Effect2d`.

It is intentionally separate from the starter. The goal is to prove that the
engine can support a new game-specific domain without collapsing back into
starter-specific assumptions.

This game currently exercises:

- a separate Layer-composed game runtime
- its own room content and state services
- a room transition from field to shrine
- a beacon-lighting objective
- save participants for game-specific progress
- a dedicated gameplay and presentation path
- a native Skia window for real keyboard-driven play

The entry point is [main.ts](./main.ts).
The composition root is [BeaconRunGame.ts](./game/BeaconRunGame.ts).

## Run It

From the repo root:

```bash
bun run beacon-run:native
```

Controls:

- `Enter` starts the run from the title screen
- Arrow keys move the scout
- `Space` lights the beacon when standing near it
- `Escape` pauses and unpauses
- `F3` toggles the debug overlay

## Current Native Scope

The current native pass is focused on a real playable window with live device hooks:

- Skia owns the native window, input events, and frame presentation
- `node-web-audio-api` is the native audio output path
- borrowed local assets under `games/beacon-run/assets` provide the initial images and font
- the first music/sfx files are local placeholder assets so the native path stays fully repo-local

Asset provenance is tracked in [assets/SOURCES.md](./assets/SOURCES.md), including the current mix of neighboring `cavern` assets and Freesound-sourced music.
