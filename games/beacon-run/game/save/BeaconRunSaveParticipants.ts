import { Effect, Layer, ServiceMap } from "effect";
import type { SaveParticipant } from "../../../../src/save/SaveDocument.ts";
import { ExpeditionState } from "../state/ExpeditionState.ts";
import { ScoutState } from "../state/ScoutState.ts";

export class BeaconRunSaveParticipants extends ServiceMap.Service<
	BeaconRunSaveParticipants,
	{
		readonly all: Effect.Effect<ReadonlyArray<SaveParticipant>>;
	}
>()("effect2d/games/beacon-run/game/save/BeaconRunSaveParticipants") {
	static readonly layer = Layer.effect(
		BeaconRunSaveParticipants,
		Effect.gen(function* () {
			const expeditionState = yield* ExpeditionState;
			const scoutState = yield* ScoutState;

			const participants = [
				{
					capture: scoutState.snapshot.pipe(
						Effect.map((snapshot) => ({
							facing: snapshot.facing,
							positionX: snapshot.position.x,
							positionY: snapshot.position.y,
						})),
					),
					key: "scout",
					restore: Effect.fn("BeaconRunSaveParticipants.restoreScout")(
						function* (state: Readonly<Record<string, unknown>>) {
							yield* scoutState.restore({
								facing:
									state["facing"] === "left" ||
									state["facing"] === "right" ||
									state["facing"] === "up"
										? state["facing"]
										: "down",
								position: {
									x:
										typeof state["positionX"] === "number"
											? state["positionX"]
											: 24,
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
					capture: expeditionState.snapshot.pipe(
						Effect.map((snapshot) => ({
							currentRoomId: snapshot.currentRoomId,
							litBeaconIds: [...snapshot.litBeaconIds],
							missionComplete: snapshot.missionComplete,
						})),
					),
					key: "expedition",
					restore: Effect.fn("BeaconRunSaveParticipants.restoreExpedition")(
						function* (state: Readonly<Record<string, unknown>>) {
							yield* expeditionState.restore({
								currentRoomId:
									typeof state["currentRoomId"] === "string"
										? state["currentRoomId"]
										: "field-room",
								litBeaconIds: Array.isArray(state["litBeaconIds"])
									? state["litBeaconIds"].filter(
											(entry): entry is string => typeof entry === "string",
										)
									: [],
								missionComplete: state["missionComplete"] === true,
							});
						},
					),
				},
			] satisfies ReadonlyArray<SaveParticipant>;

			return BeaconRunSaveParticipants.of({
				all: Effect.succeed(participants),
			});
		}),
	);
}
