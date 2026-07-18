import { beforeAll, describe, expect, test } from 'vitest';

import { registerMatchers } from '../../../../vitest/matchers.js';
import { text, TextAccessor } from './text.js';

describe('text() — ad-hoc string as a golden subject', () => {
    beforeAll(async () => {
        await registerMatchers();
    });

    test('toMatch resolves against expected/ next to the calling test', () => {
        // Given - a message goldened at expected/text-basic.txt
        // Then - the fixture next to THIS test file resolves via caller detection
        expect(text('the operation could not complete\n')).toMatch('text-basic.txt');
    });

    test('strips ANSI before comparison while .text stays raw', () => {
        // Given - a coloured message
        const coloured = '\x1b[31mred\x1b[0m plain\n';

        // Then - the raw form keeps the escapes, the comparison sees them stripped
        // oxlint-disable-next-line jterrazz/d8w-text-bypass -- proving text().text preserves the raw ANSI the matcher strips: the raw accessor IS the subject
        expect(text(coloured).text).toContain('\x1b[31m');
        expect(text(coloured)).toMatch('text-ansi.txt');
    });

    test('supports the {{token}} grammar in the fixture', () => {
        // Given - a message with a volatile path and duration
        const message = 'failed at /tmp/spec-abc123/out.txt after 42ms\n';

        // Then - {{path}}/{{number}} placeholders absorb the volatile parts
        expect(text(message)).toMatch('text-tokens.txt');
    });

    test('.grep() composes and stays snapshot-able', () => {
        // Given - a multi-block report
        const report = 'header line\n\nerror: boom\n  at frame\n\nfooter line\n';

        // Then - grep keeps only the matching block, still a TextAccessor
        expect(text(report).grep('error')).toBeInstanceOf(TextAccessor);
        expect(text(report).grep('error')).toMatch('text-grep.txt');
    });
});
