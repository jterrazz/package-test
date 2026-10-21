/** `JSON.parse` answers `any`: these read a parsed value field by field, and a field of another shape reads as absent. */

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function recordAt(value: unknown, key: string): Record<string, unknown> {
    const field = isRecord(value) ? value[key] : undefined;
    return isRecord(field) ? field : {};
}

export function stringsAt(value: unknown, key: string): Record<string, string> {
    return Object.fromEntries(
        Object.entries(recordAt(value, key)).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
    );
}

export function stringListAt(value: unknown, key: string): string[] {
    const field = isRecord(value) ? value[key] : undefined;
    return Array.isArray(field)
        ? field.filter((item): item is string => typeof item === 'string')
        : [];
}

/** What a text that is no JSON stands for is the caller's to say. */
export function parsedJson(text: string, otherwise: unknown): unknown {
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return otherwise;
    }
}
