import type { DeviceScreen, ScreenNode } from '../../ports/device.port.js';

/**
 * The screen projection — XCUITest page source → {@link ScreenNode} tree.
 *
 * A raw page source is deep and noisy: React Native wraps every view in
 * layers of unlabeled `XCUIElementTypeOther` nodes, and accessibility
 * elements repeat themselves as their own children. The projection collapses
 * that noise into the tree a golden can carry: nodes with no label, no value
 * and no identifier are dropped and their children hoisted; a child that
 * merely repeats its parent disappears; type names lose the
 * `XCUIElementType` prefix. Pure string-in/data-out, so the shape is
 * unit-testable and the device integration stays a thin adapter.
 */

/** One parsed XML element — tag, attributes, children (page sources carry no text nodes). */
interface RawNode {
    attributes: Record<string, string>;
    children: RawNode[];
    tag: string;
}

const TAG_PATTERN =
    /<(?<openTag>[A-Za-z][\w.]*)(?<rawAttributes>(?:\s+[\w:.-]+="[^"]*")*)\s*(?<selfClosing>\/?)>|<\/(?<closeTag>[\w.]*)\s*>/g;
const ATTRIBUTE_PATTERN = /(?<key>[\w:.-]+)="(?<value>[^"]*)"/g;

const NAMED_ENTITIES: Record<string, string> = {
    '&amp;': '&',
    '&apos;': "'",
    '&gt;': '>',
    '&lt;': '<',
    '&quot;': '"',
};

/** Decode the XML entities an attribute value can carry. */
function decodeEntities(value: string): string {
    return value.replace(
        /&(?:#x(?<hex>[\dA-Fa-f]+)|#(?<decimal>\d+)|(?<named>amp|apos|gt|lt|quot));/g,
        (entity, hex: string | undefined, decimal: string | undefined) => {
            if (hex) {
                return String.fromCodePoint(Number.parseInt(hex, 16));
            }
            if (decimal) {
                return String.fromCodePoint(Number(decimal));
            }
            return NAMED_ENTITIES[entity] ?? entity;
        },
    );
}

/** Parse the page source into a raw element tree (strict, attribute-only XML). */
function parsePageSource(xml: string): RawNode {
    const stack: RawNode[] = [];
    let root: null | RawNode = null;

    for (const match of xml.matchAll(TAG_PATTERN)) {
        const { closeTag, openTag, rawAttributes, selfClosing } = match.groups ?? {};
        if (closeTag !== undefined || openTag === undefined) {
            stack.pop();
            continue;
        }
        const attributes: Record<string, string> = {};
        for (const attribute of (rawAttributes ?? '').matchAll(ATTRIBUTE_PATTERN)) {
            const { key, value } = attribute.groups ?? {};
            if (key !== undefined && value !== undefined) {
                attributes[key] = decodeEntities(value);
            }
        }
        const node: RawNode = { attributes, children: [], tag: openTag };
        if (stack.length === 0) {
            root = node;
        } else {
            stack[stack.length - 1].children.push(node);
        }
        if (!selfClosing) {
            stack.push(node);
        }
    }

    if (!root) {
        throw new Error('projectScreen(): the page source contains no XML element');
    }
    return root;
}

/** The substance of a node — what survives projection, or nothing. */
function substance(node: RawNode): Omit<ScreenNode, 'children'> {
    const label = node.attributes['label'] || undefined;
    const value = node.attributes['value'] || undefined;
    const identifier = node.attributes['name'] || undefined;
    return {
        type: node.tag.replace(/^XCUIElementType/, ''),
        ...(label === undefined ? {} : { label }),
        // A value or identifier merely echoing the label is XCUITest noise.
        ...(value === undefined || value === label ? {} : { value }),
        ...(identifier === undefined || identifier === label ? {} : { identifier }),
    };
}

function hasSubstance(node: Omit<ScreenNode, 'children'>): boolean {
    return node.label !== undefined || node.value !== undefined || node.identifier !== undefined;
}

/** A childless child that repeats its parent is the same accessibility element twice. */
function repeatsParent(child: ScreenNode, parent: Omit<ScreenNode, 'children'>): boolean {
    return (
        child.children === undefined &&
        child.type === parent.type &&
        child.label === parent.label &&
        child.value === parent.value &&
        child.identifier === parent.identifier
    );
}

/** Project one raw node: a kept node, or (hoisting) the projections of its children. */
function projectNode(node: RawNode): ScreenNode[] {
    const own = substance(node);
    const children = node.children
        .flatMap((child) => projectNode(child))
        .filter((child) => !repeatsParent(child, own));

    if (!hasSubstance(own)) {
        return children;
    }
    return [{ ...own, ...(children.length > 0 ? { children } : {}) }];
}

/** Collect the visible texts in document order, collapsing consecutive repeats. */
function collectTexts(node: RawNode, texts: string[]): void {
    if (node.attributes['visible'] === 'true') {
        const text = node.attributes['label'] || node.attributes['value'] || undefined;
        if (text !== undefined && texts[texts.length - 1] !== text) {
            texts.push(text);
        }
    }
    for (const child of node.children) {
        collectTexts(child, texts);
    }
}

/**
 * Project a raw XCUITest page source into the captured screen: the collapsed
 * tree (rooted at the application node, which is always kept) and the
 * visible texts in document order.
 */
export function projectScreen(xml: string): DeviceScreen {
    let root = parsePageSource(xml);
    // The page source wraps the application in an `AppiumAUT` envelope.
    if (root.tag === 'AppiumAUT' && root.children.length === 1) {
        root = root.children[0];
    }

    // Texts start below the application node — the app's own label is chrome,
    // Not screen content.
    const texts: string[] = [];
    for (const child of root.children) {
        collectTexts(child, texts);
    }

    const own = substance(root);
    const children = root.children
        .flatMap((child) => projectNode(child))
        .filter((child) => !repeatsParent(child, own));
    const tree: ScreenNode = { ...own, ...(children.length > 0 ? { children } : {}) };

    return { texts, tree };
}
