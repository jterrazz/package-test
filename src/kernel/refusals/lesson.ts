export type Lesson = {
    fix: string;
    found: string;
    read: string;
    why: string;
};

export const LESSON_PARTS = ['found', 'why', 'fix', 'read'] as const;

export const LESSON_SEPARATOR = ' · ';

/** One line: oxlint's reporters and editor problem matchers read a finding as one line. */
export function lessonLine(lesson: Lesson): string {
    return LESSON_PARTS.map((part) => `${part}: ${lesson[part]}`).join(LESSON_SEPARATOR);
}

export function lessonBlock(lesson: Lesson): string {
    return LESSON_PARTS.map((part) => `${part}: ${lesson[part]}`).join('\n');
}

const PART_START = /(?:^|\n| · )(?<part>found|why|fix|read): /gu;

/** A part out of order, or stated twice, makes it no lesson. */
export function lessonParts(message: string): Partial<Lesson> | undefined {
    const starts = [...message.matchAll(PART_START)];
    const order = starts.map((start) => start.groups?.part ?? '');
    const expected = LESSON_PARTS.filter((part) => order.includes(part));
    if (order.join(',') !== expected.join(',') || (starts[0]?.index ?? 0) !== 0) {
        return undefined;
    }
    const parts: Partial<Lesson> = {};
    for (const [index, start] of starts.entries()) {
        const from = start.index + start[0].length;
        const to = starts[index + 1]?.index ?? message.length;
        parts[start.groups?.part as keyof Lesson] = message.slice(from, to).trim();
    }
    return parts;
}

export function missingParts(message: string): string[] {
    const parts = lessonParts(message);
    if (parts === undefined) {
        return [...LESSON_PARTS];
    }
    return LESSON_PARTS.filter((part) => (parts[part] ?? '') === '');
}
