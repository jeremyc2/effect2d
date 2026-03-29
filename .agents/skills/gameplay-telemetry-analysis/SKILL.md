---
name: gameplay-telemetry-analysis
description: Analyze one finished Effect2d gameplay telemetry session by correlating player commentary with session.json, OTEL logs, metrics, and traces. Use when a user has already played a game, stored telemetry on disk, and wants a post-run analysis of friction, bugs, pacing, performance, or commentary-linked gameplay issues.
---

Read the finished session directory first:

- `session.json`
- `commentary.ndjson`
- `otel-logs.ndjson`
- `otel-metrics.ndjson`
- `otel-traces.ndjson`

Treat commentary as first-class evidence. Use telemetry to confirm, refine, or challenge what the player noticed.

Produce:

1. Session summary
   Short timeline, main gameplay beats, main anomalies.
2. Commentary response
   For each commentary entry: restate it, correlate it with telemetry or say no strong match exists, explain the most likely cause, suggest next inspection steps.
3. Findings
   Order by signal. Include evidence, likely cause, confidence, next step.
4. Performance and reliability notes
   Call out spikes, repeated failures, suspicious retries, noisy logs, missing transitions, odd metric patterns.
5. Suggested follow-up
   Point to exact files, services, scenes, gameplay flows, or targeted experiments.

Use exact timestamps, metric names, span names, log messages, and file paths when they help. Rank multiple plausible explanations. Prefer concrete findings over generic engine advice.
