export function nothing(value?: string): string {
    return value ?? 'nothing';
}

export const empty = nothing(undefined);
