import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('refused', () => {
    test('a step that is no function is refused where it is stated', () => {
        // Given - a value handed where a step is run, past the type
        // Then - refused before anything runs, naming the form to write
        expect(() =>
            // @ts-expect-error -- a step is a function of the working directory
            cli.prepare('git init'),
        ).toThrow(
            [
                'found: prepare("git init"), no step to run',
                'why: A step is run over the working directory once the fixtures are laid; only a function can be run.',
                "fix: hand it a function of the working directory: .prepare((workdir) => { execFileSync('git', ['init'], { cwd: workdir }); })",
                'read: docs/guides/cli-specs.md#prepare-what-no-fixture-can-carry',
            ].join('\n'),
        );
    });
});
