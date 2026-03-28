import { type Effect, Schema } from "effect";
import type { SaveMigrationExecutionError } from "./SaveError.ts";

/** A stable identifier for a saved slot such as `"autosave"` or `"slot-1"`. @public */
export type SaveSlotId = string;

/**
 * The persisted contents of a single save slot.
 *
 * @public
 *
 * `participantStates` is keyed by each registered {@link SaveParticipant}'s
 * `key`.
 */
export interface SaveSlotDocument {
	readonly participantStates: Readonly<
		Record<string, Readonly<Record<string, unknown>>>
	>;
	readonly savedAtMillis: number;
	readonly slotId: SaveSlotId;
}

/** The full persisted save document for a game. `version` is the migration target used by {@link SaveCoordinator}. @public */
export interface SaveDocument {
	readonly slots: Readonly<Record<SaveSlotId, SaveSlotDocument>>;
	readonly version: number;
}

/**
 * Participates in save capture and restore.
 *
 * @public
 *
 * Each game-owned state service that wants to be saved can expose one
 * `SaveParticipant`.
 *
 * ```ts
 * const playerSaveParticipant: SaveParticipant = {
 *   key: "player",
 *   capture: PlayerState.snapshot,
 *   restore: (state) => PlayerState.restore(state),
 * };
 * ```
 */
export interface SaveParticipant {
	readonly capture: Effect.Effect<Readonly<Record<string, unknown>>>;
	readonly key: string;
	readonly restore: (
		state: Readonly<Record<string, unknown>>,
	) => Effect.Effect<void>;
}

/** A typed migration between persisted save versions. Each migration should move the document from exactly one version to the next expected version. @public */
export interface SaveMigration {
	readonly fromVersion: number;
	readonly migrate: (
		document: SaveDocument,
	) => Effect.Effect<SaveDocument, SaveMigrationExecutionError>;
	readonly toVersion: number;
}

const SaveParticipantStateSchema = Schema.Record(Schema.String, Schema.Unknown);

/** Runtime schema for a single save slot document. Use this when you need Effect Schema decoding outside of {@link SaveCoordinator}. @public */
export const SaveSlotDocumentSchema = Schema.Struct({
	participantStates: Schema.Record(Schema.String, SaveParticipantStateSchema),
	savedAtMillis: Schema.Number,
	slotId: Schema.String,
});

/** Runtime schema for the top-level save document. @public */
export const SaveDocumentSchema = Schema.Struct({
	slots: Schema.Record(Schema.String, SaveSlotDocumentSchema),
	version: Schema.Number,
});
