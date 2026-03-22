import { Effect, Layer, ServiceMap } from "effect";
import type { SaveParticipant } from "../../../src/save/SaveDocument.ts";
import { DebugSettingsState } from "../state/DebugSettingsState.ts";
import { PlayerState } from "../state/PlayerState.ts";
import { WorldState } from "../state/WorldState.ts";

export class StarterSaveParticipants extends ServiceMap.Service<
	StarterSaveParticipants,
	{
		readonly all: Effect.Effect<ReadonlyArray<SaveParticipant>>;
	}
>()("effect2d/starter/game/save/StarterSaveParticipants") {
	static readonly layer = Layer.effect(
		StarterSaveParticipants,
		Effect.gen(function* () {
			const debugSettingsState = yield* DebugSettingsState;
			const playerState = yield* PlayerState;
			const worldState = yield* WorldState;

			const participants = [
				{
					capture: playerState.snapshot.pipe(
						Effect.map((snapshot) => ({
							facing: snapshot.facing,
							health: snapshot.health,
							positionX: snapshot.position.x,
							positionY: snapshot.position.y,
						})),
					),
					key: "player",
					restore: Effect.fn("StarterSaveParticipants.restorePlayer")(
						function* (state: Readonly<Record<string, unknown>>) {
							yield* playerState.restore({
								facing:
									state["facing"] === "left" ||
									state["facing"] === "right" ||
									state["facing"] === "up"
										? state["facing"]
										: "down",
								health:
									typeof state["health"] === "number" ? state["health"] : 3,
								position: {
									x:
										typeof state["positionX"] === "number"
											? state["positionX"]
											: 32,
									y:
										typeof state["positionY"] === "number"
											? state["positionY"]
											: 32,
								},
							});
						},
					),
				},
				{
					capture: worldState.snapshot.pipe(
						Effect.map((snapshot) => ({
							currentRoomId: snapshot.currentRoomId,
							inventory: [...snapshot.inventory],
							lanternLit: snapshot.lanternLit,
						})),
					),
					key: "world",
					restore: Effect.fn("StarterSaveParticipants.restoreWorld")(function* (
						state: Readonly<Record<string, unknown>>,
					) {
						yield* worldState.restore({
							currentRoomId:
								typeof state["currentRoomId"] === "string"
									? state["currentRoomId"]
									: "overworld-room",
							inventory: Array.isArray(state["inventory"])
								? state["inventory"].filter(
										(entry): entry is string => typeof entry === "string",
									)
								: [],
							lanternLit: state["lanternLit"] === true,
						});
					}),
				},
				{
					capture: debugSettingsState.snapshot.pipe(
						Effect.map((snapshot) => ({
							debugOverlayEnabled: snapshot.debugOverlayEnabled,
						})),
					),
					key: "debug-settings",
					restore: Effect.fn("StarterSaveParticipants.restoreDebugSettings")(
						function* (state: Readonly<Record<string, unknown>>) {
							yield* debugSettingsState.restore({
								debugOverlayEnabled: state["debugOverlayEnabled"] === true,
							});
						},
					),
				},
			] satisfies ReadonlyArray<SaveParticipant>;

			return StarterSaveParticipants.of({
				all: Effect.succeed(participants),
			});
		}),
	);
}
