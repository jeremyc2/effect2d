import { Effect, Layer, Ref, ServiceMap } from "effect";

export interface DebugSettingsSnapshot {
	readonly debugOverlayEnabled: boolean;
}

const initialDebugSettingsSnapshot: DebugSettingsSnapshot = {
	debugOverlayEnabled: false,
};

export class DebugSettingsState extends ServiceMap.Service<
	DebugSettingsState,
	{
		readonly restore: (snapshot: DebugSettingsSnapshot) => Effect.Effect<void>;
		readonly snapshot: Effect.Effect<DebugSettingsSnapshot>;
		readonly toggleDebugOverlay: Effect.Effect<void>;
	}
>()("Effect2d/starter/game/state/DebugSettingsState") {
	static readonly layer = Layer.effect(
		DebugSettingsState,
		Effect.gen(function* () {
			const stateRef = yield* Ref.make(initialDebugSettingsSnapshot);

			return DebugSettingsState.of({
				restore: Effect.fn("DebugSettingsState.restore")(function* (
					snapshot: DebugSettingsSnapshot,
				) {
					yield* Ref.set(stateRef, snapshot);
				}),
				snapshot: Ref.get(stateRef),
				toggleDebugOverlay: Ref.update(stateRef, (state) => ({
					...state,
					debugOverlayEnabled: !state.debugOverlayEnabled,
				})),
			});
		}),
	);
}
