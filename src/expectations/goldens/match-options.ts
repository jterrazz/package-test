import type {
    DiskDirectory as DiskDirectoryType,
    DiskFile as DiskFileType,
} from '../../disk/spec-path.js';
import type { ContainerAccessor as ContainerAccessorType } from '../command/container.js';
import type { DirectoryAccessor as DirectoryAccessorType } from '../disk/directory.js';
import type { FilesystemAccessor as FilesystemAccessorType } from '../disk/filesystem.js';
import type { ResponseAccessor as ResponseAccessorType } from '../http/response.js';
import type { TableAccessor as TableAccessorType } from '../table/table.js';
import type { JsonAccessor as JsonAccessorType } from '../text/json.js';
import type { TextAccessor as TextAccessorType } from '../text/text.js';

/** The per-call option both `toMatch` builds honour, and the matchers vitest's `Assertion` gains. */

/** `frozen` opts one fixture out of update-mode rewriting: a deliberately-wrong fixture survives update runs. */
export type MatchFixtureOptions = {
    frozen?: boolean;
};

/** A table has no order of its own: rows compare as a multiset unless `ordered`. */
export type TableMatchOptions = MatchFixtureOptions & {
    ordered?: boolean;
};

type TableRows = readonly (readonly unknown[])[];

type JsonExpectation =
    | boolean
    | DiskFileType
    | null
    | number
    | Readonly<Record<string, unknown>>
    | readonly unknown[]
    | string;

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

/** Structural: the augmentation loads twice (src and dist), and CaptureScope's private state makes the two classes nominally distinct. */
type StreamMarker = { readonly raw: string; readonly streamName: string };

/** The refusal sits on `this`, since the augmented `toMatch` must stay assignable to vitest's own. */
type StreamIsNoValue = { readonly 'a stream is compared whole, or as its .text': never };

type ResultSubject =
    | ContainerAccessorType
    | DirectoryAccessorType
    | FilesystemAccessorType
    | JsonAccessorType
    | ResponseAccessorType
    | TableAccessorType;

type SubjectIsNoValue = { readonly 'a result accessor is compared whole': never };

declare module 'vitest' {
    // outside: one interface carries every matcher: split across two, a doubly-resolved `vitest` picks up one and not the other. The type parameters repeat vitest's character for character (TS2428).
    interface Assertion<R extends Promise<void> | void = void, T = unknown> {
        /** Assert the table holds zero rows (async: queries the database). */
        toBeEmpty: T extends TableAccessorType ? () => Promise<void> : never;
        /** A stream is refused here: vitest would read it as an empty list, and `.not.toContain` would pass. */
        toContain: T extends StreamMarker ? never : (item: unknown) => R;
        /** Assert the container is running. Async — docker-backed subject. */
        toBeRunning: T extends ContainerAccessorType ? () => Promise<void> : never;
        /** On a string, vitest's `toMatch`; on a framework result, the whole result against its value in place or its `file()`/`directory()` golden. */
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
