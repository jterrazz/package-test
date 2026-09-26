import type { ElementRef } from './element.js';

export const CONSTRUCTORS: Record<ElementRef['kind'], string> = {
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
export function asWritten(element: ElementRef): string {
    const bare = asWrittenUnscoped(element);
    return element.scope ? `within(${asWritten(element.scope)}, ${bare})` : bare;
}

export function asWrittenUnscoped(element: ElementRef): string {
    const args: string[] = [];
    if (element.name !== undefined) {
        args.push(JSON.stringify(element.name));
    }
    if (element.exact !== undefined) {
        args.push(`{ exact: ${String(element.exact)} }`);
    }
    return `${CONSTRUCTORS[element.kind]}(${args.join(', ')})`;
}
