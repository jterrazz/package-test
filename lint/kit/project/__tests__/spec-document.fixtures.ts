import { parseSpecDocument } from '../spec-document.js';
import { SpecSyntaxError } from '../spec-grammar.js';

export const MINIMAL = [
    'description: does the thing',
    'runs:',
    '  - command: help',
    '    exit: 0',
    '',
].join('\n');

export function refusalOf(content: string): SpecSyntaxError {
    try {
        parseSpecDocument(content, 'case.spec.yaml');
    } catch (error) {
        if (error instanceof SpecSyntaxError) {
            return error;
        }
        throw error;
    }
    throw new Error('expected the document to be refused, but it parsed');
}

/** Each refused shape, and the refusal it gets, whole. */
export const REFUSALS: [string, string, string][] = [
    [
        'malformed YAML',
        'description: x\n  runs: [\n',
        'case.spec.yaml:1: Nested mappings are not allowed in compact mappings at line 1, column 14:\n\ndescription: x\n             ^\n',
    ],
    ['an empty document', '', 'case.spec.yaml:1: the document is empty'],
    [
        'a scalar document',
        'hello\n',
        'case.spec.yaml:1: a spec document must be a mapping of keys to values',
    ],
    ['a null document', 'null\n', 'case.spec.yaml:1: the document is empty'],
    ['a list', '- a\n', 'case.spec.yaml:1: a spec document must be a mapping of keys to values'],
    [
        'runs that are no list',
        'description: x\nruns: a\n',
        'case.spec.yaml:2: runs: is a list of at least one run',
    ],
    [
        'an empty list of runs',
        'description: x\nruns: []\n',
        'case.spec.yaml:2: runs: is a list of at least one run',
    ],
    [
        'a description that is no text',
        'description: [1]\nruns:\n  - command: a\n    exit: 0\n',
        'case.spec.yaml:1: description: must be text',
    ],
];

/** A two-run document, the last one waiting, with a fixture of each kind and streams of each kind. */
export const SERVING = [
    '# a case',
    'description: serves',
    'fixture: [./__fixtures__/tree/, ./__fixtures__/one.sql]',
    'runs:',
    '  - command: a',
    '    exit: 0',
    '    stdout: out',
    '    files:',
    '      a.txt:',
    '        contains: [needle]',
    '        equals: whole',
    '      b.txt: absent',
    '      c.txt:',
    '        contains: [other]',
    '  - command: serve',
    '    exit: 0',
    '    stderr: err',
    '    waitFor: listening',
    '',
].join('\n');
