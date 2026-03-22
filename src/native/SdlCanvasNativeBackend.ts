import sdl from "@kmamal/sdl";
import {
	type Canvas,
	createCanvas,
	GlobalFonts,
	loadImage,
	type SKRSContext2D,
} from "@napi-rs/canvas";
import { Effect, Layer, Option, Ref } from "effect";
import type { Audio, AudioSnapshot } from "../audio/Audio.ts";
import { EngineLaunchError } from "../errors/EngineError.ts";
import type {
	Color,
	DrawCommand,
	FrameSnapshot,
} from "../graphics/Graphics.ts";
import type { Input, InputEvent } from "../input/Input.ts";
import {
	type NativeAudioOutputSnapshot,
	NativeBackend,
	type NativeBackendDiagnostics,
	type NativeRendererSnapshot,
	type NativeTimingSnapshot,
	type NativeWindowSnapshot,
} from "./NativeBackend.ts";
import { NativeBoundary } from "./NativeBoundary.ts";
import type { NativeFrameSource } from "./NativeFrameSource.ts";

export interface SdlCanvasNativeBackendOptions {
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
	readonly preferIntegerScaling?: boolean;
	readonly resizable?: boolean;
	readonly title: string;
	readonly windowHeight: number;
	readonly windowWidth: number;
}

interface SpawnedAudioProcess {
	readonly cueId: string;
	readonly loop: boolean;
	readonly process: Bun.Subprocess;
	readonly sourcePath: string;
	readonly volume: number;
}

const white: Color = {
	alpha: 1,
	blue: 1,
	green: 1,
	red: 1,
};

const rendererSnapshot = (): NativeRendererSnapshot => ({
	backend: "canvas2d",
	frameCount: 0,
	supportsBlendModes: ["add", "alpha", "multiply"],
	supportsImages: true,
	supportsText: true,
});

const audioSnapshot = (): NativeAudioOutputSnapshot => ({
	activeSoundCount: 0,
	backend: "afplay",
	currentMusicCueId: null,
	supportsLoopingMusic: true,
	supportsPauseResume: false,
	supportsPitch: false,
	supportsVolume: true,
});

const timingSnapshot = (frameDelayMillis: number): NativeTimingSnapshot => ({
	backend: "effect-sleep",
	frameDelayMillis,
});

const diagnosticsSnapshot = (
	frameDelayMillis: number,
): NativeBackendDiagnostics => ({
	audio: audioSnapshot(),
	initialized: false,
	inputEventCount: 0,
	lastError: null,
	renderer: rendererSnapshot(),
	timing: timingSnapshot(frameDelayMillis),
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

const normalizeKey = (key: string | null): string | null => {
	switch (key) {
		case null:
			return null;
		case "down":
			return "ArrowDown";
		case "escape":
			return "Escape";
		case "f3":
			return "F3";
		case "left":
			return "ArrowLeft";
		case "return":
			return "Enter";
		case "right":
			return "ArrowRight";
		case "space":
		case " ":
			return "Space";
		case "up":
			return "ArrowUp";
		default:
			return key.length === 1 ? key.toUpperCase() : key;
	}
};

const placeholderColor = (imageId: string): string => {
	let hash = 0;
	for (const character of imageId) {
		hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
	}

	const red = 80 + (hash % 120);
	const green = 80 + ((hash >> 8) % 120);
	const blue = 80 + ((hash >> 16) % 120);
	return `rgb(${red}, ${green}, ${blue})`;
};

const drawMissingImage = (
	context: SKRSContext2D,
	imageId: string,
	x: number,
	y: number,
	width: number,
	height: number,
) => {
	context.fillStyle = placeholderColor(imageId);
	context.fillRect(x, y, width, height);
	context.strokeStyle = "rgba(255,255,255,0.9)";
	context.strokeRect(x, y, width, height);
	context.fillStyle = "rgba(255,255,255,0.95)";
	context.font = '10px "Monaco"';
	context.textBaseline = "top";
	context.fillText(imageId.slice(0, 12), x + 2, y + 2, Math.max(0, width - 4));
};

const fontString = (family: string, sizePx: number): string =>
	`${sizePx}px "${family}", "Monaco"`;

const renderCommand = (
	context: SKRSContext2D,
	command: DrawCommand,
	images: ReadonlyMap<string, Awaited<ReturnType<typeof loadImage>>>,
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
			const nativeFont =
				command.fontId === undefined
					? undefined
					: fontAssetDefinitions[command.fontId];
			context.fillStyle = toRgba(white, state.tint.alpha);
			context.font = fontString(
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

const updateWindowSnapshot = (
	window: ReturnType<typeof sdl.video.createWindow>,
	title: string,
): NativeWindowSnapshot => ({
	backend: "sdl",
	height: window.height,
	isOpen: !window.destroyed,
	pixelHeight: window.pixelHeight,
	pixelWidth: window.pixelWidth,
	title,
	width: window.width,
});

const spawnAfplay = (sourcePath: string, volume: number): Bun.Subprocess =>
	Bun.spawn(
		["afplay", "-v", `${Math.max(0, Math.min(1, volume))}`, sourcePath],
		{
			stderr: "ignore",
			stdin: "ignore",
			stdout: "ignore",
		},
	);

const stopProcess = (process: Bun.Subprocess | null | undefined) => {
	if (process === undefined || process === null || process.killed) {
		return;
	}

	process.kill();
};

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

export const makeSdlCanvasNativeBackendLayer = ({
	defaultFontFamily = "effect2d-native",
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
	preferIntegerScaling = true,
	resizable = true,
}: SdlCanvasNativeBackendOptions): Layer.Layer<
	NativeBackend,
	EngineLaunchError
> =>
	Layer.effect(
		NativeBackend,
		Effect.gen(function* () {
			const diagnosticsRef = yield* Ref.make(
				diagnosticsSnapshot(frameDelayMillis),
			);
			const musicProcessRef = yield* Ref.make<SpawnedAudioProcess | null>(null);
			const soundProcessesRef = yield* Ref.make(
				new Map<string, SpawnedAudioProcess>(),
			);
			const windowRef = yield* Ref.make<ReturnType<
				typeof sdl.video.createWindow
			> | null>(null);

			let canvas: Canvas | null = null;
			let context: SKRSContext2D | null = null;
			let pendingInputEvents: Array<InputEvent> = [];
			const loadedImages = new Map<
				string,
				Awaited<ReturnType<typeof loadImage>>
			>();
			const registeredFontDefinitions: Record<
				string,
				{
					readonly family: string;
					readonly sizePx: number;
				}
			> = {};

			const recordError = Effect.fn("NativeBackend.recordError")(function* (
				reason: string,
			) {
				yield* Ref.update(diagnosticsRef, (diagnostics) => ({
					...diagnostics,
					lastError: reason,
				}));
			});

			const resetAudioProcesses = Effect.fn(
				"NativeBackend.resetAudioProcesses",
			)(function* () {
				stopProcess((yield* Ref.get(musicProcessRef))?.process);

				for (const process of (yield* Ref.get(soundProcessesRef)).values()) {
					stopProcess(process.process);
				}

				yield* Ref.set(musicProcessRef, null);
				yield* Ref.set(soundProcessesRef, new Map());
				yield* Ref.update(diagnosticsRef, (diagnostics) => ({
					...diagnostics,
					audio: {
						...diagnostics.audio,
						activeSoundCount: 0,
						currentMusicCueId: null,
					},
				}));
			});

			const open = Effect.fn("NativeBackend.open")(function* (gameId: string) {
				if (process.platform !== "darwin") {
					return yield* new EngineLaunchError({
						module: "native",
						reason: `SDL/Canvas native backend currently expects macOS for ${gameId}.`,
					});
				}

				const window = yield* Effect.try({
					try: () =>
						sdl.video.createWindow({
							height: windowHeight,
							resizable,
							title,
							width: windowWidth,
						}),
					catch: (cause) =>
						new EngineLaunchError({
							module: "native",
							reason: `Failed to create SDL window for ${gameId}: ${String(
								cause,
							)}`,
						}),
				});
				yield* Ref.set(windowRef, window);
				pendingInputEvents = [];
				canvas = createCanvas(window.pixelWidth, window.pixelHeight);
				context = canvas.getContext("2d");
				context.imageSmoothingEnabled = false;

				if (defaultFontPath !== undefined) {
					yield* Effect.try({
						try: () =>
							GlobalFonts.registerFromPath(defaultFontPath, defaultFontFamily),
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
							GlobalFonts.registerFromPath(
								definition.sourcePath,
								definition.family,
							),
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

				window.on("close", () => {
					void Effect.runPromise(
						Ref.update(diagnosticsRef, (diagnostics) => ({
							...diagnostics,
							initialized: false,
							window:
								diagnostics.window === null
									? null
									: {
											...diagnostics.window,
											isOpen: false,
										},
						})),
					);
				});
				window.on("resize", () => {
					void Effect.runPromise(
						Ref.update(diagnosticsRef, (diagnostics) => ({
							...diagnostics,
							window: updateWindowSnapshot(window, title),
						})),
					);
				});
				window.on("keyDown", (event) => {
					const key = normalizeKey(event.key);
					if (key !== null) {
						pendingInputEvents.push({
							key,
							type: "key-down",
						});
					}
				});
				window.on("keyUp", (event) => {
					const key = normalizeKey(event.key);
					if (key !== null) {
						pendingInputEvents.push({
							key,
							type: "key-up",
						});
					}
				});
				window.on("mouseButtonDown", (event) => {
					pendingInputEvents.push({
						button: event.button,
						type: "mouse-down",
					});
				});
				window.on("mouseButtonUp", (event) => {
					pendingInputEvents.push({
						button: event.button,
						type: "mouse-up",
					});
				});
				window.on("mouseMove", (event) => {
					pendingInputEvents.push({
						position: {
							x: event.x,
							y: event.y,
						},
						type: "mouse-move",
					});
				});
				window.on("mouseWheel", (event) => {
					pendingInputEvents.push({
						deltaX: event.dx,
						deltaY: event.dy,
						type: "wheel",
					});
				});
				window.on("textInput", (event) => {
					pendingInputEvents.push({
						text: event.text,
						type: "text-input",
					});
				});

				yield* Ref.update(diagnosticsRef, (diagnostics) => ({
					...diagnostics,
					initialized: true,
					lastError: null,
					window: updateWindowSnapshot(window, title),
				}));
			});

			const close = Effect.gen(function* () {
				yield* resetAudioProcesses();

				const window = yield* Ref.get(windowRef);
				if (window !== null && !window.destroyed) {
					window.destroy();
				}

				canvas = null;
				context = null;
				pendingInputEvents = [];
				yield* Ref.set(windowRef, null);
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

			const drainInputEvents = Effect.gen(function* () {
				const drained = pendingInputEvents.splice(0);
				yield* Ref.update(diagnosticsRef, (diagnostics) => ({
					...diagnostics,
					inputEventCount: diagnostics.inputEventCount + drained.length,
				}));
				return drained;
			});

			const presentFrame = Effect.fn("NativeBackend.presentFrame")(function* (
				frame: FrameSnapshot,
			) {
				const window = yield* Ref.get(windowRef);
				if (window === null || window.destroyed || context === null) {
					return yield* new EngineLaunchError({
						module: "native",
						reason:
							"Cannot present a frame because the native window is closed.",
					});
				}

				if (
					canvas === null ||
					canvas.width !== logicalWidth ||
					canvas.height !== logicalHeight
				) {
					canvas = createCanvas(logicalWidth, logicalHeight);
					context = canvas.getContext("2d");
					context.imageSmoothingEnabled = false;
				}

				yield* Effect.try({
					try: () => {
						const renderState = {
							blendMode: "alpha" as const,
							tint: white,
						};

						context?.save();
						context?.setTransform(1, 0, 0, 1, 0, 0);
						if (context !== null) {
							context.globalCompositeOperation = "source-over";
							context.clearRect(
								0,
								0,
								context.canvas.width,
								context.canvas.height,
							);

							for (const command of frame.commands) {
								renderCommand(
									context,
									command,
									loadedImages,
									defaultFontFamily,
									defaultFontSizePx,
									registeredFontDefinitions,
									renderState,
								);
							}

							const buffer = context.canvas.data();
							// SDL's dstRect is expressed in render pixels, not window points.
							// On Retina displays, using width/height here draws into a quarter
							// of the client area and makes the frame look clipped or offset.
							const destinationRect = aspectFitRect(
								window.pixelWidth,
								window.pixelHeight,
								logicalWidth,
								logicalHeight,
								preferIntegerScaling,
							);
							window.render(
								context.canvas.width,
								context.canvas.height,
								context.canvas.width * 4,
								"rgba32",
								buffer,
								{
									dstRect: destinationRect,
									scaling: "nearest",
								},
							);
						}
					},
					catch: (cause) =>
						new EngineLaunchError({
							module: "native",
							reason: `Failed to present frame: ${String(cause)}`,
						}),
				});

				yield* Ref.update(diagnosticsRef, (diagnostics) => ({
					...diagnostics,
					renderer: {
						...diagnostics.renderer,
						frameCount: diagnostics.renderer.frameCount + 1,
					},
					window: updateWindowSnapshot(window, title),
				}));
			});

			const syncAudio = Effect.fn("NativeBackend.syncAudio")(function* (
				snapshot: AudioSnapshot,
			) {
				const currentMusic = yield* Ref.get(musicProcessRef);
				const currentSounds = new Map(yield* Ref.get(soundProcessesRef));
				const completedPlaybackIds: Array<string> = [];
				const desiredSoundIds = new Set(
					snapshot.sounds.map((sound) => sound.playbackId),
				);

				for (const [playbackId, process] of currentSounds) {
					if (process.process.exitCode !== null && !process.loop) {
						completedPlaybackIds.push(playbackId);
					}

					if (
						!desiredSoundIds.has(playbackId) ||
						process.process.exitCode !== null
					) {
						stopProcess(process.process);
						currentSounds.delete(playbackId);
					}
				}

				for (const sound of snapshot.sounds) {
					if (
						currentSounds.has(sound.playbackId) ||
						completedPlaybackIds.includes(sound.playbackId)
					) {
						continue;
					}

					const cue = snapshot.loadedCues.get(sound.cueId);
					if (cue === undefined) {
						yield* recordError(
							`Cannot play sound ${sound.cueId} because it is not loaded.`,
						);
						continue;
					}

					const volume =
						snapshot.busVolumes.master * snapshot.busVolumes.sfx * sound.volume;
					const process = yield* Effect.try({
						try: () => spawnAfplay(cue.sourcePath, volume),
						catch: (cause) =>
							new EngineLaunchError({
								module: "native",
								reason: `Failed to start sound ${sound.cueId}: ${String(cause)}`,
							}),
					}).pipe(Effect.option);

					if (Option.isSome(process)) {
						currentSounds.set(sound.playbackId, {
							cueId: sound.cueId,
							loop: sound.loop,
							process: process.value,
							sourcePath: cue.sourcePath,
							volume,
						});
					}
				}

				if (
					snapshot.music === null ||
					snapshot.music.paused ||
					snapshot.loadedCues.get(snapshot.music.cueId) === undefined
				) {
					stopProcess(currentMusic?.process);
					yield* Ref.set(musicProcessRef, null);
				} else {
					const cue = snapshot.loadedCues.get(snapshot.music.cueId);
					const volume =
						snapshot.busVolumes.master *
						snapshot.busVolumes.music *
						snapshot.music.volume;
					const musicNeedsRestart =
						currentMusic === null ||
						currentMusic.cueId !== snapshot.music.cueId ||
						currentMusic.volume !== volume ||
						currentMusic.process.exitCode !== null;

					if (cue !== undefined && musicNeedsRestart) {
						stopProcess(currentMusic?.process);

						const process = yield* Effect.try({
							try: () => spawnAfplay(cue.sourcePath, volume),
							catch: (cause) =>
								new EngineLaunchError({
									module: "native",
									reason: `Failed to start music ${snapshot.music?.cueId}: ${String(
										cause,
									)}`,
								}),
						}).pipe(Effect.option);

						if (Option.isSome(process)) {
							yield* Ref.set(musicProcessRef, {
								cueId: snapshot.music.cueId,
								loop: snapshot.music.loop,
								process: process.value,
								sourcePath: cue.sourcePath,
								volume,
							});
						}
					}
				}

				yield* Ref.set(soundProcessesRef, currentSounds);
				yield* Ref.update(diagnosticsRef, (diagnostics) => ({
					...diagnostics,
					audio: {
						...diagnostics.audio,
						activeSoundCount: currentSounds.size,
						currentMusicCueId:
							snapshot.music === null || snapshot.music.paused
								? null
								: snapshot.music.cueId,
					},
				}));

				return completedPlaybackIds;
			});

			const waitForNextFrame = Effect.sleep(`${frameDelayMillis} millis`);

			yield* Effect.addFinalizer(() => close);

			return NativeBackend.of({
				close,
				diagnostics: Ref.get(diagnosticsRef),
				drainInputEvents,
				open,
				presentFrame,
				syncAudio,
				waitForNextFrame,
			});
		}),
	);

export const makeSdlCanvasNativeBoundaryLayer = (
	options: SdlCanvasNativeBackendOptions,
): Layer.Layer<
	NativeBoundary,
	EngineLaunchError,
	Audio | Input | NativeFrameSource
> =>
	NativeBoundary.layer.pipe(
		Layer.provide(makeSdlCanvasNativeBackendLayer(options)),
	);
