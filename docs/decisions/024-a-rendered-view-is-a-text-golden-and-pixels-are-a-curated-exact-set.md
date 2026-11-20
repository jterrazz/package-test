# ADR-024: A rendered view is a text golden; pixels are a curated, exact set

**Status:** Accepted
**Date:** 2026-11-20

## Context

The standard had no image golden at all. It named a binary file only as a reason a golden stays a file, and a screenshot only as failure evidence, so the format, the size, the compare and the storage of a pixel golden were nobody's. The repositories that drew a native interface kept their own: the station's menu bar, in `jterrazz/spwn`, held 393 PNGs and 70.2 MB at its head on 2026-11-19, and its clone carried 581.7 MiB of pack, 507.6 MiB of it old versions of those images. Every change to the chrome or the renderer rewrote about 400 of them.

Its compare was not exact either: a tolerance of 16 levels per channel and 0.1 % of the pixels, under which two different stories passed for each other, and a two-pixel move of a chevron changed 109 pixels, below the 718 the threshold let through. The owner had ruled on 2026-11-15 that goldens stay exact.

What the images proved splits in two. Most of a frame is structure a text can state exactly: which elements, their words, their frames, their tokens, their states. What only pixels prove is paint: compositing, shadows, glyph rasters, symbols, curves, gradients. The study measured a curated set keeping only the second at 2.52 MB, its largest image 172420 bytes after a crop and a lossless re-encode.

The owner answered the study's ten questions on 2026-11-20, in the orchestrating session: yes to the text golden replacing the story images, to an overlay as a base and a delta, to a cap of 192 KB per image (64 KB once the kit's sheets draw on flat swatches) and 3 MB per repository held down by a ratchet, to the goldens of every language living in `__expected__/`, and PNG rather than lossless WebP for the curated set.

## Decision

- **A rendered view is asserted by a text golden first, the view golden**: `<subject>[.<variant>].view.yaml` in `__expected__/` beside its test, the ARIA outline with each line's frame, type role, paint tokens and states. Its grammar is a strict superset of the `.aria.yaml` dialect, so one reader reads both, and its accessor is `result.view`, beside `result.tree`, which is `result.view` with the bracketed geometry and paint dropped. The grammar and its seven rules are [Component specs § The view golden](../guides/component-specs.md#the-view-golden-the-outline-with-its-geometry-and-its-paint)'s: every drawn element is a line, paint is a token name and never a sampled value, frames are local to their parent, text is its words and how they wrapped, states are words, the file is compared whole by exact string equality and written by the update mode, and an overlay is its base plus `changes:` plus `added:`, composed into the whole tree before the compare.
- **Pixels remain for what text cannot see**, and an image earns its place by proving one paint recipe that no view golden can state and no other kept pixel golden proves, named in its test. A state of the product never earns one for being a state.
- **A pixel golden is exact and byte-stable**: compared byte for byte on its decoded 8-bit RGBA, drawn at 2x by one pinned reference renderer it names, cropped to its subject and its shadow, written as a PNG by one pinned lossless encoder with every metadata chunk stripped, and rewritten only when its decoded pixels differ. It is named `<subject>.<scheme>[.<contrast>|.<transparency>].png`, beside its `.view.yaml`. PNG and not lossless WebP, by the owner's answer: one universal format every renderer's kit already writes, for a saving of about 1 MB, once.
- **Storage is plain git**: no LFS, which would spend the owner's bandwidth on every public clone and add a tool to every host, and no external baseline service, which would take the proof out of the checkout.
- **The weight is the package's to enforce**, by the checker rule `pixel-golden-within-budget`: every `*.png` under an `__expected__/` of the repository, judged by the run over the project root; 192000 bytes per image and 3000000 in all by default, which a project's `test: { pixels: { cap, budget } }` sets lower and never higher. The total is held down by the existing ratchet rather than a second one: `typescript baseline` records it as `.studio/baseline.json › test › pixel-goldens/bytes`, a tree above the entry is a growth only the recording gesture accepts, and a tree below it is a slack `typescript fix` lowers.

How the numbers read where the study left them open:

- A KB is 1000 bytes and an MB 10^6, the units the study measured in, so the cap is 192000 bytes and the budget 3000000.
- The budget is the repository's, as the study measured it: the run over the project root sums every member's images, and a member's own run judges none. A workspace whose root lists no `test()` preset, its members listing their own, is out of the rule's reach.
- The 64 KB cap waits for the kit's flat swatches: it is a later lowering of the default, or a repository's own `cap`, never this record's.
- A PNG under a `__fixtures__/` tree is verbatim material, and is not judged, as every pass of the checker skips it.
- "Beside its test" in a Swift repository is the test target's folder: a SwiftPM test target is a tests folder, and its `__expected__/` sits directly in it (`tests/<target>/__expected__/`), as the owner ruled on 2026-11-20. The rule here judges the PNGs there like any.

What this record specifies that no code of this package implements:

- No recorder writes a view golden here: neither the component nor the website specification records `result.view`, and their results offer `result.tree` alone. The first recorder is the Swift one, in the station's kit; one written here later follows this grammar.
- No pixel comparer, renderer pin or lossless encoder ships here: those rows are what a renderer's kit owes, and its own repository proves them.
- The names that let `__expected__/` sit in a Swift test target are not this package's: the toolchain's Names (tree) pass refuses any ground folder of a code root outside a `__tests__/` (`names/directory-in-kebab-case`), so the location waits on a release of `@jterrazz/typescript` that admits it.

## Consequences

- The station's menu bar trades 393 tolerant images for about 70 exact ones and a view golden per story, about 3.3 MB at its head instead of 70.2 MB; its migration and a one-time rewrite of its history are its own lots, in its own repository, and the repository holding 75 design baselines (5.1 MB) adopts the same rule in a lot of its own.
- A token edit or a padding change reads as a few lines of text diff, and a compositing bug that shows in one state and in no kept witness goes unseen: the one real loss, accepted with the recipe rule as its guard.
- A repository past the budget on the day it adopts the rule holds the finding as debt, like any finding of the checker, while its bytes are still held down by the recorded entry.
- The green line of the ratchet sums the recorded bytes with the counts of findings, so a project holding the entry reads its bytes in the `held` total: the toolchain's line knows no measured key.
- A repository in another language runs the rule through the same checker, once its root carries a `package.json` and a `studio.config.ts` listing `test()`.
