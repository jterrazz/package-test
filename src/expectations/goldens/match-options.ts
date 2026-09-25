import type {
    DiskDirectory as DiskDirectoryType,
    DiskFile as DiskFileType,
} from '../../kernel/files/spec-path.js';
import type { ContainerAccessor as ContainerAccessorType } from '../command/container.js';
import type { DirectoryAccessor as DirectoryAccessorType } from '../disk/directory.js';
import type { FilesystemAccessor as FilesystemAccessorType } from '../disk/filesystem.js';
import type { ResponseAccessor as ResponseAccessorType } from '../http/response.js';
import type { TableAccessor as TableAccessorType } from '../table/table.js';
import type { JsonAccessor as JsonAccessorType } from '../text/json.js';
import type { TextAccessor as TextAccessorType } from '../text/text.js';

/**
 * The per-call option both `toMatch` implementations honour, and the matcher
 * types vitest's `Assertion` gains.
 *
 * A golden is read from disk under node and through a server command from
 * inside a page, and BOTH builds must answer `{ frozen: true }` the same way —
 * so the option is declared here, where the node matchers and the page's
 * matchers can each reach it. The `declare module 'vitest'` augmentation sits
 * beside it: both entries publish `MatchFixtureOptions`, so the one `types`
 * entry carries the matchers too.
 */

/**
 * Per-call options for the fixture-file `toMatch` subjects. `frozen` opts a
 * single fixture OUT of update-mode rewriting: a frozen fixture is NEVER
 * written under `TEST_UPDATE=1` (or vitest `-u`) — in update mode a frozen
 * mismatch still throws its diff, and a frozen missing fixture still throws its
 * "does not exist" error. This is what makes a DELIBERATELY-WRONG fixture (the
 * subject of a negative test that asserts the mismatch/error rendering)
 * survivable across update runs instead of being silently overwritten with the
 * actual output.
 */
export type MatchFixtureOptions = {
    frozen?: boolean;
};

/**
 * The options a table's `toMatch(rows)` takes besides `frozen`. A table has
 * no order of its own, so its rows compare as a multiset; `ordered` makes the
 * order — the order of the table's first column — part of the claim.
 */
export type TableMatchOptions = MatchFixtureOptions & {
    ordered?: boolean;
};

/** A table's rows as a test writes them in place: one array of cells per row, every column — or `''`, nothing recorded yet. */
type TableRows = readonly (readonly unknown[])[];

/**
 * What a json is compared to in place: a JSON value — tokens in its strings,
 * `match.*` in its leaves — or its golden. A RegExp is none of them.
 */
type JsonExpectation =
    | boolean
    | DiskFileType
    | null
    | number
    | Readonly<Record<string, unknown>>
    | readonly unknown[]
    | string;

/**
 * The whole-result half of `toMatch`, by subject: the value written in place,
 * or the golden a `file()`/`directory()` names. A stream and a response take
 * their text (a response's is its `.http` text), a json its value, a table its
 * rows (async: the table is queried), a working directory or one of its
 * directories its `directory()` golden (async: the tree is compared on disk).
 * A text captured INSIDE a page is awaited: its golden crosses the browser
 * seam, and so does the rewrite update mode makes. Any other subject has no
 * whole-result half, and `toMatch` is vitest's alone.
 */
type WholeMatch<T, R> = T extends { readonly capturedInPage: true }
    ? (expected: DiskFileType | string, options?: MatchFixtureOptions) => Promise<void>
    : T extends TextAccessorType
      ? (expected: DiskFileType | string, options?: MatchFixtureOptions) => R
      : T extends ResponseAccessorType
        ? (expected: DiskFileType | string, options?: MatchFixtureOptions) => R
        : T extends JsonAccessorType
          ? (expected: JsonExpectation, options?: MatchFixtureOptions) => R
          : T extends TableAccessorType
            ? (expected: '' | TableRows, options?: TableMatchOptions) => Promise<void>
            : T extends DirectoryAccessorType | FilesystemAccessorType
              ? (golden: DiskDirectoryType, options?: MatchFixtureOptions) => Promise<void>
              : unknown;

/**
 * A stream accessor, structurally: the augmentation is loaded twice (src and
 * the bundled dist), and CaptureScope's private state makes the two class
 * copies nominally distinct.
 */
type StreamMarker = { readonly raw: string; readonly streamName: string };

/**
 * What vitest's own `toMatch` needs `this` to be on a stream subject — which
 * no assertion is, so vitest's half does not apply and the whole-result half
 * alone answers. The refusal sits on `this` rather than on the argument
 * because the augmented `toMatch` must stay assignable to vitest's own, which
 * takes a string or a RegExp from any subject.
 */
type StreamIsNoValue = { readonly 'a stream is compared whole, or as its .text': never };

/** Every other result accessor: none is a string, so vitest's substring meaning never applies. */
type ResultSubject =
    | ContainerAccessorType
    | DirectoryAccessorType
    | FilesystemAccessorType
    | JsonAccessorType
    | ResponseAccessorType
    | TableAccessorType;

/**
 * What vitest's own `toMatch` needs `this` to be on any other result accessor:
 * a result is compared whole — to a value in place, to its golden — and a
 * container is asserted running, so vitest's half never applies.
 */
type SubjectIsNoValue = { readonly 'a result accessor is compared whole': never };

// ── Vitest matcher type augmentation (CONVENTIONS D1–D3) ──
// Declared beside the options it takes, which both entries publish — so the
// ONE published `types` entry carries it.

declare module 'vitest' {
    // ONE interface carries every matcher, and it is `Assertion`: a setup
    // that resolves `vitest`'s types twice (a nested or duplicated install, a
    // `file:` link) picks up one augmentation and not the other when the
    // matchers are split across two interfaces — a failure that reads as a
    // regression in the package rather than as a resolution problem. Declared
    // together, they are present together or absent together.
    //
    // `toMatch` keeps vitest's own signature — a string or a RegExp is a
    // value — and gains the golden half where the subject has one.
    //
    // The two type parameters are vitest's own, repeated CHARACTER for
    // character: an augmentation whose parameter list differs from the
    // declaration it merges into is refused outright (TS2428), so this line
    // tracks the runner's — `R` is the return shape a promisified assertion
    // threads through, `T` the received value every branch below keys on.
    // A sync golden returns `R`; every async matcher states `Promise<void>`,
    // because a golden read across the browser seam is async where the
    // identical node accessor is sync, and the chai chain cannot infer that.
    // oxlint-disable-next-line typescript/consistent-type-definitions -- a module augmentation MERGES only as an interface: a type alias redeclares the name and every matcher is lost
    interface Assertion<R extends Promise<void> | void = void, T = unknown> {
        /**
         * Assert the table holds zero rows. Async — queries the database. A
         * stream is not a table: an empty one is `expect(result.stderr.text).toBe('')`.
         */
        toBeEmpty: T extends TableAccessorType ? () => Promise<void> : never;
        /**
         * Vitest's `toContain`. A stream is not a string: it is compared as
         * `result.stdout.text`, and handed whole it is refused here — vitest
         * would read it as an empty list, and `.not.toContain` would pass.
         */
        toContain: T extends StreamMarker ? never : (item: unknown) => R;
        /** Assert the container is running. Async — docker-backed subject. */
        toBeRunning: T extends ContainerAccessorType ? () => Promise<void> : never;
        /**
         * On a plain string, vitest's `toMatch` (a string or a RegExp is a
         * value — `result.stdout.text` is one). On a result the framework
         * produced, the WHOLE result against its expectation: the value
         * written in place — a stream's text, a response's `.http` text, a
         * json's value, a table's rows (`await`ed), tokens allowed in each —
         * or `file()`/`directory()` when the expectation lives on disk
         * (`toMatch(file('./expected/help.txt'))`, the extension part of the
         * path; `await expect(result.directory('out')).toMatch(directory('./expected/out/'))`).
         *
         * Pass `{ frozen: true }` to opt a single expectation OUT of update-mode
         * rewriting: a frozen one is never overwritten under `TEST_UPDATE=1`
         * (or vitest `-u`), and a frozen mismatch still throws. Use it for a
         * deliberately-wrong expectation whose diff is the behaviour under test.
         */
        toMatch: ((
            this: T extends StreamMarker
                ? StreamIsNoValue
                : T extends ResultSubject
                  ? SubjectIsNoValue
                  : unknown,
            expected: RegExp | string,
        ) => R) &
            WholeMatch<T, R>;
    }
}
