---
name: update-dependencies
description: Update dependencies.
---

## Workflow

1. Run `bun chore:update`.
2. Review resulting dependency version changes and look up migration guides or changelogs for the updates that were made. Prefer primary sources: official docs, official release notes, package repositories, and package metadata.
3. If an update adds a useful new feature that this repository should consider adopting, create a short local issue note under `issues/` explaining the feature and why it may serve the project well.

## Tips

- If Biome reports a schema mismatch, recommend `bun --bun biome migrate --write` or updating the schema URL, then rerunning `bun all`.
