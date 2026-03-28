import { Effect, Metric } from "effect";

const frameTimeHistogram = Metric.histogram("effect2d.frame_time_ms", {
	attributes: {
		unit: "ms",
	},
	boundaries: Metric.linearBoundaries({
		count: 75,
		start: 0,
		width: 4,
	}),
	description:
		"Rendered frame delta in milliseconds captured for engine gameplay telemetry.",
});

const roomTransitionCounter = Metric.counter("effect2d.room_transition_total", {
	attributes: {
		unit: "1",
	},
	description:
		"Total room transitions observed by the engine during a gameplay session.",
	incremental: true,
});

const saveWriteCounter = Metric.counter("effect2d.save_write_total", {
	attributes: {
		unit: "1",
	},
	description: "Total save-slot writes performed by the engine.",
	incremental: true,
});

const saveRestoreCounter = Metric.counter("effect2d.save_restore_total", {
	attributes: {
		unit: "1",
	},
	description: "Total save-slot restores performed by the engine.",
	incremental: true,
});

const activeSfxGauge = Metric.gauge("effect2d.active_sfx_count", {
	attributes: {
		unit: "1",
	},
	description: "Current number of active sound-effect playbacks.",
});

const collisionBodyGauge = Metric.gauge("effect2d.collision_body_count", {
	attributes: {
		unit: "1",
	},
	description: "Current number of collision bodies registered in the world.",
});

const inputEventCounter = Metric.counter("effect2d.input_event_total", {
	attributes: {
		unit: "1",
	},
	description:
		"Total native input events processed by the engine, grouped by type.",
	incremental: true,
});

export const gameplayMetricIds = new Set<string>([
	frameTimeHistogram.id,
	roomTransitionCounter.id,
	saveWriteCounter.id,
	saveRestoreCounter.id,
	activeSfxGauge.id,
	collisionBodyGauge.id,
	inputEventCounter.id,
]);

export const initializeGameplayMetrics = Effect.andThen(
	Metric.update(activeSfxGauge, 0),
	Metric.update(collisionBodyGauge, 0),
);

export function isGameplayMetricId(metricId: string): boolean {
	return gameplayMetricIds.has(metricId);
}

export const recordFrameTime = (durationMillis: number) =>
	Metric.update(frameTimeHistogram, Math.max(0, durationMillis));

export const recordRoomTransition = (options: {
	readonly fromRoomId: string;
	readonly toRoomId: string;
}) =>
	Metric.update(
		Metric.withAttributes(roomTransitionCounter, {
			from_room_id: options.fromRoomId,
			to_room_id: options.toRoomId,
		}),
		1,
	);

export const recordSaveWrite = (slotId: string) =>
	Metric.update(
		Metric.withAttributes(saveWriteCounter, {
			slot_id: slotId,
		}),
		1,
	);

export const recordSaveRestore = (slotId: string) =>
	Metric.update(
		Metric.withAttributes(saveRestoreCounter, {
			slot_id: slotId,
		}),
		1,
	);

export const setActiveSfxCount = (count: number) =>
	Metric.update(activeSfxGauge, Math.max(0, count));

export const setCollisionBodyCount = (count: number) =>
	Metric.update(collisionBodyGauge, Math.max(0, count));

export const recordInputEvent = (eventType: string) =>
	Metric.update(
		Metric.withAttributes(inputEventCounter, {
			event_type: eventType,
		}),
		1,
	);
