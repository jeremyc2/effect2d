import { Effect, Layer, Ref, Schema, type Scope, ServiceMap } from "effect";
import type { ResourceDiagnostic } from "./DebugOverlay.ts";

export type ResourceKind =
	| "animation"
	| "audio"
	| "font"
	| "image"
	| "map"
	| "scene"
	| "script"
	| "texture";

export type ResourceState = ResourceDiagnostic["state"];

export interface ResourceRecord extends ResourceDiagnostic {
	readonly details: string | null;
}

interface ResourceTrackerState {
	readonly records: ReadonlyMap<string, ResourceRecord>;
}

const initialResourceTrackerState: ResourceTrackerState = {
	records: new Map<string, ResourceRecord>(),
};

export class InvalidResourceRecordError extends Schema.TaggedErrorClass<InvalidResourceRecordError>()(
	"InvalidResourceRecordError",
	{
		id: Schema.String,
		reason: Schema.String,
	},
) {}

export class UnknownTrackedResourceError extends Schema.TaggedErrorClass<UnknownTrackedResourceError>()(
	"UnknownTrackedResourceError",
	{
		id: Schema.String,
	},
) {}

export class ResourceTracker extends ServiceMap.Service<
	ResourceTracker,
	{
		readonly fault: (
			id: string,
			details?: string,
		) => Effect.Effect<void, UnknownTrackedResourceError>;
		readonly records: Effect.Effect<ReadonlyArray<ResourceRecord>>;
		readonly register: (
			id: string,
			kind: ResourceKind,
			details?: string,
		) => Effect.Effect<void, InvalidResourceRecordError>;
		readonly registerScoped: (
			id: string,
			kind: ResourceKind,
			details?: string,
		) => Effect.Effect<void, InvalidResourceRecordError, Scope.Scope>;
		readonly release: (
			id: string,
		) => Effect.Effect<void, UnknownTrackedResourceError>;
		readonly setLoaded: (
			id: string,
			details?: string,
		) => Effect.Effect<void, UnknownTrackedResourceError>;
	}
>()("effect2d/debug/ResourceTracker") {
	static readonly layer = Layer.effect(
		ResourceTracker,
		Effect.gen(function* () {
			const stateRef = yield* Ref.make(initialResourceTrackerState);

			const updateRecord = Effect.fn("ResourceTracker.updateRecord")(function* (
				id: string,
				state: ResourceState,
				details?: string,
			) {
				const currentState = yield* Ref.get(stateRef);
				const existing = currentState.records.get(id);
				if (existing === undefined) {
					return yield* new UnknownTrackedResourceError({ id });
				}

				yield* Ref.update(stateRef, (current) => ({
					records: new Map(current.records).set(id, {
						...existing,
						details: details ?? existing.details,
						state,
					}),
				}));
			});

			const register = Effect.fn("ResourceTracker.register")(function* (
				id: string,
				kind: ResourceKind,
				details?: string,
			) {
				if (id.length === 0) {
					return yield* new InvalidResourceRecordError({
						id,
						reason: "Tracked resources must declare a non-empty id.",
					});
				}

				yield* Ref.update(stateRef, (state) => ({
					records: new Map(state.records).set(id, {
						details: details ?? null,
						id,
						kind,
						state: "pending",
					}),
				}));
			});

			const registerScoped = Effect.fn("ResourceTracker.registerScoped")(
				function* (id: string, kind: ResourceKind, details?: string) {
					yield* register(id, kind, details);
					yield* Effect.addFinalizer(() =>
						updateRecord(id, "released").pipe(
							Effect.catchTag("UnknownTrackedResourceError", () => Effect.void),
						),
					);
				},
			);

			return ResourceTracker.of({
				fault: (id, details) => updateRecord(id, "faulted", details),
				records: Ref.get(stateRef).pipe(
					Effect.map((state) => Array.from(state.records.values())),
				),
				register,
				registerScoped,
				release: (id) => updateRecord(id, "released"),
				setLoaded: (id, details) => updateRecord(id, "loaded", details),
			});
		}),
	);
}
