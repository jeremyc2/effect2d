# Beacon Run

`Beacon Run` is the first real small game pressure-test for `effect2d`.

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

The entry point is [main.ts](./main.ts).
The composition root is [BeaconRunGame.ts](./game/BeaconRunGame.ts).
