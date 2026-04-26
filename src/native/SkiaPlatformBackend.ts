import { Effect, Layer, Option, Ref } from "effect";
import {
	type AudioBuffer,
	type AudioBufferSourceNode,
	AudioContext,
	GainNode,
} from "node-web-audio-api";
import {
	App,
	type Canvas,
	FontLibrary,
	type Image,
	loadImage,
	Window,
} from "skia-canvas";
import type { Audio, AudioSnapshot } from "../audio/Audio.ts";
import type {
	Color,
	DrawCommand,
	FrameSnapshot,
} from "../graphics/Graphics.ts";
import type { Input, InputEvent } from "../input/Input.ts";
import { EngineLaunchError } from "../runtime/EngineError.ts";
import type { FrameUpdater } from "./FrameUpdater.ts";
import { NativeBoundary } from "./NativeBoundary.ts";
import {
	type PlatformAudioOutputSnapshot,
	PlatformBackend,
	type PlatformBackendDiagnostics,
	type PlatformRendererSnapshot,
	type PlatformTimingSnapshot,
	type PlatformWindowSnapshot,
} from "./PlatformBackend.ts";

type SkiaContext2D = ReturnType<Canvas["getContext"]>;
type LoadedImage = Image;

/**
 * Configuration for the Skia platform backend.
 *
 * @public
 *
 * This is the main option bag used by {@link makeSkiaNativeBoundaryLayer}.
 * Typical games set window title and size, logical render size, and their
 * authored image and font asset paths here.
 */
export interface SkiaPlatformBackendOptions {
	readonly defaultFontFamily?: string;
	readonly defaultFontPath?: string;
	readonly defaultFontSizePx?: number;
	readonly fontAssetDefinitions?: Readonly<
		Record<
			string,
			{
				readonly family: string;
				readonly sizePx: number;
				readonly sourcePath: string;
			}
		>
	>;
	readonly frameDelayMillis?: number;
	readonly imageAssetPaths?: Readonly<Record<string, string>>;
	readonly logicalHeight?: number;
	readonly logicalWidth?: number;
	/**
	 * When upscaling the logical frame to fit the window, whether to snap the
	 * scale down to a whole number (1×, 2×, …) instead of using the continuous
	 * aspect-fit factor. Integer scales keep pixel-sized content crisp; fractional
	 * scales use more of the window but can soften artwork. Downscaling below
	 * the logical size always uses a fractional scale so the full frame still
	 * fits. Defaults to true in {@link makeSkiaPlatformBackendLayer}.
	 */
	readonly preferIntegerScaling?: boolean;
	readonly resizable?: boolean;
	readonly title: string;
	readonly windowHeight: number;
	readonly windowWidth: number;
}

interface ActiveMusicPlayback {
	readonly buffer: AudioBuffer;
	readonly cueId: string;
	readonly gainNode: GainNode;
	readonly loop: boolean;
	readonly pitch: number;
	readonly source: AudioBufferSourceNode | null;
	readonly startedAtSeconds: number;
	readonly startOffsetSeconds: number;
	readonly volume: number;
}

interface ActiveSoundPlayback {
	readonly cueId: string;
	readonly gainNode: GainNode;
	readonly loop: boolean;
	readonly pitch: number;
	readonly playbackId: string;
	readonly source: AudioBufferSourceNode;
	readonly volume: number;
}

const white: Color = {
	alpha: 1,
	blue: 1,
	green: 1,
	red: 1,
};

function createRendererSnapshot(): PlatformRendererSnapshot {
	return {
		backend: "skia",
		frameCount: 0,
		supportsBlendModes: ["add", "alpha", "multiply"],
		supportsImages: true,
		supportsText: true,
	};
}

function createAudioSnapshot(): PlatformAudioOutputSnapshot {
	return {
		activeSoundCount: 0,
		backend: "node-web-audio-api",
		currentMusicCueId: null,
		supportsLoopingMusic: true,
		supportsPauseResume: true,
		supportsPitch: true,
		supportsVolume: true,
	};
}

function createTimingSnapshot(
	frameDelayMillis: number,
): PlatformTimingSnapshot {
	return {
		backend: "effect-sleep",
		frameDelayMillis,
	};
}

const diagnosticsSnapshot = (
	frameDelayMillis: number,
): PlatformBackendDiagnostics => ({
	audio: createAudioSnapshot(),
	initialized: false,
	inputEventCount: 0,
	lastError: null,
	renderer: createRendererSnapshot(),
	timing: createTimingSnapshot(frameDelayMillis),
	window: null,
});

const toRgba = (color: Color, alphaMultiplier = 1): string =>
	`rgba(${Math.round(color.red * 255)}, ${Math.round(
		color.green * 255,
	)}, ${Math.round(color.blue * 255)}, ${Math.max(
		0,
		Math.min(1, color.alpha * alphaMultiplier),
	)})`;

const toCanvasBlendMode = (
	blendMode: "add" | "alpha" | "multiply",
): "lighter" | "multiply" | "source-over" => {
	switch (blendMode) {
		case "add":
			return "lighter";
		case "multiply":
			return "multiply";
		default:
			return "source-over";
	}
};

function normalizeKey(key: string | null): string | null {
	switch (key) {
		case null:
			return null;
		case "Down":
		case "down":
			return "ArrowDown";
		case "Esc":
		case "escape":
			return "Escape";
		case "f3":
			return "F3";
		case "Left":
		case "left":
			return "ArrowLeft";
		case "Return":
		case "return":
			return "Enter";
		case "Right":
		case "right":
			return "ArrowRight";
		case "Spacebar":
		case "space":
		case " ":
			return "Space";
		case "Up":
		case "up":
			return "ArrowUp";
		default:
			if (key.startsWith("Arrow") || key.startsWith("F")) {
				return key;
			}

			return key.length === 1 ? key.toUpperCase() : key;
	}
}

function getPlaceholderColor(imageId: string): string {
	let hash = 0;
	for (const character of imageId) {
		hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
	}

	const red = 80 + (hash % 120);
	const green = 80 + ((hash >> 8) % 120);
	const blue = 80 + ((hash >> 16) % 120);
	return `rgb(${red}, ${green}, ${blue})`;
}

const drawMissingImage = (
	context: SkiaContext2D,
	imageId: string,
	x: number,
	y: number,
	width: number,
	height: number,
) => {
	context.fillStyle = getPlaceholderColor(imageId);
	context.fillRect(x, y, width, height);
	context.strokeStyle = "rgba(255,255,255,0.9)";
	context.strokeRect(x, y, width, height);
	context.fillStyle = "rgba(255,255,255,0.95)";
	context.font = '10px "Monaco"';
	context.textBaseline = "top";
	context.fillText(imageId.slice(0, 12), x + 2, y + 2, Math.max(0, width - 4));
};

function formatFontString(family: string, sizePx: number): string {
	return `${sizePx}px "${family}", "Monaco"`;
}

const renderCommand = (
	context: SkiaContext2D,
	command: DrawCommand,
	images: ReadonlyMap<string, LoadedImage>,
	defaultFontFamily: string,
	defaultFontSizePx: number,
	fontAssetDefinitions: Readonly<
		Record<
			string,
			{
				readonly family: string;
				readonly sizePx: number;
			}
		>
	>,
	state: {
		blendMode: "add" | "alpha" | "multiply";
		tint: Color;
	},
	options: {
		readonly includeText: boolean;
		readonly smoothImages: boolean;
	},
) => {
	context.globalCompositeOperation = toCanvasBlendMode(state.blendMode);

	switch (command.type) {
		case "clear":
			context.save();
			context.setTransform(1, 0, 0, 1, 0, 0);
			context.globalCompositeOperation = "source-over";
			context.fillStyle = toRgba(command.color);
			context.fillRect(0, 0, context.canvas.width, context.canvas.height);
			context.restore();
			return;
		case "set-blend-mode":
			state.blendMode = command.blendMode;
			return;
		case "set-tint":
			state.tint = command.color;
			return;
		case "push-transform":
			context.save();
			context.translate(
				command.transform.translation.x,
				command.transform.translation.y,
			);
			context.rotate(command.transform.rotationRadians);
			context.scale(command.transform.scaleX, command.transform.scaleY);
			return;
		case "pop-transform":
			context.restore();
			return;
		case "draw-image": {
			const image = images.get(command.imageId);
			const width = command.size?.width ?? image?.width ?? 16;
			const height = command.size?.height ?? image?.height ?? 16;
			context.globalAlpha = state.tint.alpha;
			context.imageSmoothingEnabled = options.smoothImages;
			context.imageSmoothingQuality = options.smoothImages ? "high" : "low";

			if (image === undefined) {
				drawMissingImage(
					context,
					command.imageId,
					command.position.x,
					command.position.y,
					width,
					height,
				);
			} else {
				context.drawImage(
					image,
					command.position.x,
					command.position.y,
					width,
					height,
				);
			}

			context.globalAlpha = 1;
			return;
		}
		case "draw-rectangle":
			context.globalAlpha = command.color.alpha;
			if (command.mode === "fill") {
				context.fillStyle = toRgba(command.color);
				context.fillRect(
					command.position.x,
					command.position.y,
					command.size.width,
					command.size.height,
				);
			} else {
				context.strokeStyle = toRgba(command.color);
				context.strokeRect(
					command.position.x,
					command.position.y,
					command.size.width,
					command.size.height,
				);
			}
			context.globalAlpha = 1;
			return;
		case "draw-circle":
			context.beginPath();
			context.arc(
				command.center.x,
				command.center.y,
				command.radius,
				0,
				Math.PI * 2,
			);
			context.globalAlpha = command.color.alpha;
			if (command.mode === "fill") {
				context.fillStyle = toRgba(command.color);
				context.fill();
			} else {
				context.strokeStyle = toRgba(command.color);
				context.stroke();
			}
			context.globalAlpha = 1;
			return;
		case "draw-line":
			context.beginPath();
			context.moveTo(command.start.x, command.start.y);
			context.lineTo(command.end.x, command.end.y);
			context.strokeStyle = toRgba(command.color);
			context.globalAlpha = command.color.alpha;
			context.stroke();
			context.globalAlpha = 1;
			return;
		case "draw-text": {
			if (!options.includeText) {
				return;
			}

			const nativeFont =
				command.fontId === undefined
					? undefined
					: fontAssetDefinitions[command.fontId];
			context.fillStyle = toRgba(white, state.tint.alpha);
			context.font = formatFontString(
				nativeFont?.family ?? defaultFontFamily,
				nativeFont?.sizePx ?? defaultFontSizePx,
			);
			context.textBaseline = "top";
			context.textAlign = command.align;
			context.fillText(command.text, command.position.x, command.position.y);
			context.textAlign = "left";
			return;
		}
		case "draw-fade":
			context.save();
			context.setTransform(1, 0, 0, 1, 0, 0);
			context.globalCompositeOperation = "source-over";
			context.fillStyle = toRgba(command.color, command.opacity);
			context.fillRect(0, 0, context.canvas.width, context.canvas.height);
			context.restore();
			return;
		case "draw-flash":
			context.save();
			context.setTransform(1, 0, 0, 1, 0, 0);
			context.globalCompositeOperation = "lighter";
			context.fillStyle = toRgba(command.color, command.intensity);
			context.fillRect(0, 0, context.canvas.width, context.canvas.height);
			context.restore();
			return;
	}
};

const renderFrameToDisplay = (
	context: SkiaContext2D,
	frame: FrameSnapshot,
	images: ReadonlyMap<string, LoadedImage>,
	defaultFontFamily: string,
	defaultFontSizePx: number,
	fontAssetDefinitions: Readonly<
		Record<
			string,
			{
				readonly family: string;
				readonly sizePx: number;
			}
		>
	>,
	destinationRect: {
		readonly height: number;
		readonly width: number;
		readonly x: number;
		readonly y: number;
	},
	logicalWidth: number,
	logicalHeight: number,
) => {
	context.save();
	context.translate(destinationRect.x, destinationRect.y);
	context.scale(
		destinationRect.width / logicalWidth,
		destinationRect.height / logicalHeight,
	);

	const renderState: {
		blendMode: "add" | "alpha" | "multiply";
		tint: Color;
	} = {
		blendMode: "alpha",
		tint: white,
	};

	for (const command of frame.commands) {
		switch (command.type) {
			case "set-blend-mode":
				renderState.blendMode = command.blendMode;
				break;
			case "set-tint":
				renderState.tint = command.color;
				break;
			case "push-transform":
				context.save();
				context.translate(
					command.transform.translation.x,
					command.transform.translation.y,
				);
				context.rotate(command.transform.rotationRadians);
				context.scale(command.transform.scaleX, command.transform.scaleY);
				break;
			case "pop-transform":
				context.restore();
				break;
			case "draw-text":
				renderCommand(
					context,
					command,
					images,
					defaultFontFamily,
					defaultFontSizePx,
					fontAssetDefinitions,
					renderState,
					{ includeText: true, smoothImages: true },
				);
				break;
			default:
				renderCommand(
					context,
					command,
					images,
					defaultFontFamily,
					defaultFontSizePx,
					fontAssetDefinitions,
					renderState,
					{ includeText: true, smoothImages: true },
				);
				break;
		}
	}

	context.restore();
};

const updateWindowSnapshot = (
	window: Window,
	title: string,
): PlatformWindowSnapshot => ({
	backend: "skia-window",
	height: window.height,
	isOpen: !window.closed,
	pixelHeight: window.height,
	pixelWidth: window.width,
	title,
	width: window.width,
});

function clampUnit(value: number): number {
	return Math.max(0, Math.min(1, value));
}

const aspectFitRect = (
	containerWidth: number,
	containerHeight: number,
	contentWidth: number,
	contentHeight: number,
	preferIntegerScaling: boolean,
) => {
	const rawScale = Math.min(
		containerWidth / contentWidth,
		containerHeight / contentHeight,
	);
	// Prefer integer enlargement for pixel art, but still allow fractional
	// downscaling if the window is made smaller than the authored frame.
	const scale =
		preferIntegerScaling && rawScale >= 1
			? Math.max(1, Math.floor(rawScale))
			: rawScale;
	const width = Math.floor(contentWidth * scale);
	const height = Math.floor(contentHeight * scale);

	return {
		height,
		width,
		x: Math.floor((containerWidth - width) / 2),
		y: Math.floor((containerHeight - height) / 2),
	};
};

/**
 * Builds the Skia implementation of {@link PlatformBackend}.
 *
 * @public
 */
export function makeSkiaPlatformBackendLayer({
	defaultFontFamily = "Effect2d-native",
	defaultFontPath,
	defaultFontSizePx = 8,
	fontAssetDefinitions = {},
	frameDelayMillis = 16,
	imageAssetPaths = {},
	title,
	windowHeight,
	windowWidth,
	logicalHeight = windowHeight,
	logicalWidth = windowWidth,
	/**
	 * When upscaling the logical frame to fit the window, whether to snap the
	 * scale down to a whole number (1×, 2×, …) instead of using the continuous
	 * aspect-fit factor. Integer scales keep pixel-sized content crisp; fractional
	 * scales use more of the window but can soften artwork. Downscaling below
	 * the logical size always uses a fractional scale so the full frame still
	 * fits. Defaults to true in {@link makeSkiaPlatformBackendLayer}.
	 */
	preferIntegerScaling = true,
	resizable = true,
}: SkiaPlatformBackendOptions): Layer.Layer<
	PlatformBackend,
	EngineLaunchError
> {
	return Layer.effect(
		PlatformBackend,
		Effect.scoped(
			Effect.gen(function* () {
				const services = yield* Effect.context<never>();
				const runFork = Effect.runForkWith(services);
				const diagnosticsRef = yield* Ref.make(
					diagnosticsSnapshot(frameDelayMillis),
				);

				let appLaunchInFlight = false;
				let audioContext: AudioContext | null = null;
				let masterGain: GainNode | null = null;
				let musicBusGain: GainNode | null = null;
				let sfxBusGain: GainNode | null = null;
				let activeMusic: ActiveMusicPlayback | null = null;
				let activeSounds = new Map<string, ActiveSoundPlayback>();
				let decodedCueBuffers = new Map<string, AudioBuffer>();
				let bufferLoads = new Map<string, Promise<AudioBuffer>>();
				let completedPlaybackIds: Array<string> = [];
				let currentWindow: Window | null = null;
				let latestFrame: FrameSnapshot = {
					commands: [],
					isOpen: false,
					transformDepth: 0,
				};
				let pendingInputEvents: Array<InputEvent> = [];
				const loadedImages = new Map<string, LoadedImage>();
				const registeredFontDefinitions: Record<
					string,
					{
						readonly family: string;
						readonly sizePx: number;
					}
				> = {};

				const recordError = (reason: string) =>
					Ref.update(diagnosticsRef, (diagnostics) => ({
						...diagnostics,
						lastError: reason,
					}));

				const markWindowClosed = Effect.fnUntraced(function* () {
					currentWindow = null;
					pendingInputEvents = [];
					yield* Ref.update(diagnosticsRef, (diagnostics) => ({
						...diagnostics,
						initialized: false,
						window:
							diagnostics.window === null
								? null
								: {
										...diagnostics.window,
										isOpen: false,
									},
					}));
				});

				const ensureAudioRuntime = Effect.fnUntraced(function* () {
					if (
						audioContext !== null &&
						masterGain !== null &&
						musicBusGain !== null &&
						sfxBusGain !== null
					) {
						return {
							audioContext,
							masterGain,
							musicBusGain,
							sfxBusGain,
						};
					}

					const runtime = yield* Effect.tryPromise({
						// @effect-diagnostics-next-line asyncFunction:off -- Web Audio resume is Promise-based native interop inside Effect.tryPromise.
						try: async () => {
							const context = new AudioContext({
								latencyHint: "playback",
							});
							const nextMasterGain = new GainNode(context, { gain: 1 });
							const nextMusicBusGain = new GainNode(context, { gain: 1 });
							const nextSfxBusGain = new GainNode(context, { gain: 1 });

							nextMusicBusGain.connect(nextMasterGain);
							nextSfxBusGain.connect(nextMasterGain);
							nextMasterGain.connect(context.destination);

							if (context.state === "suspended") {
								await context.resume();
							}

							return {
								audioContext: context,
								masterGain: nextMasterGain,
								musicBusGain: nextMusicBusGain,
								sfxBusGain: nextSfxBusGain,
							};
						},
						catch: (cause) =>
							new EngineLaunchError({
								module: "native",
								reason: `Failed to initialize Web Audio output: ${String(cause)}`,
							}),
					});

					audioContext = runtime.audioContext;
					masterGain = runtime.masterGain;
					musicBusGain = runtime.musicBusGain;
					sfxBusGain = runtime.sfxBusGain;

					return runtime;
				});

				const loadCueBuffer = Effect.fnUntraced(function* (
					cueId: string,
					sourcePath: string,
				) {
					const cachedBuffer = decodedCueBuffers.get(cueId);
					if (cachedBuffer !== undefined) {
						return cachedBuffer;
					}

					const inFlight = bufferLoads.get(cueId);
					if (inFlight !== undefined) {
						return yield* Effect.tryPromise({
							try: () => inFlight,
							catch: (cause) =>
								new EngineLaunchError({
									module: "native",
									reason: `Failed to decode audio cue ${cueId}: ${String(cause)}`,
								}),
						});
					}

					const { audioContext: activeContext } = yield* ensureAudioRuntime();
					// @effect-diagnostics-next-line asyncFunction:off -- Bun file reads and Web Audio decoding are Promise-based native interop.
					const decodePromise = (async () => {
						const encodedAudio = await Bun.file(sourcePath).arrayBuffer();
						return activeContext.decodeAudioData(encodedAudio);
					})();
					bufferLoads.set(cueId, decodePromise);

					const decodedBuffer = yield* Effect.tryPromise({
						try: () => decodePromise,
						catch: (cause) =>
							new EngineLaunchError({
								module: "native",
								reason: `Failed to decode audio cue ${cueId}: ${String(cause)}`,
							}),
					}).pipe(
						Effect.ensuring(
							Effect.sync(() => {
								bufferLoads.delete(cueId);
							}),
						),
					);

					decodedCueBuffers.set(cueId, decodedBuffer);
					return decodedBuffer;
				});

				const clearMusicSource = (disposeGainNode: boolean) => {
					if (activeMusic === null) {
						return;
					}

					if (activeMusic.source !== null) {
						const source = activeMusic.source;
						source.onended = null;
						void runFork(
							Effect.try({
								try: () => source.stop(),
								catch: (cause) =>
									new EngineLaunchError({
										module: "native",
										reason: `Failed to stop music source: ${String(cause)}`,
									}),
							}).pipe(Effect.ignore),
						);
						activeMusic.source.disconnect();
					}

					if (disposeGainNode) {
						activeMusic.gainNode.disconnect();
						activeMusic = null;
					} else {
						activeMusic = {
							...activeMusic,
							source: null,
						};
					}
				};

				const currentMusicOffsetSeconds = (): number => {
					if (activeMusic === null) {
						return 0;
					}

					const elapsedSeconds =
						activeMusic.source === null || audioContext === null
							? 0
							: (audioContext.currentTime - activeMusic.startedAtSeconds) *
								activeMusic.pitch;
					const rawOffset = activeMusic.startOffsetSeconds + elapsedSeconds;
					if (activeMusic.loop && activeMusic.buffer.duration > 0) {
						return rawOffset % activeMusic.buffer.duration;
					}

					return Math.max(0, Math.min(activeMusic.buffer.duration, rawOffset));
				};

				const startMusicSource = Effect.fnUntraced(function* (
					cueId: string,
					buffer: AudioBuffer,
					options: {
						readonly loop: boolean;
						readonly pitch: number;
						readonly startOffsetSeconds: number;
						readonly volume: number;
					},
				) {
					const { audioContext, musicBusGain } = yield* ensureAudioRuntime();
					const musicGainNode =
						activeMusic?.gainNode ??
						new GainNode(audioContext, {
							gain: clampUnit(options.volume),
						});

					if (activeMusic === null) {
						musicGainNode.connect(musicBusGain);
					}
					musicGainNode.gain.value = clampUnit(options.volume);

					const source = audioContext.createBufferSource();
					source.buffer = buffer;
					source.loop = options.loop;
					source.playbackRate.value = options.pitch;
					source.connect(musicGainNode);
					source.start(0, options.startOffsetSeconds);

					activeMusic = {
						buffer,
						cueId,
						gainNode: musicGainNode,
						loop: options.loop,
						pitch: options.pitch,
						source,
						startedAtSeconds: audioContext.currentTime,
						startOffsetSeconds: options.startOffsetSeconds,
						volume: options.volume,
					};
				});

				const stopActiveSound = (
					playbackId: string,
					options?: {
						readonly markCompleted?: boolean;
					},
				) => {
					const activeSound = activeSounds.get(playbackId);
					if (activeSound === undefined) {
						return;
					}

					activeSound.source.onended = null;
					void runFork(
						Effect.try({
							try: () => activeSound.source.stop(),
							catch: (cause) =>
								new EngineLaunchError({
									module: "native",
									reason: `Failed to stop sound playback ${playbackId}: ${String(cause)}`,
								}),
						}).pipe(Effect.ignore),
					);
					activeSound.source.disconnect();
					activeSound.gainNode.disconnect();
					activeSounds.delete(playbackId);
					if (options?.markCompleted === true) {
						completedPlaybackIds.push(playbackId);
					}
				};

				const startSoundPlayback = Effect.fnUntraced(function* (
					playbackId: string,
					cueId: string,
					buffer: AudioBuffer,
					options: {
						readonly loop: boolean;
						readonly pitch: number;
						readonly volume: number;
					},
				) {
					const { audioContext, sfxBusGain } = yield* ensureAudioRuntime();
					const gainNode = new GainNode(audioContext, {
						gain: clampUnit(options.volume),
					});
					gainNode.connect(sfxBusGain);

					const source = audioContext.createBufferSource();
					source.buffer = buffer;
					source.loop = options.loop;
					source.playbackRate.value = options.pitch;
					source.connect(gainNode);
					source.onended = () => {
						if (!activeSounds.has(playbackId) || options.loop) {
							return;
						}

						stopActiveSound(playbackId, { markCompleted: true });
					};
					source.start();

					activeSounds.set(playbackId, {
						cueId,
						gainNode,
						loop: options.loop,
						pitch: options.pitch,
						playbackId,
						source,
						volume: options.volume,
					});
				});

				const resetAudioRuntime = Effect.fnUntraced(function* () {
					for (const playbackId of Array.from(activeSounds.keys())) {
						stopActiveSound(playbackId);
					}

					clearMusicSource(true);
					completedPlaybackIds = [];

					if (audioContext !== null) {
						const contextToClose = audioContext;
						yield* Effect.tryPromise({
							try: () => contextToClose.close(),
							catch: (cause) =>
								new EngineLaunchError({
									module: "native",
									reason: `Failed to close Web Audio context: ${String(cause)}`,
								}),
						}).pipe(
							Effect.catch((error: EngineLaunchError) =>
								recordError(error.reason),
							),
						);
					}

					audioContext = null;
					masterGain = null;
					musicBusGain = null;
					sfxBusGain = null;
					activeMusic = null;
					activeSounds = new Map();
					decodedCueBuffers = new Map();
					bufferLoads = new Map();

					yield* Ref.update(diagnosticsRef, (diagnostics) => ({
						...diagnostics,
						audio: {
							...diagnostics.audio,
							activeSoundCount: 0,
							currentMusicCueId: null,
						},
					}));
				});

				const open = Effect.fn("PlatformBackend.open")(function* (
					_gameId: string,
				) {
					App.eventLoop = "node";
					App.fps = Math.max(1, Math.round(1000 / frameDelayMillis));

					if (!App.running && !appLaunchInFlight) {
						appLaunchInFlight = true;
						void runFork(
							Effect.tryPromise({
								try: () => App.launch(),
								catch: (cause) =>
									new EngineLaunchError({
										module: "native",
										reason: `Skia app loop failed: ${String(cause)}`,
									}),
							}).pipe(
								Effect.catch((error: EngineLaunchError) =>
									recordError(error.reason),
								),
								Effect.ensuring(
									Effect.sync(() => {
										appLaunchInFlight = false;
									}),
								),
							),
						);
					}

					const window = new Window({
						background: "black",
						height: windowHeight,
						resizable,
						title,
						visible: true,
						width: windowWidth,
					});

					currentWindow = window;
					pendingInputEvents = [];

					if (defaultFontPath !== undefined) {
						yield* Effect.try({
							try: () => FontLibrary.use(defaultFontFamily, defaultFontPath),
							catch: () => null,
						}).pipe(Effect.ignore);
					}

					for (const [fontId, definition] of Object.entries(
						fontAssetDefinitions,
					)) {
						registeredFontDefinitions[fontId] = {
							family: definition.family,
							sizePx: definition.sizePx,
						};

						yield* Effect.try({
							try: () =>
								FontLibrary.use(definition.family, definition.sourcePath),
							catch: () => null,
						}).pipe(Effect.ignore);
					}

					for (const [imageId, sourcePath] of Object.entries(imageAssetPaths)) {
						if (loadedImages.has(imageId)) {
							continue;
						}

						const image = yield* Effect.tryPromise({
							try: () => loadImage(sourcePath),
							catch: (cause) =>
								new EngineLaunchError({
									module: "native",
									reason: `Failed to load image ${imageId}: ${String(cause)}`,
								}),
						}).pipe(Effect.option);

						if (Option.isSome(image)) {
							loadedImages.set(imageId, image.value);
						}
					}

					window.on("draw", (event) => {
						const displayCanvas = event.target.canvas;
						if (
							displayCanvas.width !== event.target.width ||
							displayCanvas.height !== event.target.height
						) {
							displayCanvas.width = event.target.width;
							displayCanvas.height = event.target.height;
						}

						const displayContext = event.target.ctx;
						displayContext.save();
						displayContext.setTransform(1, 0, 0, 1, 0, 0);
						displayContext.imageSmoothingEnabled = true;
						displayContext.imageSmoothingQuality = "high";
						displayContext.fillStyle = "black";
						displayContext.fillRect(
							0,
							0,
							displayCanvas.width,
							displayCanvas.height,
						);

						const destinationRect = aspectFitRect(
							displayCanvas.width,
							displayCanvas.height,
							logicalWidth,
							logicalHeight,
							preferIntegerScaling,
						);
						renderFrameToDisplay(
							displayContext,
							latestFrame,
							loadedImages,
							defaultFontFamily,
							defaultFontSizePx,
							registeredFontDefinitions,
							destinationRect,
							logicalWidth,
							logicalHeight,
						);
						displayContext.restore();
					});

					window.on("close", () => {
						void runFork(
							resetAudioRuntime().pipe(
								Effect.andThen(markWindowClosed()),
								Effect.catchCause((cause) =>
									recordError(`Failed during native close: ${String(cause)}`),
								),
							),
						);
					});
					window.on("resize", () => {
						void runFork(
							Ref.update(diagnosticsRef, (diagnostics) => ({
								...diagnostics,
								window: updateWindowSnapshot(window, title),
							})),
						);
					});
					window.on("keydown", (event) => {
						const key = normalizeKey(event.key);
						if (key !== null) {
							pendingInputEvents.push({
								key,
								type: "key-down",
							});
						}
					});
					window.on("keyup", (event) => {
						const key = normalizeKey(event.key);
						if (key !== null) {
							pendingInputEvents.push({
								key,
								type: "key-up",
							});
						}
					});
					window.on("mousedown", (event) => {
						pendingInputEvents.push({
							button: event.button,
							type: "mouse-down",
						});
					});
					window.on("mouseup", (event) => {
						pendingInputEvents.push({
							button: event.button,
							type: "mouse-up",
						});
					});
					window.on("mousemove", (event) => {
						pendingInputEvents.push({
							position: {
								x: event.x,
								y: event.y,
							},
							type: "mouse-move",
						});
					});
					window.on("wheel", (event) => {
						pendingInputEvents.push({
							deltaX: event.deltaX,
							deltaY: event.deltaY,
							type: "wheel",
						});
					});
					window.on("input", (event) => {
						if (typeof event.data === "string" && event.data.length > 0) {
							pendingInputEvents.push({
								text: event.data,
								type: "text-input",
							});
						}
					});

					yield* Ref.update(diagnosticsRef, (diagnostics) => ({
						...diagnostics,
						initialized: true,
						lastError: null,
						window: updateWindowSnapshot(window, title),
					}));
				});

				const close = Effect.gen(function* () {
					yield* resetAudioRuntime();

					const window = currentWindow;
					if (window !== null && !window.closed) {
						window.close();
					}

					yield* markWindowClosed();
					if (App.running) {
						yield* Effect.try({
							try: () => App.quit(),
							catch: (cause) =>
								new EngineLaunchError({
									module: "native",
									reason: `Failed to quit the Skia app loop: ${String(cause)}`,
								}),
						});
					}
				}).pipe(
					Effect.catchCause((cause) =>
						recordError(`Failed to close the native backend: ${String(cause)}`),
					),
				);

				const drainInputEvents = Effect.gen(function* () {
					const drained = pendingInputEvents.splice(0);
					yield* Ref.update(diagnosticsRef, (diagnostics) => ({
						...diagnostics,
						inputEventCount: diagnostics.inputEventCount + drained.length,
					}));
					return drained;
				});

				const presentFrame = Effect.fn("PlatformBackend.presentFrame")(
					function* (frame: FrameSnapshot) {
						const window = currentWindow;
						if (window === null || window.closed) {
							return yield* new EngineLaunchError({
								module: "native",
								reason:
									"Cannot present a frame because the native window is closed.",
							});
						}

						latestFrame = frame;

						yield* Ref.update(diagnosticsRef, (diagnostics) => ({
							...diagnostics,
							renderer: {
								...diagnostics.renderer,
								frameCount: diagnostics.renderer.frameCount + 1,
							},
							window: updateWindowSnapshot(window, title),
						}));
					},
				);

				const syncAudio = Effect.fn("PlatformBackend.syncAudio")(function* (
					snapshot: AudioSnapshot,
				) {
					const desiredSoundIds = new Set(
						snapshot.sounds.map((sound) => sound.playbackId),
					);
					const drainedCompletedPlaybackIds = completedPlaybackIds.splice(0);

					if (
						snapshot.music !== null ||
						snapshot.sounds.length > 0 ||
						snapshot.busVolumes.master !== 1 ||
						snapshot.busVolumes.music !== 1 ||
						snapshot.busVolumes.sfx !== 1
					) {
						const { audioContext, masterGain, musicBusGain, sfxBusGain } =
							yield* ensureAudioRuntime();

						if (audioContext.state === "suspended") {
							yield* Effect.tryPromise({
								try: () => audioContext.resume(),
								catch: (cause) =>
									new EngineLaunchError({
										module: "native",
										reason: `Failed to resume Web Audio context: ${String(cause)}`,
									}),
							});
						}

						masterGain.gain.value = clampUnit(snapshot.busVolumes.master);
						musicBusGain.gain.value = clampUnit(snapshot.busVolumes.music);
						sfxBusGain.gain.value = clampUnit(snapshot.busVolumes.sfx);
					}

					for (const playbackId of Array.from(activeSounds.keys())) {
						if (!desiredSoundIds.has(playbackId)) {
							stopActiveSound(playbackId);
						}
					}

					for (const sound of snapshot.sounds) {
						const cue = snapshot.loadedCues.get(sound.cueId);
						if (cue === undefined) {
							yield* recordError(
								`Cannot play sound ${sound.cueId} because it is not loaded.`,
							);
							continue;
						}

						const activeSound = activeSounds.get(sound.playbackId);
						if (activeSound === undefined) {
							const buffer = yield* loadCueBuffer(cue.cueId, cue.sourcePath);
							yield* startSoundPlayback(sound.playbackId, cue.cueId, buffer, {
								loop: sound.loop,
								pitch: sound.pitch,
								volume: sound.volume,
							});
						} else {
							activeSound.gainNode.gain.value = clampUnit(sound.volume);
							activeSound.source.loop = sound.loop;
							activeSound.source.playbackRate.value = sound.pitch;
						}
					}

					if (
						snapshot.music === null ||
						snapshot.loadedCues.get(snapshot.music.cueId) === undefined
					) {
						clearMusicSource(true);
					} else {
						const cue = snapshot.loadedCues.get(snapshot.music.cueId);
						if (cue !== undefined) {
							const buffer = yield* loadCueBuffer(cue.cueId, cue.sourcePath);
							if (
								activeMusic === null ||
								activeMusic.cueId !== snapshot.music.cueId
							) {
								clearMusicSource(true);
								if (!snapshot.music.paused) {
									yield* startMusicSource(snapshot.music.cueId, buffer, {
										loop: snapshot.music.loop,
										pitch: snapshot.music.pitch,
										startOffsetSeconds: 0,
										volume: snapshot.music.volume,
									});
								} else {
									const { audioContext, musicBusGain } =
										yield* ensureAudioRuntime();
									const gainNode = new GainNode(audioContext, {
										gain: clampUnit(snapshot.music.volume),
									});
									gainNode.connect(musicBusGain);
									activeMusic = {
										buffer,
										cueId: snapshot.music.cueId,
										gainNode,
										loop: snapshot.music.loop,
										pitch: snapshot.music.pitch,
										source: null,
										startedAtSeconds: audioContext.currentTime,
										startOffsetSeconds: 0,
										volume: snapshot.music.volume,
									};
								}
							} else {
								activeMusic.gainNode.gain.value = clampUnit(
									snapshot.music.volume,
								);

								const musicNeedsRestart =
									activeMusic.loop !== snapshot.music.loop ||
									activeMusic.pitch !== snapshot.music.pitch;

								if (snapshot.music.paused) {
									if (activeMusic.source !== null) {
										const offsetSeconds = currentMusicOffsetSeconds();
										clearMusicSource(false);
										if (activeMusic !== null) {
											activeMusic = {
												...activeMusic,
												loop: snapshot.music.loop,
												pitch: snapshot.music.pitch,
												startOffsetSeconds: offsetSeconds,
												volume: snapshot.music.volume,
											};
										}
									}
								} else if (activeMusic.source === null || musicNeedsRestart) {
									const startOffsetSeconds =
										activeMusic.source === null
											? activeMusic.startOffsetSeconds
											: currentMusicOffsetSeconds();
									clearMusicSource(false);
									yield* startMusicSource(snapshot.music.cueId, buffer, {
										loop: snapshot.music.loop,
										pitch: snapshot.music.pitch,
										startOffsetSeconds,
										volume: snapshot.music.volume,
									});
								}
							}
						}
					}

					yield* Ref.update(diagnosticsRef, (diagnostics) => ({
						...diagnostics,
						audio: {
							...diagnostics.audio,
							activeSoundCount: activeSounds.size,
							currentMusicCueId:
								activeMusic === null || snapshot.music?.paused === true
									? null
									: activeMusic.cueId,
						},
					}));

					return drainedCompletedPlaybackIds;
				});

				const waitForNextFrame = Effect.sleep(`${frameDelayMillis} millis`);

				yield* Effect.addFinalizer(() => close);

				return PlatformBackend.of({
					close,
					diagnostics: Ref.get(diagnosticsRef),
					drainInputEvents,
					open,
					presentFrame,
					syncAudio,
					waitForNextFrame,
				});
			}),
		),
	);
}

/**
 * Builds a ready-to-use native playable boundary backed by a Skia window and
 * renderer.
 *
 * @public
 */
export function makeSkiaNativeBoundaryLayer(
	options: SkiaPlatformBackendOptions,
): Layer.Layer<
	NativeBoundary,
	EngineLaunchError,
	Audio | Input | FrameUpdater
> {
	return NativeBoundary.layer.pipe(
		Layer.provide(makeSkiaPlatformBackendLayer(options)),
	);
}
