import type { ElementRef } from './descriptor.js';

/**
 * How a descriptor is spelled in the vocabulary's own words — the source that
 * would build it. Every message that names an element speaks it: the
 * ambiguity refusal, and what each adapter says when an element is not gone,
 * not valued, not selected or not found in time.
 */

/** `kind` → the constructor that builds it, so errors echo the caller's source. */
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

/**
 * Render a descriptor as the source that would build it — `link('Articles')`,
 * `within(navigation(), link('Articles', { exact: false }))`. The error speaks
 * the vocabulary the author wrote, never playwright's — so the option appears
 * only when the AUTHOR stated one, whichever way.
 */
export function formatElement(element: ElementRef): string {
    const bare = formatBare(element);
    return element.scope ? `within(${formatElement(element.scope)}, ${bare})` : bare;
}

export function formatBare(element: ElementRef): string {
    const args: string[] = [];
    if (element.name !== undefined) {
        args.push(JSON.stringify(element.name));
    }
    if (element.exact !== undefined) {
        args.push(`{ exact: ${String(element.exact)} }`);
    }
    return `${CONSTRUCTORS[element.kind]}(${args.join(', ')})`;
}
