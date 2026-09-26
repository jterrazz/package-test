#!/usr/bin/env node
import { CHECKER } from './consumer/checks/checker.js';
import { runCheckerCli } from './engine/checker/cli.js';
import { exitCodeOf } from './engine/checker/stop.js';

process.exit(
    exitCodeOf(() => {
        runCheckerCli(CHECKER, process.argv.slice(2));
    }),
);
