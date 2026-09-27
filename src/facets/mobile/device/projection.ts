import { refusal } from '../../../../lint/index.refusal.js';
import type { DeviceScreen, ScreenNode } from './device.port.js';

/** React Native wraps views in unlabeled `Other` nodes and elements repeat as their own children: nodes with no label, value or identifier are dropped and their children hoisted. */

type RawNode = {
    attributes: Record<string, string>;
    children: RawNode[];
    tag: string;
};

const TAG_PATTERN =
    /<(?<openTag>[A-Za-z][\w.]*)(?<rawAttributes>(?:\s+[\w:.-]+="[^"]*")*)\s*(?<selfClosing>\/?)>|<\/(?<closeTag>[\w.]*)\s*>/gu;
const ATTRIBUTE_PATTERN = /(?<key>[\w:.-]+)="(?<value>[^"]*)"/gu;

const NAMED_ENTITIES: Record<string, string> = {
    '&amp;': '&',
    '&apos;': "'",
    '&gt;': '>',
    '&lt;': '<',
    '&quot;': '"',
};

function decodeEntities(value: string): string {
    return value.replaceAll(
        /&(?:#x(?<hex>[\dA-Fa-f]+)|#(?<decimal>\d+)|(?<named>amp|apos|gt|lt|quot));/gu,
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
        const parent = stack.at(-1);
        if (parent === undefined) {
            root = node;
        } else {
            parent.children.push(node);
        }
        if (!selfClosing) {
            stack.push(node);
        }
    }

    if (!root) {
        throw new Error(
            refusal({
                fix: 'restart the Appium server, or upgrade Appium and its XCUITest driver',
                found: 'the page source Appium answered holds no XML element',
                read: 'docs/09-mobile.md#requirements--what-the-machine-must-have',
                why: 'A screen is read from the XML page source Appium answers.',
            }),
        );
    }
    return root;
}

function substance(node: RawNode): Omit<ScreenNode, 'children'> {
    const label = node.attributes.label || undefined;
    const value = node.attributes.value || undefined;
    const identifier = node.attributes.name || undefined;
    return {
        type: node.tag.replace(/^XCUIElementType/u, ''),
        ...(label === undefined ? {} : { label }),
        // A value or identifier echoing the label is XCUITest noise.
        ...(value === undefined || value === label ? {} : { value }),
        ...(identifier === undefined || identifier === label ? {} : { identifier }),
    };
}

function hasSubstance(node: Omit<ScreenNode, 'children'>): boolean {
    return node.label !== undefined || node.value !== undefined || node.identifier !== undefined;
}

function repeatsParent(child: ScreenNode, parent: Omit<ScreenNode, 'children'>): boolean {
    return (
        child.children === undefined &&
        child.type === parent.type &&
        child.label === parent.label &&
        child.value === parent.value &&
        child.identifier === parent.identifier
    );
}

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

function collectTexts(node: RawNode, texts: string[]): void {
    if (node.attributes.visible === 'true') {
        const text = node.attributes.label || node.attributes.value || undefined;
        if (text !== undefined && texts.at(-1) !== text) {
            texts.push(text);
        }
    }
    for (const child of node.children) {
        collectTexts(child, texts);
    }
}

export function projectScreen(xml: string): DeviceScreen {
    let root = parsePageSource(xml);
    // The page source wraps the application in an `AppiumAUT` envelope.
    const [onlyChild] = root.children;
    if (root.tag === 'AppiumAUT' && root.children.length === 1 && onlyChild !== undefined) {
        root = onlyChild;
    }

    // The app's own label is chrome, not screen content.
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
