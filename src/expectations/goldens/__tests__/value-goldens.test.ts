import { describe, expect, test, vi } from 'vitest';

import { ResponseAccessor } from '../../http/response.js';
import { JsonAccessor } from '../../text/json.js';
import { TextAccessor } from '../../text/text.js';
import { registerMatchers } from '../matchers.js';
import {
    matchJsonValue,
    matchResponseValue,
    UNRECORDED,
    unrecorded,
    writeAt,
} from '../value-goldens.js';
import { scratchTest, UUID, wholeOf } from './response-goldens.fixtures.js';

const verdict = (result: { message: () => string; pass: boolean }): [boolean, string] => [
    result.pass,
    result.message(),
];

await registerMatchers();

describe('value-goldens', () => {
    test('valueGoldens — toMatch compares the whole result to the value written in place, and update mode writes it there (`no-volatile-literal`) — a stream against its text: indentation of the test dropped, tokens read, the golden diff on a mismatch', () => {
        // Given - a stream, and its text written in place, indented with the test
        const subject = new TextAccessor('built 3 files in 12ms\ndone\n', 'stdout', '/tmp');

        // Then - the whole text matches with a token, and a missing line is the golden's diff
        expect(subject).toMatch(`
        built 3 files in {{duration}}
        done
    `);
        expect(() => {
            expect(subject).toMatch(`
            built 3 files in {{duration}}
        `);
        }).toThrow(/Output mismatch \(the value in place\)[\s\S]*\+ done/u);
    });

    test('valueGoldens — toMatch compares the whole result to the value written in place, and update mode writes it there (`no-volatile-literal`) — a response against its .http text: status, the headers it lists, the whole body', () => {
        // Given - a response
        const subject = new ResponseAccessor(
            {
                body: { id: UUID, name: 'Alice' },
                headers: { 'content-type': 'application/json', date: 'now' },
                status: 201,
            },
            '/tmp',
        );

        // Then - the text in place matches; a body field off is the golden's body diff
        expect(subject).toMatch(`
        HTTP/1.1 201 Created
        content-type: application/json

        {"id": "{{uuid}}", "name": "Alice"}
    `);
        expect(() => {
            expect(subject).toMatch(`
            HTTP/1.1 201 Created

            {"id": "{{uuid}}", "name": "Bob"}
        `);
        }).toThrow(/Response mismatch \(the value in place\)[\s\S]*"name": "Bob"/u);
        expect(() => {
            expect(subject).toMatch('HTTP/1.1 200 OK');
        }).toThrow('Response status mismatch (the value in place)');
    });

    test('valueGoldens — toMatch compares the whole result to the value written in place, and update mode writes it there (`no-volatile-literal`) — a json against its value: tokens in its strings, every key compared', () => {
        // Given - a json
        const subject = new JsonAccessor(`{ "id": "${UUID}", "tags": ["a"] }`, 'stdout', '/tmp');

        // Then - the value matches whole; a missing key fails
        expect(subject).toMatch({ id: '{{uuid}}', tags: ['a'] });
        expect(() => {
            expect(subject).toMatch({ id: '{{uuid}}' });
        }).toThrow(/Response mismatch \(the value in place\)[\s\S]*\+ {3}"tags"/u);
    });

    test('valueGoldens — toMatch compares the whole result to the value written in place, and update mode writes it there (`no-volatile-literal`) — an empty text is filled with the stream, as a block indented with the call', () => {
        // Given - a scratch test holding an empty value, under update mode
        vi.stubEnv('TEST_UPDATE', '1');
        const scratch = scratchTest('expect(result.stdout).toMatch(``);');

        // When - the stream is compared to it
        void wholeOf(new TextAccessor('built\ndone\n', 'stdout', '/tmp'))(
            '',
            undefined,
            scratch.stack,
        );

        // Then - the stream, written where the empty value stood
        expect(scratch.read()).toBe(
            "test('records', async () => {\n    expect(result.stdout).toMatch(`\n        built\n        done\n    `);\n});\n",
        );
    });

    test('valueGoldens — toMatch compares the whole result to the value written in place, and update mode writes it there (`no-volatile-literal`) — a line whose token still matches keeps it; the lines that moved are rewritten', () => {
        // Given - a value in place with a token line and a stale line, under update mode
        vi.stubEnv('TEST_UPDATE', '1');
        const scratch = scratchTest(
            String.raw`expect(result.stdout).toMatch('built in {{duration}}\nold\n');`,
        );

        // When - the stream differs on the second line only
        void wholeOf(new TextAccessor('built in 5ms\nnew\n', 'stdout', '/tmp'))(
            'built in {{duration}}\nold\n',
            undefined,
            scratch.stack,
        );

        // Then - the token kept, the stale line replaced
        expect(scratch.read()).toContain('        built in {{duration}}\n        new\n    `');
    });

    test('valueGoldens — toMatch compares the whole result to the value written in place, and update mode writes it there (`no-volatile-literal`) — a response not yet recorded fails naming update mode, and update mode writes its .http text', () => {
        // Given - a response, and an empty value in place
        const subject = new ResponseAccessor(
            { body: { id: UUID }, headers: { 'content-type': 'application/json' }, status: 201 },
            '/tmp',
        );
        const scratch = scratchTest('expect(result.response).toMatch(``);');

        // Then - refused outside update mode, written inside it with the uuid tokenised only where a token stood before
        expect(() => {
            void wholeOf(subject)('', undefined, scratch.stack);
        }).toThrow('nothing is written in place yet: run with TEST_UPDATE=1');
        vi.stubEnv('TEST_UPDATE', '1');
        void wholeOf(subject)('', undefined, scratch.stack);
        expect(scratch.read()).toContain(
            `toMatch(\`\n        HTTP/1.1 201 Created\n        content-type: application/json\n\n        {\n            "id": "${UUID}"\n        }\n    \`);`,
        );
    });

    test('valueGoldens — toMatch compares the whole result to the value written in place, and update mode writes it there (`no-volatile-literal`) — a json keeps the tokens that still match and takes every other value', () => {
        // Given - a json whose id matches its token and whose name moved, under update mode
        vi.stubEnv('TEST_UPDATE', '1');
        const scratch = scratchTest(
            "expect(result.json).toMatch({ id: '{{uuid}}', name: 'Ada' });",
        );

        // When - compared
        void wholeOf(new JsonAccessor(`{"id":"${UUID}","name":"Grace"}`, 'stdout', '/tmp'))(
            { id: '{{uuid}}', name: 'Ada' },
            undefined,
            scratch.stack,
        );

        // Then - the token kept, the name rewritten, written as code
        expect(scratch.read()).toContain(
            'toMatch({\n        "id": "{{uuid}}",\n        "name": "Grace"\n    });',
        );
    });

    test('valueGoldens — toMatch compares the whole result to the value written in place, and update mode writes it there (`no-volatile-literal`) — a call that threw records nothing, and its error is named', () => {
        // Given - the value of a call that threw, null as JSON, beside the call recorded in place, under update mode
        vi.stubEnv('TEST_UPDATE', '1');
        const scratch = scratchTest('expect(result.value).toMatch(``);');
        const threw = new JsonAccessor('null', 'value', '/tmp', { thrown: 'connection refused' });

        // Then - update mode refuses to write a null over it, and the test file is untouched
        expect(() => {
            void wholeOf(threw)('', undefined, scratch.stack);
        }).toThrow(
            [
                'found: update mode: the call threw "connection refused", so its value is null',
                'why: A null recorded over a call that failed is an expectation no failure can break: every call could fail and the test would stay green.',
                'fix: assert the error with `expect(result.error).toMatch(...)`, or fix the call so it returns',
                'read: docs/reference/tokens.md#a-value-written-in-place-is-rewritten-in-the-test',
            ].join('\n'),
        );
        expect(scratch.read()).toContain('toMatch(``);');
    });

    test('valueGoldens — toMatch compares the whole result to the value written in place, and update mode writes it there (`no-volatile-literal`) — a value that matches, a frozen one and a negation are never written', () => {
        // Given - three calls in place, under update mode
        vi.stubEnv('TEST_UPDATE', '1');
        const subject = new TextAccessor('built\n', 'stdout', '/tmp');
        const matching = scratchTest(String.raw`expect(result.stdout).toMatch('built\n');`);
        const frozen = scratchTest("expect(result.stdout).toMatch('other', { frozen: true });");
        const negated = scratchTest(String.raw`expect(result.stdout).not.toMatch('built\n');`);

        // Then - each file byte for byte, the frozen and the negated mismatches still thrown
        void wholeOf(subject)('built\n', undefined, matching.stack);
        expect(() => {
            void wholeOf(subject)('other', { frozen: true }, frozen.stack);
        }).toThrow('Output mismatch (the value in place)');
        expect(() => {
            void wholeOf(subject, true)('built\n', undefined, negated.stack);
        }).toThrow('expected stdout not to match the value in place');
        expect(matching.read()).toContain(String.raw`toMatch('built\n');`);
        expect(frozen.read()).toContain("toMatch('other', { frozen: true });");
        expect(negated.read()).toContain(String.raw`not.toMatch('built\n');`);
    });

    test('valueGoldens — the verdicts in place — a blank value is not recorded yet, a match says so, and a value with no test frame to write into is refused', () => {
        // Given - values and a json and a response subject, with no update mode
        const context = { negated: false, options: undefined, stack: '' };
        const json = new JsonAccessor('{ "a": 1 }', 'body', '/tmp');
        const response = new ResponseAccessor(
            { body: '42', headers: { 'content-type': 'text/plain' }, status: 200 },
            '/tmp',
        );

        // Then - each verdict, and the refusal of a write with nowhere to go
        expect([
            [unrecorded('  \n '), unrecorded('x'), unrecorded(0)],
            verdict(matchJsonValue(json, { a: 1 }, context)),
            verdict(matchJsonValue(json, '  ', context)),
            verdict(matchResponseValue(response, 'HTTP/1.1 200 OK\n\n42\n', context)),
            verdict(matchResponseValue(response, ' ', context)),
        ]).toStrictEqual([
            [true, false, false],
            [true, 'expected JSON not to match the value in place'],
            [false, `JSON (the value in place): ${UNRECORDED}`],
            [true, 'expected response not to match the value in place'],
            [false, `Response (the value in place): ${UNRECORDED}`],
        ]);
        expect(() =>
            writeAt({ ...context, stack: 'Error\n    at node:internal/x:1:1' }, () => ''),
        ).toThrow(
            new Error(
                [
                    'found: update mode: no frame of this toMatch call is a test file, so the value in place has nowhere to be written',
                    'why: A value written in place is rewritten in the test that states it.',
                    'fix: call toMatch() from the test file itself, or compare to a golden file: toMatch(file(...))',
                    'read: docs/reference/tokens.md#a-value-written-in-place-is-rewritten-in-the-test',
                ].join('\n'),
            ),
        );
    });

    test('valueGoldens — the verdicts in place — a write names where it wrote', () => {
        // Given - a call in place in a scratch test
        const site = scratchTest("expect(result.stdout).toMatch('');");

        // Then - the line the value was written at
        expect(
            writeAt(
                { negated: false, options: undefined, stack: site.stack },
                () => "'x'",
            ).message(),
        ).toBe(`updated the value in place at ${site.file}:2`);
    });
});
