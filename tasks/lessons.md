# Lessons

- **Agent worktrees: never commit the `node_modules` symlink.** An agent's worktree symlinks `node_modules` to the main repo's; if it is committed and merged, git replaces the real directory with a self-referencing symlink and deletes the dependencies (recovered with `rm node_modules && git rm --cached node_modules && npm ci`). Brief agents to stage by explicit path (`git add <paths>`), never `git add -A`. `.gitignore` now has `node_modules` (no trailing slash, so symlinks match).
- **Union-resolving array-entry conflicts line by line mangles objects.** For lib/pages.ts, rebuild the array programmatically instead of keeping both sides of conflict markers.
- **Spurious `WasmHash ... reading 'length'` webpack error** = stale `.next`; `rm -rf .next` and rebuild.
- **next/og can't fetch fonts offline** — avoid non-ASCII glyphs (★) in OG/icon images; draw shapes.
- **Page-level `openGraph` replaces the file-convention OG image** — set `images` explicitly in `pageMetadata`.
- **Jest ignore patterns must be `<rootDir>`-anchored**, or tests vanish when run from `.claude/worktrees/*`.
