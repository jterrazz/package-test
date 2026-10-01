#!/usr/bin/env node
import { runChecker } from '@jterrazz/typescript/rules';

import { CHECKER } from './consumer/checks/checker.js';
import { conventionsPass } from './engine/checker/conventions.js';
import { recordBaseline } from './engine/checker/record.js';

const args = process.argv.slice(2);

await runChecker(
    {
        commands: { baseline: async () => await Promise.resolve(recordBaseline(CHECKER)) },
        held: {
            lower: 'jterrazz-test-check --fix',
            passes: ['conventions'],
            read: 'docs/19-linting.md#the-ratchet-the-test-section-of-jterrazzbaselinejson',
            record: 'jterrazz-test-check baseline',
            section: 'test',
            summarised: true,
        },
        passes: { conventions: async () => await Promise.resolve(conventionsPass(CHECKER)) },
    },
    args[0] === 'baseline' ? args : ['conventions', ...args],
);
