import { blankComments } from '@jterrazz/typescript/rules';

import { closingOf, openersAt } from '../../kit/project/source-scan.js';
import { holdsTestCall, lineEnd, withLeadingComments } from '../../kit/project/spec-subjects.js';
import type { Span } from '../../kit/project/spec-subjects.js';
import { without } from './spec-in-subject-folder.prune.js';

// invariant: a group of the file is one written at the start of a line; a group nested in another goes with it.
function describesOf(text: string): (Span & { holdsTests: boolean })[] {
    const blank = blankComments(text);
    return [...blank.matchAll(/^describe(?:\.\w+(?:\([^()]*\))?)*\s*\(/gmu)].map((found) => {
        const open = found.index + found[0].length - 1;
        const close = closingOf(blank, open);
        return {
            end: lineEnd(text, close),
            holdsTests: holdsTestCall(blank.slice(open, close)),
            start: withLeadingComments(text, found.index),
        };
    });
}

// invariant: a group the cut emptied goes; a group still holding tests keeps its title; merging groups is `one-describe-per-file`'s fixer, which keeps each test's own title and refuses on a collision.
export function withoutEmptiedGroups(text: string): string {
    return without(
        text,
        describesOf(text).filter((describe) => !describe.holdsTests),
    );
}

// invariant: a comment standing alone at module scope (a header, a note above a blank line) is said once, in the file the split opens on.
export function withoutLooseComments(text: string): string {
    const blank = blankComments(text);
    const lines = text.split('\n');
    const blankLines = blank.split('\n');
    const loose: Span[] = [];
    let offset = 0;
    let block: Span | undefined;
    for (const [index, line] of lines.entries()) {
        // Stryker disable next-line StringLiteral: a blanked text keeps every line of its source, so each line has its blank twin
        const commentOnly = line.trim() !== '' && (blankLines[index] ?? '').trim() === '';
        const end = offset + line.length + 1;
        if (commentOnly && openersAt(blank, offset).length === 0) {
            block = { end, start: block?.start ?? offset };
        } else if (block !== undefined) {
            if (line.trim() === '') {
                loose.push({ end, start: block.start });
            }
            block = undefined;
        }
        offset = end;
    }
    if (block !== undefined) {
        loose.push(block);
    }
    return without(text, loose);
}
