import type { Target } from './target.js';

export const FUNCTION_NAME_OF_KIND: Record<Target['kind'], string> = {
    banner: 'banner',
    button: 'button',
    complementary: 'complementary',
    contentinfo: 'contentinfo',
    dialog: 'dialog',
    field: 'field',
    form: 'form',
    heading: 'heading',
    link: 'link',
    listitem: 'listitem',
    main: 'main',
    navigation: 'navigation',
    option: 'option',
    region: 'region',
    row: 'row',
    search: 'search',
    status: 'status',
    table: 'table',
    testId: 'testId',
    text: 'content',
};

/** Spoken in the vocabulary the author wrote, never playwright's: an option appears only when the author stated one. */
export function asWritten(target: Target): string {
    const bare = asWrittenUnscoped(target);
    return target.scope ? `within(${asWritten(target.scope)}, ${bare})` : bare;
}

export function asWrittenUnscoped(target: Target): string {
    const args: string[] = [];
    if (target.name !== undefined) {
        args.push(JSON.stringify(target.name));
    }
    if (target.exact !== undefined) {
        args.push(`{ exact: ${String(target.exact)} }`);
    }
    return `${FUNCTION_NAME_OF_KIND[target.kind]}(${args.join(', ')})`;
}
