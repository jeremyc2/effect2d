# Consider `Effect.acquireDisposable` for disposable resource lifecycles

Effect `4.0.0-beta.63` added `Effect.acquireDisposable`, now available through the dependency update to `4.0.0-beta.64`.

This may fit Effect2d subsystems that acquire platform resources with explicit disposal, such as audio contexts, windows, canvases, render surfaces, or telemetry exporters. A small follow-up could compare current `Scope.addFinalizer` / acquire-release patterns with `Effect.acquireDisposable` and adopt it where it makes lifecycle code clearer without hiding important cleanup behavior.

Source: https://github.com/Effect-TS/effect-smol/releases/tag/effect%404.0.0-beta.63
