import type { Dirent } from 'node:fs';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { GROUND_EXPECTED, GROUND_FIXTURES } from '../specification/facets/_common/ground.js';
import type { TokenViolation } from './checker.js';

/**
 * The GOLDEN passes — what a file under `_expected/` says, read against what
 * pins it.
 *
 * A golden is the one place a spec states an answer in full, and two shapes
 * make that statement empty. A literal nothing in the leaf produced (a uuid the
 * run minted, an instant the clock read) passes only until the next run: it is
 * either a token or it is seeded, and D21w says which of the two is missing. A
 * golden that is nothing BUT `{{any}}` asserts that the subject produced
 * something — the file exists, the diff is silent, and every change to what it
 * covers is invisible.
 *
 * Both are warnings: each has a legitimate reading (a literal a stub mints
 * deterministically, a golden deliberately held open while a shape settles),
 * and each of those is a line the author states rather than a build the pass
 * stops.
 */

/** A value no run repeats — the two shapes a leaf has to pin. */
const VOLATILE = [
    {
        kind: 'uuid',
        pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/giu,
    },
    { kind: 'iso8601', pattern: /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/gu },
] as const;

/** A golden that asserts existence and nothing else. */
const EMPTY_GOLDEN = '{{any}}';

/**
 * Directories no golden walk enters.
 *
 * The `$FIXTURES` pool is verbatim material, never a golden of a live spec —
 * pruned here as it is in every other pass. `pinningTextOf` still reads it: it
 * walks the pool from its own root, which is not an entry of this walk.
 */
const SKIPPED = new Set(['.git', 'dist', GROUND_FIXTURES, 'node_modules']);

/** `readdirSync` that answers `[]` for anything it cannot read. */
function entriesOf(dir: string): Dirent[] {
    try {
        return readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
}

/**
 * Read a file as text, or `null` when it is missing or binary.
 *
 * The binary tell is a zero byte, read off the BUFFER: a golden may be a
 * screenshot or an archive, and decoding one as UTF-8 first would hand the
 * scanner a page of replacement characters to hunt uuids in.
 */
function textOf(path: string): null | string {
    try {
        const buffer = readFileSync(path);
        return buffer.includes(0) ? null : buffer.toString('utf8');
    } catch {
        return null;
    }
}

/**
 * Every file under `dir`, depth-first.
 *
 * @yields each file path.
 */
function* walkFiles(dir: string): Generator<string> {
    for (const entry of entriesOf(dir)) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!SKIPPED.has(entry.name)) {
                yield* walkFiles(path);
            }
            continue;
        }
        yield path;
    }
}

/**
 * Every `_expected/` directory under a specs root.
 *
 * @yields each golden root.
 */
function* expectedRoots(dir: string): Generator<string> {
    for (const entry of entriesOf(dir)) {
        if (!entry.isDirectory() || SKIPPED.has(entry.name)) {
            continue;
        }
        const path = join(dir, entry.name);
        if (entry.name === GROUND_EXPECTED) {
            yield path;
            continue;
        }
        yield* expectedRoots(path);
    }
}

/**
 * Everything the leaf holding this golden says — its specs, its other ground,
 * and the shared pool — as one text.
 *
 * A literal is PINNED when something else in the leaf puts it there: a seed
 * row, a request body, a fixture file, the spec's own arguments, or a `#ref`
 * capture named in the same tree. The pass asks that question once per leaf.
 */
function pinningTextOf(leaf: string, specsRoot: string): string {
    const parts: string[] = [];
    for (const file of walkFiles(leaf)) {
        if (file.includes(`/${GROUND_EXPECTED}/`)) {
            continue;
        }
        parts.push(textOf(file) ?? '');
    }
    for (const file of walkFiles(join(specsRoot, GROUND_FIXTURES))) {
        parts.push(textOf(file) ?? '');
    }
    return parts.join('\n');
}

/** The 1-based line an offset sits on. */
function lineAt(text: string, index: number): number {
    return text.slice(0, index).split('\n').length;
}

/**
 * D21w — a volatile literal in a golden that nothing in its leaf pins.
 *
 * The literal came from a run: the next one mints another, and the golden that
 * passed today fails tomorrow for a reason that has nothing to do with the
 * subject. Token it (`{{uuid}}`, `{{iso8601}}`) or seed the value, so the leaf
 * itself is what puts it there.
 */
export function checkExpectedPinnedValue(specsRoot: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    for (const expected of expectedRoots(specsRoot)) {
        const pinning = pinningTextOf(dirname(expected), specsRoot);
        for (const file of walkFiles(expected)) {
            const text = textOf(file);
            if (text !== null) {
                violations.push(...unpinnedIn(text, relative(specsRoot, file), pinning));
            }
        }
    }
    return violations;
}

/** Every volatile literal of one golden that its leaf does not put there. */
function unpinnedIn(text: string, rel: string, pinning: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    for (const { kind, pattern } of VOLATILE) {
        for (const match of text.matchAll(pattern)) {
            const literal = match[0];
            // An instant is PINNED whichever precision the two sides write it
            // At: a spec states `…:00Z`, the golden carries the milliseconds
            // The serializer added.
            const plain = literal.replace(/\.\d+Z$/u, 'Z');
            if (pinning.includes(literal) || pinning.includes(plain)) {
                continue;
            }
            const line = lineAt(text, match.index);
            violations.push({
                file: rel,
                line,
                message: `${rel}:${line}: \`${literal}\` is pinned by nothing in this leaf or the pool — token it with a {{${kind}}} or seed it (D21 — see docs/13-linting.md)`,
                rule: 'd21w-expected-pinned-value',
                severity: 'warn',
                token: literal,
            });
        }
    }
    return violations;
}

/**
 * D22w — a golden whose whole content is `{{any}}`.
 *
 * It states that the subject produced something. The file exists, the diff is
 * silent, and every change to what it covers goes unseen — which is the one
 * thing a golden was there to stop.
 */
export function checkEmptyGolden(specsRoot: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    for (const expected of expectedRoots(specsRoot)) {
        for (const file of walkFiles(expected)) {
            const text = textOf(file);
            if (text === null || text.trim() !== EMPTY_GOLDEN) {
                continue;
            }
            const rel = relative(specsRoot, file);
            violations.push({
                file: rel,
                line: 1,
                message: `${rel}:1: a golden of \`${EMPTY_GOLDEN}\` asserts nothing — regenerate with \`TEST_UPDATE=1\` and keep tokens for the parts that move (D22 — see docs/13-linting.md)`,
                rule: 'd22w-empty-golden',
                severity: 'warn',
            });
        }
    }
    return violations;
}
