import type { Contribution } from '@jterrazz/typescript/rules';

import { CHECKER } from './consumer/checks/checker.js';
import { conventionsPass } from './kit/checker/conventions.js';
import { recordBaseline } from './kit/checker/record.js';

const conventions: Contribution = {
    commands: { baseline: async () => recordBaseline(CHECKER) },
    held: {
        lower: 'typescript fix',
        passes: ['conventions'],
        read: 'docs/24-linting.md#the-ratchet-the-test-section-of-jterrazzbaselinejson',
        record: 'typescript baseline',
        section: 'test',
        summarised: true,
    },
    passes: { conventions: async () => conventionsPass(CHECKER) },
};

export default conventions;
