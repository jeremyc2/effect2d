import { Schema } from "effect";

/** Indicates that multiple save participants claimed the same persistence key. @public */
export class SaveParticipantKeyConflictError extends Schema.TaggedErrorClass<SaveParticipantKeyConflictError>()(
	"SaveParticipantKeyConflictError",
	{
		key: Schema.String,
	},
) {}

/** Indicates that the requested save slot does not exist in the document. @public */
export class SaveSlotNotFoundError extends Schema.TaggedErrorClass<SaveSlotNotFoundError>()(
	"SaveSlotNotFoundError",
	{
		slotId: Schema.String,
	},
) {}

/** Indicates that save data could not be decoded into the documented schema. @public */
export class SaveDocumentDecodeError extends Schema.TaggedErrorClass<SaveDocumentDecodeError>()(
	"SaveDocumentDecodeError",
	{
		details: Schema.String,
	},
) {}

/** Indicates that a migration threw or returned a failure while running. @public */
export class SaveMigrationExecutionError extends Schema.TaggedErrorClass<SaveMigrationExecutionError>()(
	"SaveMigrationExecutionError",
	{
		details: Schema.String,
	},
) {}

/** Indicates that no migration path exists between two save versions. @public */
export class SaveMigrationMissingError extends Schema.TaggedErrorClass<SaveMigrationMissingError>()(
	"SaveMigrationMissingError",
	{
		fromVersion: Schema.Number,
		targetVersion: Schema.Number,
	},
) {}

/** Indicates that a migration failed while moving a document between versions. @public */
export class SaveMigrationFailedError extends Schema.TaggedErrorClass<SaveMigrationFailedError>()(
	"SaveMigrationFailedError",
	{
		fromVersion: Schema.Number,
		toVersion: Schema.Number,
	},
) {}

/** Indicates that a migration produced a document version other than the expected target. @public */
export class SaveMigrationVersionMismatchError extends Schema.TaggedErrorClass<SaveMigrationVersionMismatchError>()(
	"SaveMigrationVersionMismatchError",
	{
		actualVersion: Schema.Number,
		expectedVersion: Schema.Number,
	},
) {}
