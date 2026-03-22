import { type Effect, Schema } from "effect";
import type { SaveMigrationExecutionError } from "./SaveError.ts";

export type SaveSlotId = string;

export interface SaveSlotDocument {
	readonly participantStates: Readonly<
		Record<string, Readonly<Record<string, unknown>>>
	>;
	readonly savedAtMillis: number;
	readonly slotId: SaveSlotId;
}

export interface SaveDocument {
	readonly slots: Readonly<Record<SaveSlotId, SaveSlotDocument>>;
	readonly version: number;
}

export interface SaveParticipant {
	readonly capture: Effect.Effect<Readonly<Record<string, unknown>>>;
	readonly key: string;
	readonly restore: (
		state: Readonly<Record<string, unknown>>,
	) => Effect.Effect<void>;
}

export interface SaveMigration {
	readonly fromVersion: number;
	readonly migrate: (
		document: SaveDocument,
	) => Effect.Effect<SaveDocument, SaveMigrationExecutionError>;
	readonly toVersion: number;
}

const SaveParticipantStateSchema = Schema.Record(Schema.String, Schema.Unknown);

export const SaveSlotDocumentSchema = Schema.Struct({
	participantStates: Schema.Record(Schema.String, SaveParticipantStateSchema),
	savedAtMillis: Schema.Number,
	slotId: Schema.String,
});

export const SaveDocumentSchema = Schema.Struct({
	slots: Schema.Record(Schema.String, SaveSlotDocumentSchema),
	version: Schema.Number,
});
