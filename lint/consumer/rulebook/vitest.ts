import type { OxlintConfig } from '@jterrazz/typescript/oxlint';

type Override = NonNullable<OxlintConfig['overrides']>[number];

const TEST_GLOBS = ['**/*.{test,spec,test-d,spec-d}.{ts,tsx,js,jsx}', '**/specs/**/*.{ts,tsx}'];

/** `no-vitest-snapshot` — every snapshot matcher points back at `toMatch(file('./__expected__/<name>.<ext>'))`. */
const SNAPSHOT_MATCHERS: Record<string, string> = {
    toMatchAriaSnapshot:
        "The ARIA tree is a golden: `expect(result.tree).toMatch(file('./__expected__/<case>.aria.yaml'))`.",
    toMatchFileSnapshot:
        "Name the file yourself: `expect(subject).toMatch(file('./__expected__/<case>.<ext>'))`.",
    toMatchInlineSnapshot:
        "An inline snapshot is the run judging itself: `expect(subject).toMatch(file('./__expected__/<case>.<ext>'))`, or compare to a literal with `toStrictEqual`.",
    toMatchScreenshot:
        'A screenshot is not a golden this dialect can read: assert the ARIA tree, the content, or the markup.',
    toMatchSnapshot:
        "The golden is `expect(subject).toMatch(file('./__expected__/<name>.<ext>'))`, a path from the spec file; under `src/` compare to a literal with `toStrictEqual`.",
    toThrowErrorMatchingInlineSnapshot:
        "State the message: `expect(fn).toThrow('<what the subject says>')`.",
    toThrowErrorMatchingSnapshot:
        "State the message: `expect(fn).toThrow('<what the subject says>')`.",
};

/** `no-vitest-time-or-global-stub` — `stubEnv` is not here: it restores itself. `vi.mock`/`vi.doMock` stay on `no-module-mock`, whose allow-list the option cannot express. */
const RESTRICTED_VI_METHODS: Record<string, string> = {
    setSystemTime: '`vi.setSystemTime` → `clock.at(iso)`, which gives the calendar back.',
    stubGlobal:
        "`vi.stubGlobal('fetch')` → `await using _ = await intercept(defineStubs(…))`; a subject that fetches a PATH states where it resolves: `intercept(stubs, { origin: 'http://<host>.test' })`.",
    useFakeTimers: '`vi.useFakeTimers` → `clock.at(iso)` and `clock.advance(ms)`.',
    useRealTimers: '`vi.useRealTimers` → nothing: `using` gives the clock back at the scope end.',
};

/** Set in an override because a base profile turns the vitest plugin on in an override over the test globs, and an override's entry replaces a top-level one. */
export const vitestOnTests: Override = {
    files: TEST_GLOBS,
    rules: {
        'vitest/consistent-test-filename': [
            'error',
            { pattern: String.raw`.*\.(?:test\.[tj]sx?|spec\.[tj]s)$` },
        ],
        // invariant: `one-describe-level` — one level of `describe`.
        'vitest/max-nested-describe': ['error', { max: 1 }],
        'vitest/no-restricted-matchers': ['error', SNAPSHOT_MATCHERS],
        'vitest/no-restricted-vi-methods': ['error', RESTRICTED_VI_METHODS],
        // invariant: `one-describe-per-file` — the describe is titled with its subject: `LocaleNote` keeps its case.
        'vitest/prefer-lowercase-title': ['error', { ignoreTopLevelDescribe: true }],
    },
};
