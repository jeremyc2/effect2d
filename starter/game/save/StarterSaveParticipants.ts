import { Effect, Layer, ServiceMap } from "effect";
import type { SaveParticipant } from "../../../src/save/SaveDocument.ts";
import { DebugSettingsState } from "../state/DebugSettingsState.ts";
import { DialogueState } from "../state/DialogueState.ts";
import { GameplayState } from "../state/GameplayState.ts";
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
			const dialogueState = yield* DialogueState;
			const gameplayState = yield* GameplayState;
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
					capture: gameplayState.snapshot.pipe(
						Effect.map((snapshot) => ({
							enemyDefeated: snapshot.enemyDefeated,
							enemyPositionX: snapshot.enemyPosition.x,
							enemyPositionY: snapshot.enemyPosition.y,
							introSequencePlayed: snapshot.introSequencePlayed,
							lanternPickupCollected: snapshot.lanternPickupCollected,
						})),
					),
					key: "gameplay",
					restore: Effect.fn("StarterSaveParticipants.restoreGameplay")(
						function* (state: Readonly<Record<string, unknown>>) {
							yield* gameplayState.restore({
								enemyDefeated: state["enemyDefeated"] === true,
								enemyPosition: {
									x:
										typeof state["enemyPositionX"] === "number"
											? state["enemyPositionX"]
											: 72,
									y:
										typeof state["enemyPositionY"] === "number"
											? state["enemyPositionY"]
											: 32,
								},
								introSequencePlayed: state["introSequencePlayed"] === true,
								lanternPickupCollected:
									state["lanternPickupCollected"] === true,
							});
						},
					),
				},
				{
					capture: dialogueState.snapshot.pipe(
						Effect.map((snapshot) => ({
							currentPageIndex: snapshot.currentPageIndex,
							dialogueId: snapshot.dialogueId,
							pages: snapshot.pages.map((page) => ({
								hasNextPage: page.hasNextPage,
								layout: {
									fontId: page.layout.fontId,
									height: page.layout.height,
									lineHeight: page.layout.lineHeight,
									lines: page.layout.lines.map((line) => ({
										text: line.text,
										width: line.width,
									})),
									width: page.layout.width,
								},
								pageCount: page.pageCount,
								pageIndex: page.pageIndex,
							})),
						})),
					),
					key: "dialogue",
					restore: Effect.fn("StarterSaveParticipants.restoreDialogue")(
						function* (state: Readonly<Record<string, unknown>>) {
							const rawPages = state["pages"];
							const pages = Array.isArray(rawPages)
								? rawPages.flatMap((page) => {
										if (
											typeof page !== "object" ||
											page === null ||
											typeof page["hasNextPage"] !== "boolean" ||
											typeof page["pageCount"] !== "number" ||
											typeof page["pageIndex"] !== "number"
										) {
											return [];
										}

										const rawLayout = page["layout"];
										if (
											typeof rawLayout !== "object" ||
											rawLayout === null ||
											typeof rawLayout["fontId"] !== "string" ||
											typeof rawLayout["height"] !== "number" ||
											typeof rawLayout["lineHeight"] !== "number" ||
											typeof rawLayout["width"] !== "number" ||
											!Array.isArray(rawLayout["lines"])
										) {
											return [];
										}

										const lines = rawLayout["lines"].flatMap((line) => {
											if (
												typeof line !== "object" ||
												line === null ||
												typeof line["text"] !== "string" ||
												typeof line["width"] !== "number"
											) {
												return [];
											}

											return [
												{
													text: line["text"],
													width: line["width"],
												},
											];
										});

										return [
											{
												hasNextPage: page["hasNextPage"],
												layout: {
													fontId: rawLayout["fontId"],
													height: rawLayout["height"],
													lineHeight: rawLayout["lineHeight"],
													lines,
													width: rawLayout["width"],
												},
												pageCount: page["pageCount"],
												pageIndex: page["pageIndex"],
											},
										];
									})
								: [];
							const dialogueId =
								typeof state["dialogueId"] === "string"
									? state["dialogueId"]
									: null;
							const currentPageIndex =
								typeof state["currentPageIndex"] === "number"
									? state["currentPageIndex"]
									: 0;
							const restoredPage = pages[currentPageIndex] ?? pages[0];
							const activeDialogue =
								dialogueId === null || restoredPage === undefined
									? null
									: {
											dialogueId,
											page: restoredPage,
											pageCount: pages.length,
										};

							yield* dialogueState.restore({
								activeDialogue,
								currentPageIndex,
								dialogueId,
								pages,
							});
						},
					),
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
