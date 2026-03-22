import { describe, expect, test } from "bun:test";
import { Effect, Exit, Ref } from "effect";
import { runLayerEffect } from "../testing/runEffectTest.ts";
import { SaveCoordinator } from "./SaveCoordinator.ts";
import type { SaveDocument } from "./SaveDocument.ts";
import {
	SaveMigrationExecutionError,
	SaveMigrationFailedError,
	SaveMigrationMissingError,
} from "./SaveError.ts";

const makeParticipant = Effect.fn("SaveCoordinator.makeParticipant")(function* (
	key: string,
	initialState: Readonly<Record<string, unknown>>,
) {
	const stateRef = yield* Ref.make(initialState);

	return {
		participant: {
			capture: Ref.get(stateRef),
			key,
			restore: (state: Readonly<Record<string, unknown>>) =>
				Ref.set(stateRef, state),
		},
		stateRef,
	};
});

describe("SaveCoordinator", () => {
	test("snapshots and restores multiple save participants through slots", async () => {
		const player = await Effect.runPromise(
			makeParticipant("player", { health: 3, roomId: "start" }),
		);
		const inventory = await Effect.runPromise(
			makeParticipant("inventory", { lantern: true }),
		);
		const layer = SaveCoordinator.layer({
			nowMillis: () => 123,
			participants: [player.participant, inventory.participant],
			version: 2,
		});

		await runLayerEffect(
			layer,
			Effect.gen(function* () {
				const saveCoordinator = yield* SaveCoordinator;

				yield* saveCoordinator.writeSlot("slot-a");
				yield* Ref.set(player.stateRef, { health: 1, roomId: "boss" });
				yield* Ref.set(inventory.stateRef, { lantern: false });
				yield* saveCoordinator.restoreSlot("slot-a");

				expect(yield* Ref.get(player.stateRef)).toEqual({
					health: 3,
					roomId: "start",
				});
				expect(yield* Ref.get(inventory.stateRef)).toEqual({
					lantern: true,
				});

				const exportedDocument = yield* saveCoordinator.exportDocument;
				expect(exportedDocument).toEqual({
					slots: {
						"slot-a": {
							participantStates: {
								inventory: {
									lantern: true,
								},
								player: {
									health: 3,
									roomId: "start",
								},
							},
							savedAtMillis: 123,
							slotId: "slot-a",
						},
					},
					version: 2,
				});
			}),
		);
	});

	test("imports an older document through migrations before restoring a slot", async () => {
		const player = await Effect.runPromise(
			makeParticipant("player", { health: 0, roomId: "void" }),
		);
		const oldDocument: SaveDocument = {
			slots: {
				"slot-a": {
					participantStates: {
						player: {
							health: 2,
						},
					},
					savedAtMillis: 50,
					slotId: "slot-a",
				},
			},
			version: 1,
		};
		const layer = SaveCoordinator.layer({
			migrations: [
				{
					fromVersion: 1,
					migrate: (document) =>
						Effect.sync(() => {
							const slot = document.slots["slot-a"];
							if (slot === undefined) {
								return document;
							}

							return {
								...document,
								slots: {
									"slot-a": {
										...slot,
										participantStates: {
											player: {
												...slot.participantStates["player"],
												roomId: "migrated-room",
											},
										},
									},
								},
								version: 2,
							};
						}),
					toVersion: 2,
				},
			],
			participants: [player.participant],
			version: 2,
		});

		await runLayerEffect(
			layer,
			Effect.gen(function* () {
				const saveCoordinator = yield* SaveCoordinator;
				yield* saveCoordinator.importDocument(oldDocument);
				yield* saveCoordinator.restoreSlot("slot-a");

				expect(yield* Ref.get(player.stateRef)).toEqual({
					health: 2,
					roomId: "migrated-room",
				});
			}),
		);
	});

	test("fails cleanly when a requested save slot is missing", async () => {
		const player = await Effect.runPromise(
			makeParticipant("player", { health: 3 }),
		);
		const layer = SaveCoordinator.layer({
			participants: [player.participant],
			version: 1,
		});

		const exit = await runLayerEffect(
			layer,
			Effect.gen(function* () {
				const saveCoordinator = yield* SaveCoordinator;
				return yield* Effect.exit(saveCoordinator.restoreSlot("missing-slot"));
			}),
		);

		expect(Exit.isFailure(exit)).toBe(true);
	});

	test("fails with a typed error when a required migration is missing", async () => {
		const player = await Effect.runPromise(
			makeParticipant("player", { health: 0, roomId: "void" }),
		);
		const oldDocument: SaveDocument = {
			slots: {
				"slot-a": {
					participantStates: {
						player: {
							health: 2,
						},
					},
					savedAtMillis: 50,
					slotId: "slot-a",
				},
			},
			version: 1,
		};
		const layer = SaveCoordinator.layer({
			participants: [player.participant],
			version: 2,
		});

		const exit = await runLayerEffect(
			layer,
			Effect.gen(function* () {
				const saveCoordinator = yield* SaveCoordinator;
				return yield* Effect.flip(saveCoordinator.importDocument(oldDocument));
			}),
		);

		expect(exit).toBeInstanceOf(SaveMigrationMissingError);
	});

	test("fails with a typed error when a migration implementation fails", async () => {
		const player = await Effect.runPromise(
			makeParticipant("player", { health: 0, roomId: "void" }),
		);
		const oldDocument: SaveDocument = {
			slots: {
				"slot-a": {
					participantStates: {
						player: {
							health: 2,
						},
					},
					savedAtMillis: 50,
					slotId: "slot-a",
				},
			},
			version: 1,
		};
		const layer = SaveCoordinator.layer({
			migrations: [
				{
					fromVersion: 1,
					migrate: () =>
						Effect.fail(
							new SaveMigrationExecutionError({
								details: "boom",
							}),
						),
					toVersion: 2,
				},
			],
			participants: [player.participant],
			version: 2,
		});

		const exit = await runLayerEffect(
			layer,
			Effect.gen(function* () {
				const saveCoordinator = yield* SaveCoordinator;
				return yield* Effect.flip(saveCoordinator.importDocument(oldDocument));
			}),
		);

		expect(exit).toBeInstanceOf(SaveMigrationFailedError);
	});
});
