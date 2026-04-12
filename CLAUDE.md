# Flexboard — Claude Code Guidelines

## Pre-commit checklist

Run through this before every `git commit`:

1. **TypeScript** — `pnpm --filter @flexboard/frontend exec tsc --noEmit` must exit 0
2. **No secrets** — never stage `.env`, `.env.local`, or any file containing credentials or tokens
3. **Staged files** — always add specific files by name; never use `git add -A` or `git add .`
4. **Commit message** — Conventional Commits format: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `style:`, `perf:`
5. **Changelog** — every user-visible change gets an entry in `CHANGELOG.md` under `[Unreleased]`
6. **Planning** — if a planned task is completed or a new feature is introduced, update `docs/planning.md`
7. **Mobile** — for any UI change: check that the layout holds at narrow widths, touch targets are ≥ 44 × 44 px, and toolbar items don't overflow on iPhone-sized screens
8. **Push** — push immediately after committing unless the user says otherwise

## Pre-release checklist

Run through this before creating a release:

1. **Version decision** — agree on the next version number with the user (patch / minor / major based on the [Unreleased] content)
2. **Unreleased content** — confirm `CHANGELOG.md` has at least one entry under `[Unreleased]`; if it is empty, there is nothing to release
3. **All commits pushed** — `git status` clean, `git push` up to date
4. **TypeScript** — `pnpm --filter @flexboard/frontend exec tsc --noEmit` exits 0
5. **Bump versions** — set the new version in both `apps/frontend/package.json` and `apps/backend/package.json`
6. **CHANGELOG** — replace `## [Unreleased]` with `## [Unreleased]\n\n## [X.Y.Z] - YYYY-MM-DD` and move the entries; keep an empty `[Unreleased]` section at the top
7. **Planning** — update the `Last updated` line in `docs/planning.md` to reference the new version
8. **Release commit** — `git commit -m "release: vX.Y.Z"` (stage the three files above)
9. **Tag** — `git tag vX.Y.Z`
10. **Push** — `git push && git push origin vX.Y.Z` (CI will build and publish Docker images automatically)
