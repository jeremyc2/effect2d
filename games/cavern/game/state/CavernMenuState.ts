import { Context, Effect, Layer, Ref } from "effect";

export interface CavernMenuSnapshot {
	readonly hoveredIndex: number | null;
	readonly selectedIndex: number;
	readonly soundOn: boolean;
}

const initialCavernMenuSnapshot: CavernMenuSnapshot = {
	hoveredIndex: null,
	selectedIndex: 0,
	soundOn: true,
};

export class CavernMenuState extends Context.Service<
	CavernMenuState,
	{
		readonly setHoveredIndex: (
			hoveredIndex: number | null,
		) => Effect.Effect<void>;
		readonly setSelectedIndex: (selectedIndex: number) => Effect.Effect<void>;
		readonly snapshot: Effect.Effect<CavernMenuSnapshot>;
		readonly toggleSound: Effect.Effect<void>;
	}
>()("effect2d/games/cavern/game/state/CavernMenuState") {
	static readonly layer = Layer.effect(
		CavernMenuState,
		Effect.gen(function* () {
			const stateRef = yield* Ref.make(initialCavernMenuSnapshot);

			const setHoveredIndex = Effect.fn("CavernMenuState.setHoveredIndex")(
				function* (hoveredIndex: number | null) {
					yield* Ref.update(stateRef, (state) => ({
						...state,
						hoveredIndex,
					}));
				},
			);

			const setSelectedIndex = Effect.fn("CavernMenuState.setSelectedIndex")(
				function* (selectedIndex: number) {
					yield* Ref.update(stateRef, (state) => ({
						...state,
						selectedIndex,
					}));
				},
			);

			const toggleSound = Ref.update(stateRef, (state) => ({
				...state,
				soundOn: !state.soundOn,
			}));

			return CavernMenuState.of({
				setHoveredIndex,
				setSelectedIndex,
				snapshot: Ref.get(stateRef),
				toggleSound,
			});
		}),
	);
}
