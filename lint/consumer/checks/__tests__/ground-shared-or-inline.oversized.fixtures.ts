const rows = (count: number): string =>
    Array.from({ length: count }, (_, at) => `        row ${at}`).join('\n');

/** A template of `count` lines, as a test body at four spaces writes it. */
export const block = (count: number): string => `\`\n${rows(count)}\n    \``;

/** An object literal on one line that prints as `count + 2` lines of JSON. */
export const keys = (count: number): string =>
    `{ ${Array.from({ length: count }, (_, at) => `k${at}: ${at}`).join(', ')} }`;

const keysOnLines = (count: number): string =>
    `{\n${Array.from({ length: count }, (_, at) => `        k${at}: ${at},`).join('\n')}\n    }`;

/** What the fixer writes of `block(count)` sent raw: the template's own lines, dedented. */
export const dedented = (count: number): string =>
    `${Array.from({ length: count }, (_, at) => `row ${at}`).join('\n')}\n`;

export const keysJson = (count: number): string =>
    [
        '{',
        ...Array.from(
            { length: count },
            (_, at) => `    "k${at}": ${at}${at === count - 1 ? '' : ','}`,
        ),
        '}',
        '',
    ].join('\n');

export const OVERSIZED_SPEC = `${[
    "import { api } from '../api.specification.js';",
    '',
    "test('creates a user', async () => {",
    `    await api.post('/users, all', ${block(31)});`,
    '});',
    "test('replaces it', async () => {",
    `    await api.put(path(1, 2), ${keys(29)});`,
    `    await api.put(['/users', 'x'].join('/'), ${keys(30)});`,
    '});',
    "test('sends raw', async () => {",
    `    await api.request(${block(31)});`,
    `    await api.request(${block(30)});`,
    "    await api.post('/x');",
    `    await api.post('/x', payload(${keysOnLines(31)}));`,
    `    const doc = \`api.put('/y', ${keys(29)})\`;`,
    '});',
    "test('renames it', async () => {",
    `    await api.put('/x', ${block(31)});`,
    `    await api.post('/x', ${keysOnLines(30).replace('k0: 0', 'k0: user.id')});`,
    '});',
    "test('lists users', async () => {",
    `    expect(result.json).toMatch(${keys(149)});`,
    `    expect(result.response).toMatch(${block(151)});`,
    `    expect(result.stdout).toMatch(${block(151)});`,
    `    expect(output).toMatch(${block(151)});`,
    `    expect(result.text).toMatch(${block(151)});`,
    `    expect(result.other).toMatch(${keysOnLines(149)});`,
    '    // checker-disable-next-line ground-shared-or-inline -- the case',
    `    expect(result.json).toMatch(${keys(149)});`,
    '});',
].join('\n')}\n`;
