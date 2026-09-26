import { beforeAll, describe, expect, test } from 'vitest';

import { file } from '../../kernel/files/spec-path.js';
import { registerMatchers } from '../goldens/matchers.js';
import { text } from './text-subject.js';
import { TextAccessor } from './text.js';

describe('text', () => {
    beforeAll(async () => {
        await registerMatchers();
    });

    test('toMatch resolves against _expected/ next to the calling test', () => {
        // Given - a one-line message
        // Then - the fixture next to THIS test file resolves via caller detection
        expect(text('the operation could not complete\n')).toMatch(
            file('./_expected/could-not-complete.txt'),
        );
    });

    test('strips ANSI before comparison while .raw keeps the escapes', () => {
        // Given - a coloured message
        const coloured = '\u001B[31mred\u001B[0m plain\n';

        // Then - the raw form keeps the escapes, the comparison sees them stripped
        // oxlint-disable-next-line jterrazz/no-raw-bypass -- proving text().raw preserves the ANSI the matcher strips: the raw accessor IS the subject
        expect(text(coloured).raw).toContain('\u001B[31m');
        expect(text(coloured).text).toBe('red plain\n');
        expect(text(coloured)).toMatch(file('./_expected/red-plain.txt'));
    });

    test('supports the {{token}} grammar in the fixture', () => {
        // Given - a message with a volatile path and duration
        const message = 'failed at /tmp/spec-abc123/out.txt after 42ms\n';

        // Then - {{path}}/{{number}} placeholders absorb the volatile parts
        expect(text(message)).toMatch(file('./_expected/failed-after-duration.txt'));
    });

    test('.grep() composes and stays snapshot-able', () => {
        // Given - a multi-block report
        const report = 'header line\n\nerror: boom\n  at frame\n\nfooter line\n';

        // Then - grep keeps only the matching block, still a TextAccessor
        expect(text(report).grep('error')).toBeInstanceOf(TextAccessor);
        expect(text(report).grep('error')).toMatch(file('./_expected/error-block.txt'));
    });
});
