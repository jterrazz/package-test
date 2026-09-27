import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { lessonLine } from '../catalogue/lesson-parts.js';

export const BASELINE_FILE = 'jterrazz.baseline.json';

export const ROUTES_KEY = 'routes/unreached';

/** The `test` section of the family's `jterrazz.baseline.json`; every other section is kept byte for byte. Exact both ways: a rise, a new rule, a fall and an entry at zero all break it. The plugin's rules are oxlint's to hold, in oxlint-suppressions.json. */
export const BASELINE_SECTION = 'test';

export const BASELINE_LABEL = `${BASELINE_FILE} › ${BASELINE_SECTION}`;

/** `jterrazz-check(no-unused-ground)` → `jterrazz-check/no-unused-ground`. */
export function keyOf(printedRule: string): string {
    const match = /^(?<plugin>[\w-]+)\((?<rule>[^)]+)\)$/u.exec(printedRule);
    return match?.groups === undefined
        ? printedRule
        : `${match.groups.plugin}/${match.groups.rule}`;
}

export function countsOf(printedRules: readonly string[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const printedRule of printedRules) {
        const key = keyOf(printedRule);
        counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
}

const RATCHET_READ = 'docs/19-linting.md#the-ratchet-the-test-section-of-jterrazzbaselinejson';

const RECORD =
    "fix the findings, or run 'jterrazz-test-check baseline' to record where the project stands";

const RE_RECORD = "run 'jterrazz-test-check --fix' (make fix), which re-records the fall";

const EXACT =
    'the count is held exactly, so no finding arrives unseen, and slack left in an entry would let one arrive';

export function judge(
    counts: Readonly<Record<string, number>>,
    baseline: Readonly<Record<string, number>>,
): string[] {
    const broken: string[] = [];
    for (const [key, count] of Object.entries(counts).toSorted(([a], [b]) => (a < b ? -1 : 1))) {
        const allowed = baseline[key];
        if (allowed === undefined) {
            broken.push(
                lessonLine({
                    fix: RECORD,
                    found: `${key} has ${count} finding(s) and no entry`,
                    read: RATCHET_READ,
                    why: 'the section holds the debt the project recorded, rule by rule, and a rule it never recorded is new debt',
                }),
            );
        } else if (count > allowed) {
            broken.push(
                lessonLine({
                    fix: RECORD,
                    found: `${key} is at ${count}, above its baseline of ${allowed}`,
                    read: RATCHET_READ,
                    why: EXACT,
                }),
            );
        } else if (count < allowed) {
            broken.push(
                lessonLine({
                    fix: RE_RECORD,
                    found: `${key} is at ${count}, below its baseline of ${allowed}`,
                    read: RATCHET_READ,
                    why: EXACT,
                }),
            );
        }
    }
    for (const key of Object.keys(baseline).toSorted()) {
        // The run judges the routes it measured; the checker never counts them.
        if (key === ROUTES_KEY) {
            continue;
        }
        if ((counts[key] ?? 0) === 0) {
            broken.push(
                lessonLine({
                    fix: "run 'jterrazz-test-check --fix' (make fix), which drops the entry",
                    found: `${key} is at zero, and its entry is still held`,
                    read: RATCHET_READ,
                    why: EXACT,
                }),
            );
        }
    }
    return broken;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `undefined` when absent, `null` when it holds no JSON object. */
function sectionsAt(root: string): null | Record<string, unknown> | undefined {
    const path = join(root, BASELINE_FILE);
    if (!existsSync(path)) {
        return undefined;
    }
    try {
        const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
        return isRecord(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

/** A file that is no JSON object counts too: every finding then reads as new debt rather than passing. */
export function keepsBaseline(root: string): boolean {
    const sections = sectionsAt(root);
    return sections === null || (sections !== undefined && BASELINE_SECTION in sections);
}

export function readBaseline(root: string): Record<string, number> {
    const section = sectionsAt(root)?.[BASELINE_SECTION];
    return typeof section === 'object' && section !== null
        ? Object.fromEntries(
              Object.entries(section).filter(
                  (entry): entry is [string, number] => typeof entry[1] === 'number',
              ),
          )
        : {};
}

type MemberSpan = { key: string; valueEnd: number; valueStart: number };

function stringEnd(text: string, start: number): number {
    let index = start + 1;
    while (index < text.length && text[index] !== '"') {
        index += text[index] === '\\' ? 2 : 1;
    }
    return index + 1;
}

function valueEnd(text: string, start: number): number {
    let depth = 0;
    let index = start;
    while (index < text.length) {
        const char = text[index] ?? '';
        if (char === '"') {
            index = stringEnd(text, index);
            continue;
        }
        if (char === '{' || char === '[') {
            depth += 1;
        } else if (char === '}' || char === ']') {
            if (depth === 0) {
                break;
            }
            depth -= 1;
        } else if (char === ',' && depth === 0) {
            break;
        }
        index += 1;
    }
    return text.slice(0, index).trimEnd().length;
}

function membersOf(text: string): MemberSpan[] {
    const members: MemberSpan[] = [];
    let index = text.indexOf('{') + 1;
    for (;;) {
        const keyStart = text.indexOf('"', index);
        const close = text.indexOf('}', index);
        if (keyStart === -1 || (close !== -1 && close < keyStart)) {
            return members;
        }
        const keyEnd = stringEnd(text, keyStart);
        const key = String(JSON.parse(text.slice(keyStart, keyEnd)));
        const colon = text.indexOf(':', keyEnd);
        const start =
            colon + 1 + (text.slice(colon + 1).length - text.slice(colon + 1).trimStart().length);
        const end = valueEnd(text, start);
        members.push({ key, valueEnd: end, valueStart: start });
        const next = text.indexOf(',', end);
        const closing = text.indexOf('}', end);
        if (next === -1 || (closing !== -1 && closing < next)) {
            return members;
        }
        index = next + 1;
    }
}

/** Sorted, so a diff reads as a burn-down; every other section keeps its bytes. */
export function writeBaseline(root: string, counts: Readonly<Record<string, number>>): void {
    const held = readBaseline(root)[ROUTES_KEY];
    const kept = held === undefined ? counts : { ...counts, [ROUTES_KEY]: held };
    const sorted = Object.fromEntries(
        Object.entries(kept).toSorted(([a], [b]) => (a < b ? -1 : 1)),
    );
    const section = JSON.stringify(sorted, null, 4).replaceAll('\n', '\n    ');
    const path = join(root, BASELINE_FILE);
    const fresh = `{\n    "${BASELINE_SECTION}": ${section}\n}\n`;
    const sections = sectionsAt(root);
    if (sections === undefined) {
        writeFileSync(path, fresh);
        return;
    }
    if (sections === null) {
        throw new Error(
            `${BASELINE_FILE} holds no JSON object — mend it before recording, or its other sections would be lost`,
        );
    }
    const text = readFileSync(path, 'utf8');
    const members = membersOf(text);
    const own = members.find((member) => member.key === BASELINE_SECTION);
    const last = members.at(-1);
    if (own !== undefined) {
        writeFileSync(
            path,
            `${text.slice(0, own.valueStart)}${section}${text.slice(own.valueEnd)}`,
        );
    } else if (last === undefined) {
        writeFileSync(path, fresh);
    } else {
        writeFileSync(
            path,
            `${text.slice(0, last.valueEnd)},\n    "${BASELINE_SECTION}": ${section}${text.slice(last.valueEnd)}`,
        );
    }
}
