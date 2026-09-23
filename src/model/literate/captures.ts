/**
 * The named captures of a journey: a value read from one step's response body,
 * sent by a later step wherever it writes `{{name}}`.
 *
 * Two pure functions and no state — the grammar already refused a name sent
 * before a step captured it, so here a name is always known.
 */

/** A path's segments below `$`: an object key, or an array index. */
export type JsonPathSegments = readonly (number | string)[];

/**
 * The value `segments` reach in `body`, or `undefined` when a segment finds
 * nothing — a key the object lacks, an index past the array, a scalar
 * descended into.
 */
export function readJsonPath(body: unknown, segments: JsonPathSegments): unknown {
    let current: unknown = body;
    for (const segment of segments) {
        if (typeof segment === 'number') {
            if (!Array.isArray(current)) {
                return undefined;
            }
            current = current[segment];
            continue;
        }
        if (current === null || typeof current !== 'object' || Array.isArray(current)) {
            return undefined;
        }
        current = Object.getOwnPropertyDescriptor(current, segment)?.value as unknown;
    }
    return current;
}

/** A string that is ONE reference and nothing else — it sends the value, typed. */
const WHOLE = /^\{\{(?<name>[A-Za-z][A-Za-z0-9_]*)\}\}$/u;

/** A reference inside a longer string — it sends the value's text. */
const INSIDE = /\{\{(?<name>[A-Za-z][A-Za-z0-9_]*)\}\}/gu;

/** How a captured value reads spliced into text: a string as is, anything else as JSON. */
function textOf(value: unknown): string {
    return typeof value === 'string' ? value : JSON.stringify(value);
}

/** `text` with every `{{name}}` spliced in as the captured value's text — a request line, a header. */
export function spliceCaptures(text: string, captured: ReadonlyMap<string, unknown>): string {
    return text.replaceAll(INSIDE, (reference, name: string) =>
        captured.has(name) ? textOf(captured.get(name)) : reference,
    );
}

/**
 * `value` with every `{{name}}` replaced by what `captured` holds under that
 * name, at any depth. A string that is exactly one reference becomes the
 * captured value itself, so a captured number is sent as a number; a reference
 * inside a longer string is spliced in as text.
 */
export function withCaptures(value: unknown, captured: ReadonlyMap<string, unknown>): unknown {
    if (typeof value === 'string') {
        const whole = WHOLE.exec(value)?.groups?.name;
        if (whole !== undefined && captured.has(whole)) {
            return captured.get(whole);
        }
        return spliceCaptures(value, captured);
    }
    if (Array.isArray(value)) {
        return value.map((item) => withCaptures(item, captured));
    }
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, withCaptures(item, captured)]),
        );
    }
    return value;
}
