import { Effect, Layer, Ref, Schema, ServiceMap } from "effect";
import { setActiveSfxCount } from "../debug/GameplayMetrics.ts";

/** Logical buses supported by the mixer. @public */
export type AudioBus = "master" | "music" | "sfx";

/** The cue categories understood by the engine.
 * @public
 *
 * The engine understands two cue kinds: "music" and "sfx".
 * - "music" cues are intended to play continuously and loop until stopped.
 * - "sfx" cues are intended to play once and then stop.
 */
export type AudioCueKind = "music" | "sfx";

/** Declares a reusable authored audio cue. @public */
export interface AudioCueDefinition {
	readonly cueId: string;
	readonly defaultLoop: boolean;
	readonly defaultPitch: number;
	readonly defaultVolume: number;
	readonly sourcePath: string;
}

/** A loaded cue paired with its resolved kind. @public */
export interface LoadedAudioCue extends AudioCueDefinition {
	readonly kind: AudioCueKind;
}

/** Optional playback overrides for an individual cue trigger. @public */
export interface AudioPlaybackOptions {
	readonly loop?: boolean;
	readonly pitch?: number;
	readonly volume?: number;
}

/** The current music channel state. @public */
export interface MusicPlayback {
	readonly cueId: string;
	readonly loop: boolean;
	readonly paused: boolean;
	readonly pitch: number;
	readonly volume: number;
}

/** A single overlapping sound-effect playback instance. @public */
export interface SoundPlayback extends MusicPlayback {
	readonly playbackId: string;
}

/** A complete snapshot of authored mixer state. @public */
export interface AudioSnapshot {
	readonly busVolumes: Readonly<Record<AudioBus, number>>;
	readonly loadedCues: ReadonlyMap<string, LoadedAudioCue>;
	readonly music: MusicPlayback | null;
	readonly sounds: ReadonlyArray<SoundPlayback>;
}

interface AudioState {
	readonly busVolumes: Record<AudioBus, number>;
	readonly loadedCues: ReadonlyMap<string, LoadedAudioCue>;
	readonly music: MusicPlayback | null;
	readonly nextPlaybackId: number;
	readonly sounds: ReadonlyArray<SoundPlayback>;
}

const AudioBusSchema = Schema.Union([
	Schema.Literal("master"),
	Schema.Literal("music"),
	Schema.Literal("sfx"),
]);

const AudioCueKindSchema = Schema.Union([
	Schema.Literal("music"),
	Schema.Literal("sfx"),
]);

const initialAudioState: AudioState = {
	busVolumes: {
		master: 1,
		music: 1,
		sfx: 1,
	},
	loadedCues: new Map<string, LoadedAudioCue>(),
	music: null,
	nextPlaybackId: 0,
	sounds: [],
};

const resolveVolume = (
	options: AudioPlaybackOptions | undefined,
	cue: LoadedAudioCue,
) => options?.volume ?? cue.defaultVolume;

const resolvePitch = (
	options: AudioPlaybackOptions | undefined,
	cue: LoadedAudioCue,
) => options?.pitch ?? cue.defaultPitch;

const resolveLoop = (
	options: AudioPlaybackOptions | undefined,
	cue: LoadedAudioCue,
) => options?.loop ?? cue.defaultLoop;

/** Indicates that a cue id was registered more than once. @public */
export class DuplicateAudioCueError extends Schema.TaggedErrorClass<DuplicateAudioCueError>()(
	"DuplicateAudioCueError",
	{
		cueId: Schema.String,
	},
) {}

/** Indicates that an authored cue definition failed validation. @public */
export class InvalidAudioCueError extends Schema.TaggedErrorClass<InvalidAudioCueError>()(
	"InvalidAudioCueError",
	{
		cueId: Schema.String,
		reason: Schema.String,
	},
) {}

/** Indicates that a bus volume fell outside the inclusive 0..1 range. @public */
export class InvalidAudioBusVolumeError extends Schema.TaggedErrorClass<InvalidAudioBusVolumeError>()(
	"InvalidAudioBusVolumeError",
	{
		bus: AudioBusSchema,
		volume: Schema.Number,
	},
) {}

/** Indicates that playback referenced a cue id that has not been loaded. @public */
export class UnknownAudioCueError extends Schema.TaggedErrorClass<UnknownAudioCueError>()(
	"UnknownAudioCueError",
	{
		cueId: Schema.String,
	},
) {}

/** Indicates that code referenced a sound playback handle that no longer exists. @public */
export class UnknownSoundPlaybackError extends Schema.TaggedErrorClass<UnknownSoundPlaybackError>()(
	"UnknownSoundPlaybackError",
	{
		playbackId: Schema.String,
	},
) {}

/** Indicates that a cue was used as music vs sfx in the wrong context. @public */
export class WrongAudioCueKindError extends Schema.TaggedErrorClass<WrongAudioCueKindError>()(
	"WrongAudioCueKindError",
	{
		actualKind: AudioCueKindSchema,
		cueId: Schema.String,
		expectedKind: AudioCueKindSchema,
	},
) {}

const validateCueDefinition = Effect.fn("Audio.validateCueDefinition")(
	function* (definition: AudioCueDefinition) {
		if (definition.cueId.length === 0) {
			return yield* new InvalidAudioCueError({
				cueId: definition.cueId,
				reason: "Audio cues must declare a non-empty cue id.",
			});
		}

		if (definition.sourcePath.length === 0) {
			return yield* new InvalidAudioCueError({
				cueId: definition.cueId,
				reason: "Audio cues must declare a non-empty source path.",
			});
		}

		if (definition.defaultVolume < 0 || definition.defaultVolume > 1) {
			return yield* new InvalidAudioCueError({
				cueId: definition.cueId,
				reason: "Audio cue volume must be within the inclusive range 0 to 1.",
			});
		}

		if (definition.defaultPitch <= 0) {
			return yield* new InvalidAudioCueError({
				cueId: definition.cueId,
				reason: "Audio cue pitch must be greater than zero.",
			});
		}

		return definition;
	},
);

const validateBusVolume = Effect.fn("Audio.validateBusVolume")(function* (
	bus: AudioBus,
	volume: number,
) {
	if (volume < 0 || volume > 1) {
		return yield* new InvalidAudioBusVolumeError({
			bus,
			volume,
		});
	}
});

/**
 * The engine's cue-driven audio service.
 *
 * @public
 *
 * Game code usually loads stable cue ids during startup and refers to those ids
 * during play, instead of scattering file paths throughout gameplay logic. This
 * keeps audio orchestration testable, deterministic, and portable across native
 * backends.
 */
export class Audio extends ServiceMap.Service<
	Audio,
	{
		readonly completeSound: (playbackId: string) => Effect.Effect<void>;
		readonly loadMusic: (
			definition: AudioCueDefinition,
		) => Effect.Effect<void, DuplicateAudioCueError | InvalidAudioCueError>;
		readonly loadSound: (
			definition: AudioCueDefinition,
		) => Effect.Effect<void, DuplicateAudioCueError | InvalidAudioCueError>;
		readonly loadedCues: Effect.Effect<ReadonlyArray<LoadedAudioCue>>;
		readonly music: Effect.Effect<MusicPlayback | null>;
		readonly pauseMusic: Effect.Effect<void>;
		readonly playMusic: (
			cueId: string,
			options?: AudioPlaybackOptions,
		) => Effect.Effect<void, UnknownAudioCueError | WrongAudioCueKindError>;
		readonly playSfx: (
			cueId: string,
			options?: AudioPlaybackOptions,
		) => Effect.Effect<string, UnknownAudioCueError | WrongAudioCueKindError>;
		readonly resumeMusic: Effect.Effect<void>;
		readonly setBusVolume: (
			bus: AudioBus,
			volume: number,
		) => Effect.Effect<void, InvalidAudioBusVolumeError>;
		readonly snapshot: Effect.Effect<AudioSnapshot>;
		readonly sounds: Effect.Effect<ReadonlyArray<SoundPlayback>>;
		readonly stopAll: Effect.Effect<void>;
		readonly stopMusic: Effect.Effect<void>;
		readonly stopSound: (
			playbackId: string,
		) => Effect.Effect<void, UnknownSoundPlaybackError>;
	}
>()("effect2d/audio/Audio") {
	static readonly layer = Layer.effect(Audio)(
		Effect.gen(function* () {
			const stateRef = yield* Ref.make(initialAudioState);

			yield* Effect.addFinalizer(() =>
				Ref.set(stateRef, {
					...initialAudioState,
					loadedCues: new Map<string, LoadedAudioCue>(),
				}),
			);

			const registerCue = Effect.fn("Audio.registerCue")(function* (
				kind: AudioCueKind,
				definition: AudioCueDefinition,
			) {
				yield* Effect.annotateCurrentSpan({
					"effect2d.audio.cue_id": definition.cueId,
					"effect2d.audio.kind": kind,
					"effect2d.audio.source_path": definition.sourcePath,
				});
				const validated = yield* validateCueDefinition(definition);
				const state = yield* Ref.get(stateRef);

				if (state.loadedCues.has(validated.cueId)) {
					return yield* new DuplicateAudioCueError({
						cueId: validated.cueId,
					});
				}

				yield* Ref.update(stateRef, (current) => ({
					...current,
					loadedCues: new Map(current.loadedCues).set(validated.cueId, {
						...validated,
						kind,
					}),
				}));
				yield* Effect.logDebug("Registered audio cue.").pipe(
					Effect.annotateLogs({
						"effect2d.audio.cue_id": validated.cueId,
						"effect2d.audio.kind": kind,
					}),
				);
			});

			const loadMusic = Effect.fn("Audio.loadMusic")(function* (
				definition: AudioCueDefinition,
			) {
				yield* registerCue("music", definition);
			});

			const loadSound = Effect.fn("Audio.loadSound")(function* (
				definition: AudioCueDefinition,
			) {
				yield* registerCue("sfx", definition);
			});

			const resolveCue = Effect.fn("Audio.resolveCue")(function* (
				cueId: string,
				expectedKind: AudioCueKind,
			) {
				const state = yield* Ref.get(stateRef);
				const cue = state.loadedCues.get(cueId);

				if (cue === undefined) {
					return yield* new UnknownAudioCueError({ cueId });
				}

				if (cue.kind !== expectedKind) {
					return yield* new WrongAudioCueKindError({
						actualKind: cue.kind,
						cueId,
						expectedKind,
					});
				}

				return cue;
			});

			const playMusic = Effect.fn("Audio.playMusic")(function* (
				cueId: string,
				options?: AudioPlaybackOptions,
			) {
				const cue = yield* resolveCue(cueId, "music");
				yield* Effect.annotateCurrentSpan({
					"effect2d.audio.cue_id": cueId,
					"effect2d.audio.kind": "music",
					"effect2d.audio.loop": resolveLoop(options, cue),
					"effect2d.audio.pitch": resolvePitch(options, cue),
					"effect2d.audio.volume": resolveVolume(options, cue),
				});
				yield* Ref.update(stateRef, (state) => ({
					...state,
					music: {
						cueId,
						loop: resolveLoop(options, cue),
						paused: false,
						pitch: resolvePitch(options, cue),
						volume: resolveVolume(options, cue),
					},
				}));
			});

			const pauseMusic = Ref.update(stateRef, (state) => ({
				...state,
				music:
					state.music === null
						? null
						: {
								...state.music,
								paused: true,
							},
			}));

			const resumeMusic = Ref.update(stateRef, (state) => ({
				...state,
				music:
					state.music === null
						? null
						: {
								...state.music,
								paused: false,
							},
			}));

			const stopMusic = Ref.update(stateRef, (state) => ({
				...state,
				music: null,
			}));

			const playSfx = Effect.fn("Audio.playSfx")(function* (
				cueId: string,
				options?: AudioPlaybackOptions,
			) {
				const cue = yield* resolveCue(cueId, "sfx");
				const state = yield* Ref.get(stateRef);
				const playbackId = `${cueId}#${state.nextPlaybackId}`;
				yield* Effect.annotateCurrentSpan({
					"effect2d.audio.cue_id": cueId,
					"effect2d.audio.kind": "sfx",
					"effect2d.audio.loop": resolveLoop(options, cue),
					"effect2d.audio.pitch": resolvePitch(options, cue),
					"effect2d.audio.playback_id": playbackId,
					"effect2d.audio.volume": resolveVolume(options, cue),
				});

				const activeSfxCount = yield* Ref.modify(stateRef, (current) => {
					const sounds = [
						...current.sounds,
						{
							cueId,
							loop: resolveLoop(options, cue),
							paused: false,
							pitch: resolvePitch(options, cue),
							playbackId,
							volume: resolveVolume(options, cue),
						},
					];

					return [
						sounds.length,
						{
							...current,
							nextPlaybackId: current.nextPlaybackId + 1,
							sounds,
						},
					] as const;
				});
				yield* setActiveSfxCount(activeSfxCount);

				return playbackId;
			});

			const stopSound = Effect.fn("Audio.stopSound")(function* (
				playbackId: string,
			) {
				yield* Effect.annotateCurrentSpan({
					"effect2d.audio.playback_id": playbackId,
				});
				const state = yield* Ref.get(stateRef);

				if (
					!state.sounds.some((playback) => playback.playbackId === playbackId)
				) {
					return yield* new UnknownSoundPlaybackError({
						playbackId,
					});
				}

				const activeSfxCount = yield* Ref.modify(stateRef, (current) => {
					const sounds = current.sounds.filter(
						(playback) => playback.playbackId !== playbackId,
					);
					return [
						sounds.length,
						{
							...current,
							sounds,
						},
					] as const;
				});
				yield* setActiveSfxCount(activeSfxCount);
			});

			const completeSound = Effect.fn("Audio.completeSound")(function* (
				playbackId: string,
			) {
				yield* Effect.annotateCurrentSpan({
					"effect2d.audio.playback_id": playbackId,
				});
				const activeSfxCount = yield* Ref.modify(stateRef, (current) => {
					const sounds = current.sounds.filter(
						(playback) => playback.playbackId !== playbackId,
					);
					return [
						sounds.length,
						{
							...current,
							sounds,
						},
					] as const;
				});
				yield* setActiveSfxCount(activeSfxCount);
			});

			const setBusVolume = Effect.fn("Audio.setBusVolume")(function* (
				bus: AudioBus,
				volume: number,
			) {
				yield* validateBusVolume(bus, volume);
				yield* Effect.annotateCurrentSpan({
					"effect2d.audio.bus": bus,
					"effect2d.audio.volume": volume,
				});
				yield* Effect.logDebug("Adjusted audio bus volume.").pipe(
					Effect.annotateLogs({
						"effect2d.audio.bus": bus,
						"effect2d.audio.volume": volume,
					}),
				);
				yield* Ref.update(stateRef, (state) => ({
					...state,
					busVolumes: {
						...state.busVolumes,
						[bus]: volume,
					},
				}));
			});

			const stopAll = Ref.update(stateRef, (state) => ({
				...state,
				music: null,
				sounds: [],
			})).pipe(Effect.tap(() => setActiveSfxCount(0)));

			const snapshot = Ref.get(stateRef).pipe(
				Effect.map(
					(state) =>
						({
							busVolumes: state.busVolumes,
							loadedCues: state.loadedCues,
							music: state.music,
							sounds: state.sounds,
						}) satisfies AudioSnapshot,
				),
			);

			return Audio.of({
				completeSound,
				loadMusic,
				loadSound,
				loadedCues: Ref.get(stateRef).pipe(
					Effect.map((state) => Array.from(state.loadedCues.values())),
				),
				music: snapshot.pipe(Effect.map((current) => current.music)),
				pauseMusic,
				playMusic,
				playSfx,
				resumeMusic,
				setBusVolume,
				snapshot,
				sounds: snapshot.pipe(Effect.map((current) => current.sounds)),
				stopAll,
				stopMusic,
				stopSound,
			});
		}),
	);
}
