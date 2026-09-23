/**
 * What every finding and every refusal of this package says, in four parts and
 * this order: what was `found` and where, `why` the convention holds (one
 * sentence), the `fix` for this very case, and where to `read` the rule.
 *
 * A diagnostic is ONE line: oxlint's unix and agent reporters, the checker's
 * `file:line:column: severity jterrazz-check(<id>): …` line and every editor's
 * problem matcher read a finding as one line, and the unix reporter prints the
 * rule's name after the message's last line. A thrown refusal is a block, a
 * part per line, since what it found (the candidates of an ambiguous element)
 * may take several.
 */

/** The four parts, each a sentence a reader acts on. */
export type Lesson = {
    /** The concrete gesture for THIS case — the paths and names it needs. */
    fix: string;
    /** The finding, located: what was written, and where when the line cannot say. */
    found: string;
    /** The chapter anchor that owns the rule. */
    read: string;
    /** The convention, in one sentence. */
    why: string;
};

/** The parts in the order a message states them. */
export const LESSON_PARTS = ['found', 'why', 'fix', 'read'] as const;

/** Between two parts of a one-line lesson. */
export const LESSON_SEPARATOR = ' · ';

/** A lesson on one line: `found: … · why: … · fix: … · read: …`. */
export function lessonLine(lesson: Lesson): string {
    return LESSON_PARTS.map((part) => `${part}: ${lesson[part]}`).join(LESSON_SEPARATOR);
}

/** A lesson as a block, a part per line — what a thrown refusal carries. */
export function lessonBlock(lesson: Lesson): string {
    return LESSON_PARTS.map((part) => `${part}: ${lesson[part]}`).join('\n');
}

/** Where each part starts: its label, at the start or after a separator or a line break. */
const PART_START = /(?:^|\n| · )(?<part>found|why|fix|read): /gu;

/**
 * The parts a message states, in either form — a part it lacks is absent, and
 * a part stated out of order, or twice, makes it no lesson at all.
 */
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

/** The parts a message lacks, or leaves empty — nothing when it is a whole lesson. */
export function missingParts(message: string): string[] {
    const parts = lessonParts(message);
    if (parts === undefined) {
        return [...LESSON_PARTS];
    }
    return LESSON_PARTS.filter((part) => (parts[part] ?? '') === '');
}
