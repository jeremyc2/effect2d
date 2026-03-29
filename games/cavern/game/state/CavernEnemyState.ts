import { Effect, Layer, Ref, ServiceMap } from "effect";
import type { CameraVector } from "../../../../src/graphics/Camera.ts";
import {
	type CavernRoomId,
	cavernStartingRoomId,
	getCavernRoom,
} from "../content/CavernWorld.ts";

export interface CavernEnemySnapshot {
	readonly id: string;
	readonly position: CameraVector;
	readonly velocity: CameraVector;
}

const makeRoomEnemySnapshots = (
	roomId: CavernRoomId,
): ReadonlyArray<CavernEnemySnapshot> =>
	getCavernRoom(roomId).enemies.map((enemy) => ({
		id: enemy.id,
		position: enemy.position,
		velocity: {
			x: 0,
			y: 0,
		},
	}));

const initialCavernEnemySnapshots =
	makeRoomEnemySnapshots(cavernStartingRoomId);

export class CavernEnemyState extends ServiceMap.Service<
	CavernEnemyState,
	{
		readonly enterRoom: (roomId: CavernRoomId) => Effect.Effect<void>;
		readonly reset: Effect.Effect<void>;
		readonly setEnemies: (
			enemies: ReadonlyArray<CavernEnemySnapshot>,
		) => Effect.Effect<void>;
		readonly snapshot: Effect.Effect<ReadonlyArray<CavernEnemySnapshot>>;
	}
>()("effect2d/games/cavern/game/state/CavernEnemyState") {
	static readonly layer = Layer.effect(
		CavernEnemyState,
		Effect.gen(function* () {
			const stateRef = yield* Ref.make(initialCavernEnemySnapshots);

			const enterRoom = Effect.fn("CavernEnemyState.enterRoom")(function* (
				roomId: CavernRoomId,
			) {
				yield* Ref.set(stateRef, makeRoomEnemySnapshots(roomId));
			});

			const setEnemies = Effect.fn("CavernEnemyState.setEnemies")(function* (
				enemies: ReadonlyArray<CavernEnemySnapshot>,
			) {
				yield* Ref.set(stateRef, enemies);
			});

			const reset = Ref.set(stateRef, initialCavernEnemySnapshots).pipe(
				Effect.withSpan("CavernEnemyState.reset"),
			);

			return CavernEnemyState.of({
				enterRoom,
				reset,
				setEnemies,
				snapshot: Ref.get(stateRef),
			});
		}),
	);
}
