import { describe, expect, test } from 'vitest';

import { refusalOf } from './spec-document.fixtures.js';
import { parseSpecDocument } from './spec-document.js';

const RUN = 'runs:\n  - command: a\n    exit: 0\n';

const documentWith = (head: string, run = '') => `description: x\n${head}${RUN}${run}`;

const REFUSED: [string, string, string][] = [
    [
        'an env entry that is no text',
        documentWith('env: [[a]]\n'),
        'case.spec.yaml:2: each entry of env: must be text',
    ],
    [
        'an env pair with no name',
        documentWith('env: [=value]\n'),
        'case.spec.yaml:2: env: "=value" has no variable name before the "="',
    ],
    [
        'a serve entry that is no map',
        documentWith('serve: [[a]]\n'),
        'case.spec.yaml:2: a serve: entry must be a mapping of keys to values',
    ],
    [
        'a serve entry naming two servers',
        documentWith('serve:\n  - web: {}\n    api: {}\n'),
        'case.spec.yaml:3: a serve: entry names ONE server: `- <name>: { KEY: value }`',
    ],
    [
        'a serve entry naming none',
        documentWith('serve:\n  - {}\n'),
        'case.spec.yaml:3: a serve: entry names ONE server: `- <name>: { KEY: value }`',
    ],
    [
        'a server named by no word',
        documentWith('serve:\n  - [a]: {}\n'),
        'case.spec.yaml:3: a serve: entry must name its server with a plain word',
    ],
    [
        'a server whose env is no map',
        documentWith('serve:\n  - web: [a]\n'),
        'case.spec.yaml:3: serve: web must be a mapping of keys to values',
    ],
    [
        'a server env named by no word',
        documentWith('serve:\n  - web: { [a]: b }\n'),
        'case.spec.yaml:3: serve: web — a variable name must be a plain word',
    ],
    [
        'a server env value that is no text',
        documentWith('serve:\n  - web: { A: [b] }\n'),
        'case.spec.yaml:3: serve: web.A must be text',
    ],
    [
        'a run that is no map',
        'description: x\nruns:\n  - a\n',
        'case.spec.yaml:3: each entry of runs: must be a mapping of keys to values',
    ],
    [
        'a run with no command',
        'description: x\nruns:\n  - exit: 0\n',
        'case.spec.yaml:3: a run is missing "command:" — command and exit are mandatory',
    ],
    [
        'a command that is no text',
        'description: x\nruns:\n  - command: [a]\n    exit: 0\n',
        'case.spec.yaml:3: command: must be text',
    ],
    [
        'files that are no map',
        documentWith('', '    files: [a]\n'),
        'case.spec.yaml:5: files: must be a mapping of keys to values',
    ],
    [
        'a file named by no word',
        documentWith('', '    files: { [a]: absent }\n'),
        'case.spec.yaml:5: files: each key is a path relative to the working directory',
    ],
    [
        'a file state the grammar has not',
        documentWith('', '    files: { a.txt: gone }\n'),
        'case.spec.yaml:5: files: "a.txt: gone" is not a state — write absent or exists, or a { contains, equals } assertion',
    ],
    [
        'a file assertion that is no map',
        documentWith('', '    files: { a.txt: [contains] }\n'),
        'case.spec.yaml:5: files: a.txt must be a mapping of keys to values',
    ],
    [
        'a contains that is no text',
        documentWith('', '    files: { a.txt: { contains: { a: b } } }\n'),
        'case.spec.yaml:5: files: a.txt.contains must be text',
    ],
    [
        'a listed contains that is no text',
        documentWith('', '    files: { a.txt: { contains: [[a]] } }\n'),
        'case.spec.yaml:5: files: a.txt.contains must be text',
    ],
    [
        'a file assertion naming a key the grammar has not',
        documentWith('', '    files: { a.txt: { holds: a } }\n'),
        'case.spec.yaml:5: unknown key "holds:" in files: a.txt — known keys: contains, equals',
    ],
    [
        'an equals that is no text',
        documentWith('', '    files: { a.txt: { equals: [a] } }\n'),
        'case.spec.yaml:5: files: a.txt.equals must be text',
    ],
    [
        'a stdout that is no text',
        documentWith('', '    stdout: [a]\n'),
        'case.spec.yaml:5: stdout: must be text',
    ],
    [
        'a stderr that is no text',
        documentWith('', '    stderr: [a]\n'),
        'case.spec.yaml:5: stderr: must be text',
    ],
    [
        'a stdin that is no text',
        documentWith('', '    stdin: [a]\n'),
        'case.spec.yaml:5: stdin: must be text',
    ],
    [
        'a timeout that is no integer',
        documentWith('', '    timeout: soon\n'),
        'case.spec.yaml:5: timeout: must be a literal integer',
    ],
    [
        'a waitFor that is no text',
        documentWith('', '    waitFor: [a]\n'),
        'case.spec.yaml:5: waitFor: must be text',
    ],
    [
        'a fixture that is no text',
        documentWith('fixture: [[a]]\n'),
        'case.spec.yaml:2: each entry of fixture: must be text',
    ],
    [
        'a fixture that is no relative path',
        documentWith('fixture: /abs/_fixtures/a\n'),
        'case.spec.yaml:2: fixture: "/abs/_fixtures/a" is not a relative path — name it from this document (./… or ../…)',
    ],
    [
        'a fixture outside any fixtures folder',
        documentWith('fixture: ./a.json\n'),
        'case.spec.yaml:2: fixture: reads _fixtures/, and "./a.json" names no _fixtures/ folder — put the file in ./_fixtures/ beside the document, or in the _fixtures/ of the lowest folder the leaves share (specs/_shared/_fixtures/ across facets) (verb-reads-its-ground-folder)',
    ],
    [
        'a fixture in another ground folder',
        documentWith('fixture: ./_expected/a.json\n'),
        'case.spec.yaml:2: fixture: reads _fixtures/, and "./_expected/a.json" names _expected/ — put the file in ./_fixtures/ beside the document, or in the _fixtures/ of the lowest folder the leaves share (specs/_shared/_fixtures/ across facets) (verb-reads-its-ground-folder)',
    ],
];

describe('spec-fields', () => {
    test.each(REFUSED)('%s is refused at its line, naming the field', (_, content, message) => {
        // Given - a document whose one field is of the wrong shape
        // Then - the refusal, file and line first
        expect(refusalOf(content).message).toBe(message);
    });

    test('a lone serve entry is read as a list of one, its env with it', () => {
        // Given - a document serving one server, not written as a list
        const document = parseSpecDocument(
            documentWith('serve: { web: { PORT: "1" } }\n'),
            'case.spec.yaml',
        );

        // Then - the one server and its env
        expect(document.serve).toStrictEqual([{ env: { PORT: '1' }, line: 2, name: 'web' }]);
    });
});
