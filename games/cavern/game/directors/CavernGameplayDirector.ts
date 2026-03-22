import { Effect, Layer, ServiceMap } from "effect";
import {
	Audio,
	EngineLogger,
	Input,
	type InvalidLogMessageError,
	SceneDirector,
	type SceneNotFoundError,
	type SceneStackEmptyError,
	type UnknownAudioCueError,
	type UnknownInputActionError,
	type WrongAudioCueKindError,
} from "../../../../src/index.ts";
import { cavernMenuButtons, cavernWorldBounds } from "../content/CavernMenu.ts";
import { CavernMenuState } from "../state/CavernMenuState.ts";
import { CavernPlayerState } from "../state/CavernPlayerState.ts";

const movementStep = 10;
const playerSize = {
	height: 192,
	width: 80,
} as const;

const clamp = (value: number, minimum: number, maximum: number): number =>
	Math.max(minimum, Math.min(maximum, value));

const isPointInsideButton = (
	x: number,
	y: number,
	button: (typeof cavernMenuButtons)[number],
): boolean =>
	x >= button.x &&
	x <= button.x + button.width &&
	y >= button.y &&
	y <= button.y + button.height;

type CavernGameplayDirectorFailure =
	| InvalidLogMessageError
	| SceneNotFoundError
	| SceneStackEmptyError
	| UnknownAudioCueError
	| UnknownInputActionError
	| WrongAudioCueKindError;

export class CavernGameplayDirector extends ServiceMap.Service<
	CavernGameplayDirector,
	{
		readonly stepFrame: () => Effect.Effect<
			void,
			CavernGameplayDirectorFailure
		>;
	}
>()("effect2d/games/cavern/game/directors/CavernGameplayDirector") {
	static readonly layer = Layer.effect(
		CavernGameplayDirector,
		Effect.gen(function* () {
			const audio = yield* Audio;
			const cavernMenuState = yield* CavernMenuState;
			const cavernPlayerState = yield* CavernPlayerState;
			const engineLogger = yield* EngineLogger;
			const input = yield* Input;
			const sceneDirector = yield* SceneDirector;

			const activateMenuButton = Effect.fn(
				"CavernGameplayDirector.activateMenuButton",
			)(function* (index: number) {
				const button = cavernMenuButtons[index];
				if (button === undefined) {
					return;
				}

				yield* audio.playSfx("menu-click");

				switch (button.id) {
					case "new-game":
					case "continue":
						yield* sceneDirector.switchTo("overworld");
						yield* engineLogger.info("Cavern menu advanced to overworld.", {
							action: button.id,
						});
						return;
					case "sound": {
						yield* cavernMenuState.toggleSound;
						const menuSnapshot = yield* cavernMenuState.snapshot;
						if (menuSnapshot.soundOn) {
							yield* audio.playMusic("cavern-menu", { loop: true });
						} else {
							yield* audio.stopMusic;
						}
						return;
					}
					case "github":
						yield* engineLogger.info(
							"Cavern GitHub button selected in native port.",
							{
								note: "System URL opening is not implemented in the engine yet.",
							},
						);
				}
			});

			const updateMenuSelection = Effect.fn(
				"CavernGameplayDirector.updateMenuSelection",
			)(function* () {
				const pointer = yield* input.pointerPosition;
				const hoveredIndex = cavernMenuButtons.findIndex((button) =>
					isPointInsideButton(pointer.x, pointer.y, button),
				);
				const menuSnapshot = yield* cavernMenuState.snapshot;
				const nextHoveredIndex = hoveredIndex >= 0 ? hoveredIndex : null;

				yield* cavernMenuState.setHoveredIndex(nextHoveredIndex);

				if (
					nextHoveredIndex !== null &&
					nextHoveredIndex !== menuSnapshot.selectedIndex
				) {
					yield* cavernMenuState.setSelectedIndex(nextHoveredIndex);
				}

				const menuUp = yield* input.actionState("menu-up");
				const menuDown = yield* input.actionState("menu-down");
				if (menuUp.justPressed) {
					yield* cavernMenuState.setSelectedIndex(
						(menuSnapshot.selectedIndex + cavernMenuButtons.length - 1) %
							cavernMenuButtons.length,
					);
				}
				if (menuDown.justPressed) {
					yield* cavernMenuState.setSelectedIndex(
						(menuSnapshot.selectedIndex + 1) % cavernMenuButtons.length,
					);
				}

				const menuConfirm = yield* input.actionState("menu-confirm");
				const menuClick = yield* input.actionState("menu-click");
				if (menuConfirm.justPressed || menuClick.justPressed) {
					const currentMenuSnapshot = yield* cavernMenuState.snapshot;
					yield* activateMenuButton(currentMenuSnapshot.selectedIndex);
				}
			});

			const updateOverworld = Effect.fn(
				"CavernGameplayDirector.updateOverworld",
			)(function* () {
				const cancel = yield* input.actionState("menu-cancel");
				if (cancel.justPressed) {
					yield* sceneDirector.switchTo("main-menu");
					return;
				}

				const playerSnapshot = yield* cavernPlayerState.snapshot;
				let nextX = playerSnapshot.position.x;
				let nextY = playerSnapshot.position.y;

				if ((yield* input.actionState("move-left")).isPressed) {
					nextX -= movementStep;
				}
				if ((yield* input.actionState("move-right")).isPressed) {
					nextX += movementStep;
				}
				if ((yield* input.actionState("move-up")).isPressed) {
					nextY -= movementStep;
				}
				if ((yield* input.actionState("move-down")).isPressed) {
					nextY += movementStep;
				}

				yield* cavernPlayerState.moveTo({
					x: clamp(
						nextX,
						cavernWorldBounds.x,
						cavernWorldBounds.x + cavernWorldBounds.width - playerSize.width,
					),
					y: clamp(
						nextY,
						cavernWorldBounds.y,
						cavernWorldBounds.y + cavernWorldBounds.height - playerSize.height,
					),
				});
			});

			const stepFrame = Effect.fn("CavernGameplayDirector.stepFrame")(
				function* () {
					const activeSceneId = (yield* sceneDirector.snapshot).activeSceneId;
					if (activeSceneId === "main-menu") {
						yield* updateMenuSelection();
						return;
					}

					yield* updateOverworld();
				},
			);

			return CavernGameplayDirector.of({
				stepFrame,
			});
		}),
	);
}
