import type { CavernEnemySnapshot } from "../state/CavernEnemyState.ts";
import type { CavernPlayerSnapshot } from "../state/CavernPlayerState.ts";
import type { CavernWorldSnapshot } from "../state/CavernWorldState.ts";

function isCavernRoomId(
	value: unknown,
): value is CavernWorldSnapshot["currentRoomId"] {
	return value === "rm1" || value === "rm2" || value === "rm3";
}

function isCameraVector(
	value: unknown,
): value is CavernPlayerSnapshot["position"] {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	const x = Reflect.get(value, "x");
	const y = Reflect.get(value, "y");
	return typeof x === "number" && typeof y === "number";
}

export function cavernWorldToSaveRecord(
	snapshot: CavernWorldSnapshot,
): Readonly<Record<string, unknown>> {
	return {
		currentRoomId: snapshot.currentRoomId,
		roomInstructionsFadeStartedAtMillis:
			snapshot.roomInstructionsFadeStartedAtMillis,
	};
}

export function parseCavernWorldSaveRecord(
	state: Readonly<Record<string, unknown>>,
): CavernWorldSnapshot | null {
	if (Object.keys(state).length === 0) {
		return null;
	}
	const roomId = state["currentRoomId"];
	if (!isCavernRoomId(roomId)) {
		return null;
	}
	const fade = state["roomInstructionsFadeStartedAtMillis"];
	if (fade !== null && fade !== undefined && typeof fade !== "number") {
		return null;
	}
	return {
		currentRoomId: roomId,
		roomInstructionsFadeStartedAtMillis:
			fade === undefined || fade === null ? null : fade,
	};
}

export function cavernPlayerToSaveRecord(
	snapshot: CavernPlayerSnapshot,
): Readonly<Record<string, unknown>> {
	return {
		position: {
			x: snapshot.position.x,
			y: snapshot.position.y,
		},
		velocity: {
			x: snapshot.velocity.x,
			y: snapshot.velocity.y,
		},
	};
}

export function parseCavernPlayerSaveRecord(
	state: Readonly<Record<string, unknown>>,
): CavernPlayerSnapshot | null {
	if (Object.keys(state).length === 0) {
		return null;
	}
	const position = state["position"];
	const velocity = state["velocity"];
	if (!isCameraVector(position) || !isCameraVector(velocity)) {
		return null;
	}
	return {
		position,
		velocity,
	};
}

export function cavernEnemiesToSaveRecord(
	enemies: ReadonlyArray<CavernEnemySnapshot>,
): Readonly<Record<string, unknown>> {
	return {
		enemies: enemies.map((enemy) => ({
			id: enemy.id,
			position: { x: enemy.position.x, y: enemy.position.y },
			velocity: { x: enemy.velocity.x, y: enemy.velocity.y },
		})),
	};
}

function parseEnemyEntry(value: unknown): CavernEnemySnapshot | null {
	if (typeof value !== "object" || value === null) {
		return null;
	}
	const id = Reflect.get(value, "id");
	const position = Reflect.get(value, "position");
	const velocity = Reflect.get(value, "velocity");
	if (typeof id !== "string") {
		return null;
	}
	if (!isCameraVector(position) || !isCameraVector(velocity)) {
		return null;
	}
	return {
		id,
		position,
		velocity,
	};
}

export function parseCavernEnemiesSaveRecord(
	state: Readonly<Record<string, unknown>>,
): ReadonlyArray<CavernEnemySnapshot> | null {
	if (Object.keys(state).length === 0) {
		return null;
	}
	const raw = state["enemies"];
	if (!Array.isArray(raw)) {
		return null;
	}
	const next: CavernEnemySnapshot[] = [];
	for (const entry of raw) {
		const parsed = parseEnemyEntry(entry);
		if (parsed === null) {
			return null;
		}
		next.push(parsed);
	}
	return next;
}
