import type { YamlSource } from './yaml-document.js';

export const SPEC_EXTENSION = '.spec.yaml';

export const DOCUMENT_KEYS = ['description', 'fixture', 'env', 'serve', 'runs'] as const;

export const RUN_KEYS = [
    'command',
    'stdin',
    'timeout',
    'waitFor',
    'exit',
    'stdout',
    'stderr',
    'files',
] as const;

export const FILE_CONTENT_KEYS = ['contains', 'equals'] as const;

export const FILE_STATES = ['absent', 'exists'] as const;

/** Read by the parser and stated by the schema, so an editor refuses what the runner does. */
export type PresenceLaw =
    | {
          keys: readonly string[];
          law: 'apart';
          refusal: (subject: string, key: string) => string;
          with: string;
      }
    | {
          keys: readonly string[];
          law: 'each';
          refusal: (subject: string, key: string) => string;
      }
    | {
          keys: readonly string[];
          law: 'some';
          refusal: (subject: string) => string;
      };

export type PresenceShape = 'document' | 'files' | 'run';

export const PRESENCE: Readonly<Record<PresenceShape, readonly PresenceLaw[]>> = {
    document: [
        {
            keys: ['description'],
            law: 'each',
            refusal: () =>
                'missing "description:" — every document is one test, and this is its title',
        },
        {
            keys: ['runs'],
            law: 'each',
            refusal: () => 'missing "runs:" — description and runs are mandatory',
        },
    ],
    files: [
        {
            keys: FILE_CONTENT_KEYS,
            law: 'some',
            refusal: (path) => `files: ${path} asserts nothing — give it contains: or equals:`,
        },
    ],
    run: [
        {
            keys: ['command', 'exit'],
            law: 'each',
            refusal: (_subject, key) =>
                `a run is missing "${key}:" — command and exit are mandatory`,
        },
        {
            keys: ['waitFor'],
            law: 'apart',
            refusal: () =>
                'waitFor: and stdin: cannot share a run — the pattern is watched on a process nobody closed the input of',
            with: 'stdin',
        },
    ],
};

/** One `env:` entry: a bare word naming a registered set, or a `KEY=value` pair. */
export type SpecEnvToken =
    | { key: string; kind: 'pair'; line: number; value: string }
    | { kind: 'set'; line: number; name: string };

/** One `serve:` entry: a registered server plus the extra env it is started with. */
export type SpecServeEntry = {
    env: Record<string, string>;
    line: number;
    name: string;
};

/** One `fixture:` entry: a path with the line it was declared on. */
export type SpecFixture = {
    line: number;
    path: string;
};

/** An expected stream: its text, and the first line of that text in the file. */
export type SpecStream = {
    /** 1-based line the scalar's content starts on, where a token defect is reported. */
    line: number;
    text: string;
};

/** One `files:` assertion, keyed by a workdir-relative path. */
export type SpecFileAssertion =
    | {
          contains: SpecStream[];
          equals: null | SpecStream;
          kind: 'content';
          line: number;
          path: string;
      }
    | { kind: 'absent'; line: number; path: string }
    | { kind: 'exists'; line: number; path: string };

/** One run: a command, what it must exit with, and what it must have produced. */
export type SpecRun = {
    command: string;
    /** 1-based line of the `command:` key, the frame a failure points at. */
    commandLine: number;
    exitCode: number;
    files: SpecFileAssertion[];
    /** `null` when the key is absent, which asserts an empty stream. */
    stderr: null | SpecStream;
    /** Written to the child then closed; `null` keeps the empty-pipe EOF. */
    stdin: null | string;
    stdout: null | SpecStream;
    timeout: null | number;
    /** Only on the last run: a long-running command ends the session. */
    waitFor: null | string;
};

/** A parsed `<case>.spec.yaml`. */
export type SpecDocument = {
    /** The vitest test title. */
    description: string;
    /** 1-based line of the `description:` key. */
    descriptionLine: number;
    env: SpecEnvToken[];
    fixtures: SpecFixture[];
    runs: SpecRun[];
    serve: SpecServeEntry[];
};

export type SpecFile = {
    document: SpecDocument;
    source: YamlSource;
};

export type SpecRunUpdate = {
    exitCode: number;
    stderr: string;
    stdout: string;
};

export class SpecSyntaxError extends Error {
    readonly line: number;
    readonly reason: string;

    constructor(fileName: string, line: number, message: string) {
        super(`${fileName}:${line}: ${message}`);
        this.line = line;
        this.reason = message;
        this.name = 'SpecSyntaxError';
    }
}
