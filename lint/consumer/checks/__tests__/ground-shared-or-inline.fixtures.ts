export const SPEC = 'specs/api/users.spec.ts';

export const USERS = "file('./__expected__/users.json')";

export const REQUEST =
    "test('creates', async () => {\n    await api.request(file('./__requests__/create.http'));\n});\n";

export const EXPECTED = { 'specs/api/__expected__/users.json': '[]\n' };

export const readAlone = (name = 'users.json'): string[] => [
    `specs/api/users.spec.ts:2:39 specs/api/__expected__/${name}, read by this test alone — write it here, the value \`toMatch\` compares, and delete the file; \`typescript fix\` inlines it`,
];

export const READ_ALONE = readAlone();

export function testReading(call: string, title = 'lists users'): string {
    return [
        `test('${title}', async () => {`,
        `    await expect(result.body).toMatch(${call});`,
        '});',
        '',
    ].join('\n');
}

export const lines = (count: number): string =>
    `${Array.from({ length: count }, (_, at) => `line ${at}`).join('\n')}\n`;

/** A tree whose ground file is shared, unwritable in place, silenced, or no ground file. */
export const STAYS_A_FILE: [string, Record<string, string>][] = [
    [
        'two tests read it',
        { ...EXPECTED, [SPEC]: testReading(USERS) + testReading(USERS, 'pages users') },
    ],
    ['a top-level binding reads it', { ...EXPECTED, [SPEC]: `const users = ${USERS};\n` }],
    [
        'a test and the module after it read it',
        { ...EXPECTED, [SPEC]: `${testReading(USERS)}const users = ${USERS};\n` },
    ],
    ['a helper module reads it', { ...EXPECTED, 'specs/api/users.ts': testReading(USERS) }],
    [
        "a document's fixture line reads it",
        {
            ...EXPECTED,
            [SPEC]: testReading(USERS),
            'specs/api/users-doc.spec.yaml':
                'description: lists users\nfixture: ./__expected__/users.json\nruns:\n    - command: echo\n      exit: 0\n',
        },
    ],
    [
        'another spec imports it',
        {
            ...EXPECTED,
            [SPEC]: testReading(USERS),
            'specs/api/other.spec.ts':
                "import users from './__expected__/users.json' with { type: 'json' };\ntest('x', () => { expect(users).toEqual([]); });\n",
        },
    ],
    [
        'a module helper imports it',
        {
            ...EXPECTED,
            [SPEC]: testReading(USERS),
            'specs/api/users.mjs':
                "import users from './__expected__/users.json' with { type: 'json' };\nexport default users;\n",
        },
    ],
    [
        'another spec joins its path to its folder',
        {
            ...EXPECTED,
            [SPEC]: testReading(USERS),
            'specs/api/other.spec.ts':
                "test('x', () => { expect(readFileSync(join(import.meta.dirname, './__expected__/users.json'), 'utf8')).toBe('[]\\n'); });\n",
        },
    ],
    [
        'it is read as a directory',
        {
            'specs/api/__expected__/users/a.json': '[]\n',
            [SPEC]: testReading("directory('./__expected__/users/')"),
        },
    ],
    ['it does not exist', { [SPEC]: testReading(USERS) }],
    [
        'a file is named as a directory',
        { ...EXPECTED, [SPEC]: testReading("directory('./__expected__/users.json')") },
    ],
    [
        'it is binary',
        { 'specs/api/__expected__/users.json': '\u0000\u0001', [SPEC]: testReading(USERS) },
    ],
    [
        'it is longer than its role writes in place',
        {
            'specs/api/__expected__/users.txt': lines(151),
            [SPEC]: testReading("file('./__expected__/users.txt')"),
        },
    ],
    [
        'its JSON is longer once written out',
        {
            'specs/api/__expected__/users.json': `${JSON.stringify(Array.from({ length: 150 }, (_, at) => at))}\n`,
            [SPEC]: testReading(USERS),
        },
    ],
    [
        'its role is never written in place',
        {
            'specs/api/__fixtures__/users.txt': 'a\n',
            [SPEC]: testReading("file('./__fixtures__/users.txt')"),
        },
    ],
    [
        'its request is longer than a request in place',
        { 'specs/api/__requests__/create.http': lines(31), [SPEC]: REQUEST },
    ],
    [
        'a module test names it',
        {
            ...EXPECTED,
            [SPEC]: testReading(USERS),
            'src/users.test.ts': "read('../specs/api/__expected__/users.json');\n",
        },
    ],
    [
        'a module test names its folder',
        {
            ...EXPECTED,
            [SPEC]: testReading(USERS),
            'src/users.test.ts': "read('../specs/api/__expected__');\n",
        },
    ],
    [
        'a reasoned directive silences it',
        {
            ...EXPECTED,
            [SPEC]: testReading(USERS).replace(
                '    await',
                '    // checker-disable-next-line ground-shared-or-inline -- the file is what the test reads\n    await',
            ),
        },
    ],
    [
        'its path is built',
        { ...EXPECTED, [SPEC]: testReading(['file(`./__expected__/$', '{name}.json`)'].join('')) },
    ],
    ['its path is bare', { ...EXPECTED, [SPEC]: testReading("file('__expected__/users.json')") }],
    [
        'its path names no ground folder',
        { 'specs/api/users.json': '[]\n', [SPEC]: testReading("file('./users.json')") },
    ],
];
