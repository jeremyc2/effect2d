import { Effect, Layer, Ref, Schema, ServiceMap } from "effect";
import type { CameraVector } from "./Camera.ts";

/**
 * A normalized RGBA color used throughout the graphics API.
 *
 * @public
 *
 * All channels are expected to be in the inclusive range `0..1`.
 */
export interface Color {
	readonly alpha: number;
	readonly blue: number;
	readonly green: number;
	readonly red: number;
}

/**
 * A 2D transform recorded onto the graphics command stream.
 *
 * @public
 */
export interface Transform2D {
	readonly rotationRadians: number;
	readonly scaleX: number;
	readonly scaleY: number;
	readonly translation: CameraVector;
}

/** Supported compositing modes for subsequent draw commands. @public */
export type BlendMode = "add" | "alpha" | "multiply";

/** Supported rectangle rendering modes. @public */
export type RectangleDrawMode = "fill" | "stroke";

/** Supported circle rendering modes. @public */
export type CircleDrawMode = "fill" | "stroke";

/**
 * Parameters for a text draw command.
 *
 * @public
 */
export interface DrawTextOptions {
	readonly align?: "center" | "left" | "right";
	readonly fontId?: string;
	readonly position: CameraVector;
	readonly text: string;
}

/**
 * A serializable render command recorded by {@link Graphics}.
 *
 * @public
 *
 * The native layer consumes these commands to present an actual frame. Game
 * code usually records commands through the `Graphics` service rather than
 * constructing `DrawCommand` objects directly.
 */
export type DrawCommand =
	| {
			readonly color: Color;
			readonly type: "clear";
	  }
	| {
			readonly color: Color;
			readonly type: "set-tint";
	  }
	| {
			readonly blendMode: BlendMode;
			readonly type: "set-blend-mode";
	  }
	| {
			readonly transform: Transform2D;
			readonly type: "push-transform";
	  }
	| {
			readonly type: "pop-transform";
	  }
	| {
			readonly imageId: string;
			readonly position: CameraVector;
			readonly size?: {
				readonly height: number;
				readonly width: number;
			};
			readonly type: "draw-image";
	  }
	| {
			readonly color: Color;
			readonly mode: RectangleDrawMode;
			readonly position: CameraVector;
			readonly size: {
				readonly height: number;
				readonly width: number;
			};
			readonly type: "draw-rectangle";
	  }
	| {
			readonly center: CameraVector;
			readonly color: Color;
			readonly mode: CircleDrawMode;
			readonly radius: number;
			readonly type: "draw-circle";
	  }
	| {
			readonly color: Color;
			readonly end: CameraVector;
			readonly start: CameraVector;
			readonly type: "draw-line";
	  }
	| {
			readonly align: "center" | "left" | "right";
			readonly fontId?: string;
			readonly position: CameraVector;
			readonly text: string;
			readonly type: "draw-text";
	  }
	| {
			readonly color: Color;
			readonly opacity: number;
			readonly type: "draw-fade";
	  }
	| {
			readonly color: Color;
			readonly intensity: number;
			readonly type: "draw-flash";
	  };

/**
 * The graphics frame currently being recorded or most recently completed.
 *
 * @public
 */
export interface FrameSnapshot {
	readonly commands: ReadonlyArray<DrawCommand>;
	readonly isOpen: boolean;
	readonly transformDepth: number;
}

interface GraphicsState {
	readonly currentFrame: FrameSnapshot;
	readonly lastCompletedFrame: FrameSnapshot | null;
}

const white: Color = {
	alpha: 1,
	blue: 1,
	green: 1,
	red: 1,
};

const initialFrame: FrameSnapshot = {
	commands: [],
	isOpen: false,
	transformDepth: 0,
};

const initialState: GraphicsState = {
	currentFrame: initialFrame,
	lastCompletedFrame: null,
};

/**
 * Indicates that game code attempted to record graphics commands without first
 * opening a frame.
 *
 * @public
 */
export class GraphicsFrameNotOpenError extends Schema.TaggedErrorClass<GraphicsFrameNotOpenError>()(
	"GraphicsFrameNotOpenError",
	{
		reason: Schema.String,
	},
) {}

/**
 * Indicates that more transforms were popped than pushed during a frame.
 *
 * @public
 */
export class GraphicsTransformStackUnderflowError extends Schema.TaggedErrorClass<GraphicsTransformStackUnderflowError>()(
	"GraphicsTransformStackUnderflowError",
	{
		reason: Schema.String,
	},
) {}

const appendCommand = Effect.fn("Graphics.appendCommand")(function* (
	stateRef: Ref.Ref<GraphicsState>,
	command: DrawCommand,
) {
	yield* Ref.update(stateRef, (state) => {
		if (!state.currentFrame.isOpen) {
			return state;
		}

		let transformDepth = state.currentFrame.transformDepth;
		if (command.type === "push-transform") {
			transformDepth += 1;
		} else if (command.type === "pop-transform") {
			transformDepth -= 1;
		}

		return {
			...state,
			currentFrame: {
				...state.currentFrame,
				commands: [...state.currentFrame.commands, command],
				transformDepth,
			},
		};
	});
});

/**
 * Records immediate-mode rendering commands for the current frame.
 *
 * @public
 *
 * "Immediate-mode" means:
 *
 * - each frame, your game code says what should be drawn right now
 * - those instructions are recorded as commands such as "draw image", "draw
 *   text", or "draw rectangle"
 * - once the frame ends, the native backend presents that recorded command list
 *
 * It does **not** mean the engine keeps a long-lived retained UI tree like the
 * DOM and then diffs it later. Instead, each frame is authored fresh from the
 * current game state.
 *
 * `Graphics` is intentionally command-oriented instead of being a retained
 * scene graph. Game code opens a frame, records the draw operations it wants to
 * appear, and then hands the completed {@link FrameSnapshot} to the native
 * boundary for presentation.
 *
 * This service is a good fit for Effect users because it behaves like a typed,
 * testable log of rendering intent:
 *
 * - gameplay and presentation code can be tested headlessly by inspecting the
 *   resulting command stream
 * - native backends can focus on playback rather than business logic
 * - transforms, tints, blend modes, text, fades, and flashes all share the
 *   same deterministic recording model
 */
export class Graphics extends ServiceMap.Service<
	Graphics,
	{
		readonly beginFrame: Effect.Effect<void>;
		readonly clear: (
			color: Color,
		) => Effect.Effect<void, GraphicsFrameNotOpenError>;
		readonly drawCircle: (
			center: CameraVector,
			radius: number,
			mode?: CircleDrawMode,
			color?: Color,
		) => Effect.Effect<void, GraphicsFrameNotOpenError>;
		readonly drawFade: (
			opacity: number,
			color?: Color,
		) => Effect.Effect<void, GraphicsFrameNotOpenError>;
		readonly drawFlash: (
			intensity: number,
			color?: Color,
		) => Effect.Effect<void, GraphicsFrameNotOpenError>;
		readonly drawImage: (
			imageId: string,
			position: CameraVector,
			size?: {
				readonly height: number;
				readonly width: number;
			},
		) => Effect.Effect<void, GraphicsFrameNotOpenError>;
		readonly drawLine: (
			start: CameraVector,
			end: CameraVector,
			color?: Color,
		) => Effect.Effect<void, GraphicsFrameNotOpenError>;
		readonly drawRectangle: (
			position: CameraVector,
			size: {
				readonly height: number;
				readonly width: number;
			},
			mode?: RectangleDrawMode,
			color?: Color,
		) => Effect.Effect<void, GraphicsFrameNotOpenError>;
		readonly drawText: (
			options: DrawTextOptions,
		) => Effect.Effect<void, GraphicsFrameNotOpenError>;
		readonly endFrame: Effect.Effect<
			FrameSnapshot,
			GraphicsFrameNotOpenError | GraphicsTransformStackUnderflowError
		>;
		readonly lastCompletedFrame: Effect.Effect<FrameSnapshot | null>;
		readonly popTransform: Effect.Effect<
			void,
			GraphicsFrameNotOpenError | GraphicsTransformStackUnderflowError
		>;
		readonly pushTransform: (
			transform: Transform2D,
		) => Effect.Effect<void, GraphicsFrameNotOpenError>;
		readonly setBlendMode: (
			blendMode: BlendMode,
		) => Effect.Effect<void, GraphicsFrameNotOpenError>;
		readonly setTint: (
			color: Color,
		) => Effect.Effect<void, GraphicsFrameNotOpenError>;
		readonly snapshot: Effect.Effect<FrameSnapshot>;
	}
>()("effect2d/graphics/Graphics") {
	static readonly layer = Layer.effect(
		Graphics,
		Effect.gen(function* () {
			const stateRef = yield* Ref.make(initialState);

			const snapshot = Ref.get(stateRef).pipe(
				Effect.map((state) => state.currentFrame),
			);

			const ensureFrameOpen = Effect.fn("Graphics.ensureFrameOpen")(
				function* () {
					const state = yield* Ref.get(stateRef);
					if (!state.currentFrame.isOpen) {
						return yield* new GraphicsFrameNotOpenError({
							reason:
								"A graphics frame must be open before draw commands can be recorded.",
						});
					}
				},
			);

			const beginFrame = Ref.update(stateRef, (state) => ({
				...state,
				currentFrame: {
					commands: [],
					isOpen: true,
					transformDepth: 0,
				},
			}));

			const clear = Effect.fn("Graphics.clear")(function* (color: Color) {
				yield* ensureFrameOpen();
				yield* appendCommand(stateRef, {
					color,
					type: "clear",
				});
			});

			const setTint = Effect.fn("Graphics.setTint")(function* (color: Color) {
				yield* ensureFrameOpen();
				yield* appendCommand(stateRef, {
					color,
					type: "set-tint",
				});
			});

			const setBlendMode = Effect.fn("Graphics.setBlendMode")(function* (
				blendMode: BlendMode,
			) {
				yield* ensureFrameOpen();
				yield* appendCommand(stateRef, {
					blendMode,
					type: "set-blend-mode",
				});
			});

			const pushTransform = Effect.fn("Graphics.pushTransform")(function* (
				transform: Transform2D,
			) {
				yield* ensureFrameOpen();
				yield* appendCommand(stateRef, {
					transform,
					type: "push-transform",
				});
			});

			const popTransform = Effect.gen(function* () {
				yield* ensureFrameOpen();
				const frame = yield* snapshot;
				if (frame.transformDepth <= 0) {
					return yield* new GraphicsTransformStackUnderflowError({
						reason:
							"Cannot pop a graphics transform when no transform is active.",
					});
				}

				yield* appendCommand(stateRef, {
					type: "pop-transform",
				});
			});

			const drawImage = Effect.fn("Graphics.drawImage")(function* (
				imageId: string,
				position: CameraVector,
				size?: {
					readonly height: number;
					readonly width: number;
				},
			) {
				yield* ensureFrameOpen();
				yield* appendCommand(stateRef, {
					imageId,
					position,
					size,
					type: "draw-image",
				});
			});

			const drawRectangle = Effect.fn("Graphics.drawRectangle")(function* (
				position: CameraVector,
				size: {
					readonly height: number;
					readonly width: number;
				},
				mode: RectangleDrawMode = "fill",
				color: Color = white,
			) {
				yield* ensureFrameOpen();
				yield* appendCommand(stateRef, {
					color,
					mode,
					position,
					size,
					type: "draw-rectangle",
				});
			});

			const drawCircle = Effect.fn("Graphics.drawCircle")(function* (
				center: CameraVector,
				radius: number,
				mode: CircleDrawMode = "fill",
				color: Color = white,
			) {
				yield* ensureFrameOpen();
				yield* appendCommand(stateRef, {
					center,
					color,
					mode,
					radius,
					type: "draw-circle",
				});
			});

			const drawLine = Effect.fn("Graphics.drawLine")(function* (
				start: CameraVector,
				end: CameraVector,
				color: Color = white,
			) {
				yield* ensureFrameOpen();
				yield* appendCommand(stateRef, {
					color,
					end,
					start,
					type: "draw-line",
				});
			});

			const drawText = Effect.fn("Graphics.drawText")(function* (
				options: DrawTextOptions,
			) {
				yield* ensureFrameOpen();
				yield* appendCommand(stateRef, {
					align: options.align ?? "left",
					fontId: options.fontId,
					position: options.position,
					text: options.text,
					type: "draw-text",
				});
			});

			const drawFade = Effect.fn("Graphics.drawFade")(function* (
				opacity: number,
				color: Color = white,
			) {
				yield* ensureFrameOpen();
				yield* appendCommand(stateRef, {
					color,
					opacity,
					type: "draw-fade",
				});
			});

			const drawFlash = Effect.fn("Graphics.drawFlash")(function* (
				intensity: number,
				color: Color = white,
			) {
				yield* ensureFrameOpen();
				yield* appendCommand(stateRef, {
					color,
					intensity,
					type: "draw-flash",
				});
			});

			const endFrame = Effect.gen(function* () {
				yield* ensureFrameOpen();
				const frame = yield* snapshot;
				if (frame.transformDepth !== 0) {
					return yield* new GraphicsTransformStackUnderflowError({
						reason: "Graphics frame ended with an unbalanced transform stack.",
					});
				}

				const completedFrame: FrameSnapshot = {
					...frame,
					isOpen: false,
				};

				yield* Ref.update(stateRef, () => ({
					currentFrame: completedFrame,
					lastCompletedFrame: completedFrame,
				}));

				return completedFrame;
			});

			return Graphics.of({
				beginFrame,
				clear,
				drawCircle,
				drawFade,
				drawFlash,
				drawImage,
				drawLine,
				drawRectangle,
				drawText,
				endFrame,
				lastCompletedFrame: Ref.get(stateRef).pipe(
					Effect.map((state) => state.lastCompletedFrame),
				),
				popTransform,
				pushTransform,
				setBlendMode,
				setTint,
				snapshot,
			});
		}),
	);
}
