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
