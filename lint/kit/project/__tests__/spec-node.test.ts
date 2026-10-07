import { describe, expect, test } from 'vitest';

import { refusalOf } from './spec-document.fixtures.js';

const REFUSED: [string, string, string][] = [
    [
        'a key declared twice, which the parser refuses before any law',
        'description: a\ndescription: b\nruns:\n  - command: a\n    exit: 0\n',
        'case.spec.yaml:2: Map keys must be unique at line 2, column 1:\n\ndescription: a\ndescription: b\n^\n',
    ],
    [
        'a run key that is no word',
        'description: a\nruns:\n  - command: a\n    exit: 0\n    1: x\n',
        'case.spec.yaml:5: a run: a key must be a plain word',
    ],
    [
        'a command that is a number',
        'description: a\nruns:\n  - command: 1\n    exit: 0\n',
        'case.spec.yaml:3: command: must be text',
    ],
    [
        'a stdout with no value, at its own line',
        'description: a\nruns:\n  - command: a\n    exit: 0\n    stdout:\n',
        'case.spec.yaml:5: stdout: must be text',
    ],
    [
        'a server with an empty env',
        'description: a\nserve:\n  - web:\nruns:\n  - command: a\n    exit: 0\n',
        'case.spec.yaml:3: serve: web must be a mapping of keys to values',
    ],
    [
        'an exit that is text',
        'description: a\nruns:\n  - command: a\n    exit: x\n',
        'case.spec.yaml:4: exit: must be a literal integer',
    ],
    [
        'an exit that is a fraction',
        'description: a\nruns:\n  - command: a\n    exit: 1.5\n',
        'case.spec.yaml:4: exit: must be a literal integer',
    ],
    [
        'an exit that is a list',
        'description: a\nruns:\n  - command: a\n    exit: [1]\n',
        'case.spec.yaml:4: exit: must be a literal integer',
    ],
    [
        'a file assertion asserting nothing',
        'description: a\nruns:\n  - command: a\n    exit: 0\n    files:\n      a.txt: {}\n',
        'case.spec.yaml:6: files: a.txt asserts nothing — give it contains: or equals:',
    ],
    [
        'a run that waits on a process it pipes into',
        'description: a\nruns:\n  - command: a\n    exit: 0\n    stdin: x\n    waitFor: y\n',
        'case.spec.yaml:6: waitFor: and stdin: cannot share a run — the pattern is watched on a process nobody closed the input of',
    ],
    [
        'a document with no description',
        'runs:\n  - command: a\n    exit: 0\n',
        'case.spec.yaml:1: missing "description:" — every document is one test, and this is its title',
    ],
    [
        'a document with no runs',
        'description: a\n',
        'case.spec.yaml:1: missing "runs:" — description and runs are mandatory',
    ],
];

describe('spec-node', () => {
    test.each(REFUSED)('%s is refused at the line of what it names', (_, content, message) => {
        // Given - a document whose one node breaks the law the readers hold
        // Then - the refusal, file and line first
        expect(refusalOf(content).message).toBe(message);
    });
});
