import { refusal } from '../../../chain/refusals/refusal.js';
import type { DeviceScreen, ScreenNode } from './device.port.js';

/** React Native wraps views in unlabeled `Other` nodes and elements repeat as their own children: nodes with no label, value or identifier are dropped and their children hoisted. */

type RawNode = {
    attributes: Record<string, string>;
    children: RawNode[];
    tag: string;
};

const TAG_PATTERN =
    /<(?<openTag>[A-Za-z][\w.]*)(?<rawAttributes>(?:\s+[\w:.-]+="[^"]*")*)\s*(?<selfClosing>\/?)>|<\/[\w.]*\s*>/gu;
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
            if (hex !== undefined) {
                return String.fromCodePoint(Number.parseInt(hex, 16));
            }
            if (decimal !== undefined) {
                return String.fromCodePoint(Number(decimal));
            }
            return NAMED_ENTITIES[entity] ?? entity;
        },
    );
}

function attributesOf(raw: string): Record<string, string> {
    return Object.fromEntries(
        [...raw.matchAll(ATTRIBUTE_PATTERN)].map(([, key, value]) => [
            String(key),
            decodeEntities(String(value)),
        ]),
    );
}

function parsePageSource(xml: string): RawNode {
    const stack: RawNode[] = [];
    let root: null | RawNode = null;

    for (const match of xml.matchAll(TAG_PATTERN)) {
        const { openTag, rawAttributes, selfClosing } = match.groups ?? {};
        if (openTag === undefined) {
            stack.pop();
            continue;
        }
        const node: RawNode = {
            attributes: attributesOf(String(rawAttributes)),
            children: [],
            tag: openTag,
        };
        const parent = stack.at(-1);
        if (parent === undefined) {
            root = node;
        } else {
            parent.children.push(node);
        }
        if (selfClosing !== '/') {
            stack.push(node);
        }
    }

    if (!root) {
        throw new Error(
            refusal({
                fix: 'restart the Appium server, or upgrade Appium and its XCUITest driver',
                found: 'the page source Appium answered holds no XML element',
                read: 'docs/11-mobile.md#requirements--what-the-machine-must-have',
                why: 'A screen is read from the XML page source Appium answers.',
            }),
        );
    }
    return root;
}

const present = (attribute: string | undefined): string | undefined =>
    attribute === '' ? undefined : attribute;

function substance(node: RawNode): Omit<ScreenNode, 'children'> {
    const label = present(node.attributes.label);
    const value = present(node.attributes.value);
    const identifier = present(node.attributes.name);
    return {
        // Stryker disable next-line Regex: an XCUITest tag names its type once, at its start
        type: node.tag.replace(/^XCUIElementType/u, ''),
        ...(label === undefined ? {} : { label }),
        // outside: a value or identifier echoing the label is XCUITest noise.
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
        const text = present(node.attributes.label) ?? present(node.attributes.value);
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
    // outside: the page source wraps the application in an `AppiumAUT` envelope.
    const [onlyChild, ...others] = root.children;
    if (root.tag === 'AppiumAUT' && onlyChild !== undefined && others.length === 0) {
        root = onlyChild;
    }

    // invariant: the app's own label is chrome, not screen content.
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
