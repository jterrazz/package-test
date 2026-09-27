/** `// checker-disable-next-line <id>[,<id>] -- reason`, stepping over blank lines and other tools' directives; `checker-disable-line` for its own line. */
export function suppressedLines(text: string, id: string): Set<number> {
    const suppressed = new Set<number>();
    const lines = text.split('\n');
    const applies = (raw: string): boolean => {
        const ids = raw
            .replace(/--.*$/u, '')
            .trim()
            .split(/[\s,]+/u);
        return ids.includes(id) || ids.includes('*');
    };
    for (const [index, line] of lines.entries()) {
        // Case-insensitive: the formatter capitalizes comment leads (`checker-…` → `Checker-…`).
        let match = /checker-disable-next-line\s+(?<ids>.*)$/iu.exec(line);
        if (match !== null && applies(match.groups?.ids ?? '')) {
            // A directive of another tool may stand between, since each also claims the next line.
            for (let next = index + 1; next < lines.length; next += 1) {
                const following = (lines[next] ?? '').trim();
                if (following.length > 0 && !following.startsWith('//')) {
                    suppressed.add(next + 1);
                    break;
                }
            }
        }
        match = /checker-disable-line\s+(?<ids>.*)$/iu.exec(line);
        if (match !== null && applies(match.groups?.ids ?? '')) {
            suppressed.add(index + 1);
        }
    }
    return suppressed;
}

const DIRECTIVE_TEXT = /\.(?:[cm]?[jt]sx?|ya?ml|json|md|sql|http|txt)$/u;

export function holdsDirectives(path: string): boolean {
    return DIRECTIVE_TEXT.test(path);
}

export type Directive = { ids: string[]; line: number; rest: string };

const DIRECTIVE = /(?<lead>.*?)checker-disable(?:-next-line|-line)\s+(?<rest>.*)$/iu;

/** Only in a comment: the word inside a string is a test talking about suppressions. */
const COMMENT_LEAD = /(?:^|\s)(?:\/\/|\/\*|\*|#)\s*$/u;

export function directivesIn(text: string): Directive[] {
    return text.split('\n').flatMap((line, index) => {
        const match = DIRECTIVE.exec(line);
        if (match === null || !COMMENT_LEAD.test(match.groups?.lead ?? '')) {
            return [];
        }
        const rest = match.groups?.rest ?? '';
        const ids = rest
            .replace(/--.*$/u, '')
            .trim()
            .split(/[\s,]+/u)
            .filter((id) => id !== '');
        return [{ ids, line: index + 1, rest }];
    });
}
