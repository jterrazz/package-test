export const SPEC = 'specs/api/users.spec.ts';

export const USERS = "file('./_expected/users.json')";

export const REQUEST =
    "test('creates', async () => {\n    await api.request(file('./_requests/create.http'));\n});\n";

export const EXPECTED = { 'specs/api/_expected/users.json': '[]\n' };

export const readAlone = (name = 'users.json'): string[] => [
    `specs/api/users.spec.ts:2:39 specs/api/_expected/${name}, read by this test alone — write it here, the value \`toMatch\` compares, and delete the file — \`typescript fix\` inlines it`,
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
        'it is read as a directory',
        {
            'specs/api/_expected/users/a.json': '[]\n',
            [SPEC]: testReading("directory('./_expected/users/')"),
        },
    ],
    ['it does not exist', { [SPEC]: testReading(USERS) }],
    [
        'a file is named as a directory',
        { ...EXPECTED, [SPEC]: testReading("directory('./_expected/users.json')") },
    ],
    [
        'it is binary',
        { 'specs/api/_expected/users.json': '\u0000\u0001', [SPEC]: testReading(USERS) },
    ],
    [
        'it is longer than its role writes in place',
        {
            'specs/api/_expected/users.txt': lines(151),
            [SPEC]: testReading("file('./_expected/users.txt')"),
        },
    ],
    [
        'its JSON is longer once written out',
        {
            'specs/api/_expected/users.json': `${JSON.stringify(Array.from({ length: 150 }, (_, at) => at))}\n`,
            [SPEC]: testReading(USERS),
        },
    ],
    [
        'its role is never written in place',
        {
            'specs/api/_fixtures/users.txt': 'a\n',
            [SPEC]: testReading("file('./_fixtures/users.txt')"),
        },
    ],
    [
        'its request is longer than a request in place',
        { 'specs/api/_requests/create.http': lines(31), [SPEC]: REQUEST },
    ],
    [
        'a module test names it',
        {
            ...EXPECTED,
            [SPEC]: testReading(USERS),
            'src/users.test.ts': "read('../specs/api/_expected/users.json');\n",
        },
    ],
    [
        'a module test names its folder',
        {
            ...EXPECTED,
            [SPEC]: testReading(USERS),
            'src/users.test.ts': "read('../specs/api/_expected');\n",
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
        { ...EXPECTED, [SPEC]: testReading(['file(`./_expected/$', '{name}.json`)'].join('')) },
    ],
    ['its path is bare', { ...EXPECTED, [SPEC]: testReading("file('_expected/users.json')") }],
    [
        'its path names no ground folder',
        { 'specs/api/users.json': '[]\n', [SPEC]: testReading("file('./users.json')") },
    ],
];
