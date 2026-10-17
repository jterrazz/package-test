import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../__tests__/package-tree.fixtures.js';
import { checkDockerExecBoundWithAwaitUsing } from '../docker-exec-bound-with-await-using.js';

describe('checkDockerExecBoundWithAwaitUsing', () => {
    test('a result of a docker-aware runner is bound with await using, and a result of another runner may be bound any way', () => {
        // Given - a docker-aware runner and a plain one, read by a spec binding results every way
        const root = packageWith({
            'specs/cli/cli.specification.ts': [
                "export const { cli } = await specification.cli('bin', { docker: compose('./a.yml') });",
                '',
            ].join('\n'),
            'specs/cli/plain.specification.ts':
                "export const { cli: plain } = await specification.cli('bin', {});\n",
            'specs/cli/run.spec.ts': [
                "import { cli as run } from './cli.specification.js';",
                "import { plain } from './plain.specification.js';",
                "const first = await run.exec('a');",
                "let second = await run.env({}).exec('b');",
                "await using third = await run.exec('c');",
                "const fourth = await plain.exec('d');",
                "const fifth = await run.exec('e'); // checker-disable-line docker-exec-bound-with-await-using -- the case",
                '',
            ].join('\n'),
        });

        // Then - the two results bound without it
        expect(
            checkDockerExecBoundWithAwaitUsing(root).map(
                ({ fix, found, line, path, rule }) => `${rule} ${path}:${line} ${found} — ${fix}`,
            ),
        ).toStrictEqual([
            'docker-exec-bound-with-await-using specs/cli/run.spec.ts:3 a result of the docker-aware runner "run" bound without `await using` — bind it with `await using result = await run...`, so the containers it started are removed at the end of the scope',
            'docker-exec-bound-with-await-using specs/cli/run.spec.ts:4 a result of the docker-aware runner "run" bound without `await using` — bind it with `await using result = await run...`, so the containers it started are removed at the end of the scope',
        ]);
    });
});
