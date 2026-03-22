import sdl from "@kmamal/sdl";
import {
	type Canvas,
	createCanvas,
	GlobalFonts,
	loadImage,
	type SKRSContext2D,
} from "@napi-rs/canvas";
import { Effect, Layer, Ref } from "effect";

import { EngineLaunchError } from "../errors/EngineError.ts";
import type {
	Color,
	DrawCommand,
	FrameSnapshot,
} from "../graphics/Graphics.ts";
import { Input, type InputEvent } from "../input/Input.ts";
import { NativeBoundary } from "./NativeBoundary.ts";
import { NativeFrameSource } from "./NativeFrameSource.ts";

export interface SdlCanvasNativeBoundaryOptions {
	readonly defaultFontFamily?: string;
	readonly defaultFontPath?: string;
	readonly imageAssetPaths?: Readonly<Record<string, string>>;
	readonly title: string;
	readonly windowHeight: number;
	readonly windowWidth: number;
}

const white: Color = {
	alpha: 1,
	blue: 1,
	green: 1,
	red: 1,
};

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

const renderCommand = (
	context: SKRSContext2D,
	command: DrawCommand,
	images: ReadonlyMap<string, Awaited<ReturnType<typeof loadImage>>>,
	defaultFontFamily: string,
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
		case "draw-text":
			context.fillStyle = toRgba(white, state.tint.alpha);
			context.font = `12px "${defaultFontFamily}", "Monaco"`;
			context.textBaseline = "top";
			context.textAlign = command.align;
			context.fillText(command.text, command.position.x, command.position.y);
			context.textAlign = "left";
			return;
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

const presentFrame = (
	window: ReturnType<typeof sdl.video.createWindow>,
	context: SKRSContext2D,
	frame: FrameSnapshot,
	images: ReadonlyMap<string, Awaited<ReturnType<typeof loadImage>>>,
	defaultFontFamily: string,
) => {
	const renderState = {
		blendMode: "alpha" as const,
		tint: white,
	};

	context.save();
	context.setTransform(1, 0, 0, 1, 0, 0);
	context.globalCompositeOperation = "source-over";
	context.clearRect(0, 0, context.canvas.width, context.canvas.height);
	context.restore();

	for (const command of frame.commands) {
		renderCommand(context, command, images, defaultFontFamily, renderState);
	}

	const imageData = context.getImageData(
		0,
		0,
		context.canvas.width,
		context.canvas.height,
	);
	const buffer = Buffer.from(
		imageData.data.buffer,
		imageData.data.byteOffset,
		imageData.data.byteLength,
	);
	window.render(
		context.canvas.width,
		context.canvas.height,
		context.canvas.width * 4,
		"rgba32",
		buffer,
	);
};

export const makeSdlCanvasNativeBoundaryLayer = ({
	defaultFontFamily = "effect2d-native",
	defaultFontPath,
	imageAssetPaths = {},
	title,
	windowHeight,
	windowWidth,
}: SdlCanvasNativeBoundaryOptions): Layer.Layer<
	NativeBoundary,
	EngineLaunchError,
	Input | NativeFrameSource
> =>
	Layer.effect(
		NativeBoundary,
		Effect.gen(function* () {
			const frameSource = yield* NativeFrameSource;
			const input = yield* Input;
			const windowRef = yield* Ref.make<ReturnType<
				typeof sdl.video.createWindow
			> | null>(null);

			const initialize = Effect.fn("NativeBoundary.initialize")(function* (
				gameId: string,
			) {
				const pendingEvents: Array<InputEvent> = [];
				let running = true;

				const window = yield* Effect.try({
					try: () =>
						sdl.video.createWindow({
							height: windowHeight,
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

				window.on("close", () => {
					running = false;
				});
				window.on("keyDown", (event) => {
					const key = normalizeKey(event.key);
					if (key !== null) {
						pendingEvents.push({
							key,
							type: "key-down",
						});
					}
				});
				window.on("keyUp", (event) => {
					const key = normalizeKey(event.key);
					if (key !== null) {
						pendingEvents.push({
							key,
							type: "key-up",
						});
					}
				});
				window.on("mouseButtonDown", (event) => {
					pendingEvents.push({
						button: event.button,
						type: "mouse-down",
					});
				});
				window.on("mouseButtonUp", (event) => {
					pendingEvents.push({
						button: event.button,
						type: "mouse-up",
					});
				});
				window.on("mouseMove", (event) => {
					pendingEvents.push({
						position: {
							x: event.x,
							y: event.y,
						},
						type: "mouse-move",
					});
				});
				window.on("mouseWheel", (event) => {
					pendingEvents.push({
						deltaX: event.dx,
						deltaY: event.dy,
						type: "wheel",
					});
				});
				window.on("textInput", (event) => {
					pendingEvents.push({
						text: event.text,
						type: "text-input",
					});
				});

				if (defaultFontPath !== undefined) {
					yield* Effect.sync(() => {
						try {
							GlobalFonts.registerFromPath(defaultFontPath, defaultFontFamily);
						} catch {
							return;
						}
					});
				}

				const loadedImages = new Map<
					string,
					Awaited<ReturnType<typeof loadImage>>
				>();
				for (const [imageId, sourcePath] of Object.entries(imageAssetPaths)) {
					const image = yield* Effect.tryPromise({
						try: () => loadImage(sourcePath),
						catch: (cause) =>
							new EngineLaunchError({
								module: "native",
								reason: `Failed to load image ${imageId}: ${String(cause)}`,
							}),
					}).pipe(Effect.option);
					if (image._tag === "Some") {
						loadedImages.set(imageId, image.value);
					}
				}

				let canvas: Canvas = createCanvas(
					window.pixelWidth,
					window.pixelHeight,
				);
				let context: SKRSContext2D = canvas.getContext("2d");
				context.imageSmoothingEnabled = false;

				try {
					while (running && !window.destroyed) {
						if (
							canvas.width !== window.pixelWidth ||
							canvas.height !== window.pixelHeight
						) {
							canvas = createCanvas(window.pixelWidth, window.pixelHeight);
							context = canvas.getContext("2d");
							context.imageSmoothingEnabled = false;
						}

						yield* input.beginFrame;
						for (const event of pendingEvents.splice(0)) {
							yield* input.applyEvent(event);
						}

						const frame = yield* frameSource.nextFrame;
						yield* Effect.try({
							try: () =>
								presentFrame(
									window,
									context,
									frame,
									loadedImages,
									defaultFontFamily,
								),
							catch: (cause) =>
								new EngineLaunchError({
									module: "native",
									reason: `Failed to present frame for ${gameId}: ${String(
										cause,
									)}`,
								}),
						});

						yield* Effect.sleep("16 millis");
					}
				} finally {
					if (!window.destroyed) {
						window.destroy();
					}
					yield* Ref.set(windowRef, null);
				}
			});

			const shutdown = Effect.gen(function* () {
				const window = yield* Ref.get(windowRef);
				if (window !== null && !window.destroyed) {
					window.destroy();
				}
				yield* Ref.set(windowRef, null);
			});

			return NativeBoundary.of({
				initialize,
				shutdown,
			});
		}),
	);
