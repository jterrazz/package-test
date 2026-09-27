#!/usr/bin/env node
import { exitCodeOf } from '@jterrazz/typescript/rules';

import { CHECKER } from './consumer/checks/checker.js';
import { runCheckerCli } from './engine/checker/cli.js';

process.exit(
    exitCodeOf(() => {
        runCheckerCli(CHECKER, process.argv.slice(2));
    }),
);
