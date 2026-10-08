// invariant: a token with no text before it on its line, or none after it, stands for whole lines and may cross them.
export function isFramedInLine(expected: string, start: number, end: number): boolean {
    // Stryker disable next-line ArithmeticOperator: the characters at a token's start are its own braces, never a line break
    const before = expected.slice(expected.lastIndexOf('\n', start - 1) + 1, start);
    const lineEnd = expected.indexOf('\n', end);
    const after = expected.slice(end, lineEnd === -1 ? undefined : lineEnd);
    return before.trim() !== '' && after.trim() !== '';
}

// invariant: a text whose tokens are all unnamed `{{any}}` holds its pieces in order, the first at its start and the last at its end, as its anchored pattern would: V8 compiles no pattern of a long golden ("Regular expression too large"), so the pieces are matched as text.
export function piecesMatch(pieces: readonly string[], text: string): boolean {
    const [first = '', ...rest] = pieces;
    const last = rest.pop();
    if (last === undefined) {
        return text === first;
    }
    if (!text.startsWith(first)) {
        return false;
    }
    let at = first.length;
    for (const piece of rest) {
        const found = text.indexOf(piece, at);
        if (found === -1) {
            return false;
        }
        at = found + piece.length;
    }
    return text.length - last.length >= at && text.endsWith(last);
}
