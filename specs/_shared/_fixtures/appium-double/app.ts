/**
 * A scripted app — a native app described as data, and the running instance
 * the protocol double drives.
 *
 * A screen is a small tree of elements, each with the accessibility traits
 * XCUITest publishes (type, label, value, identifier, visibility). A tap
 * moves to the screen a button names; a field keeps what was typed into it
 * until the app is terminated; a label may quote a field (`{email}`); a list
 * may fill its rows from the JSON the app GETs at the `api` its deep link
 * carries. That is all the behaviour a spec needs to script, and nothing more.
 */

/** The element types a scripted screen draws — XCUITest's, without the prefix. */
export type ElementType = 'Button' | 'Other' | 'SecureTextField' | 'StaticText' | 'TextField';

/** One element of a screen, as data. */
export type ScreenElement = {
    children?: ScreenElement[];
    /** The accessibility identifier — what `testId()` names. */
    identifier?: string;
    /** The accessible label; `{field}` quotes what was typed into that field. */
    label?: string;
    /** Mounted below the fold: absent from what is visible until scrolled to. */
    offscreen?: boolean;
    /** Rows read at render time: one `StaticText` per item of the JSON array at `<api><path>`, labelled by `field`. */
    rows?: { failure: string; field: string; path: string };
    /** The screen a tap on this element opens. */
    tap?: string;
    type: ElementType;
    /** A field's placeholder, shown as its value while it is empty. */
    value?: string;
};

/** A native app, as data. */
export type ScriptedApp = {
    bundleId: string;
    /** The screen a plain launch opens on. */
    launch: string;
    /** The app's display name — the application element's label. */
    name: string;
    /** The URL scheme its deep links use (`specimen` for `specimen://feed`). */
    scheme: string;
    screens: Record<string, ScreenElement[]>;
};

/** One mounted element: the data, resolved, with the id the protocol hands out. */
export type Mounted = {
    children: Mounted[];
    id: string;
    identifier?: string;
    label?: string;
    source: ScreenElement;
    type: ElementType | 'Application' | 'Window';
    value?: string;
    visible: boolean;
};

/** The error an element id no longer mounted answers with — the protocol's `stale element reference`. */
export class StaleElementError extends Error {}

const SECRET = '•';

/** A running instance of a scripted app: its screen, its fields, its mounted tree. */
export class RunningApp {
    private readonly fields = new Map<string, string>();
    private mounted = new Map<string, Mounted>();
    private nextId = 0;
    private params = new URLSearchParams();
    private root: Mounted | undefined;

    constructor(private readonly app: ScriptedApp) {}

    /** Every mounted element, in document order, the application excluded. */
    descendants(of?: Mounted): Mounted[] {
        const start = of ?? this.root;
        if (start === undefined) {
            return [];
        }
        return start.children.flatMap((child) => [child, ...this.descendants(child)]);
    }

    element(id: string): Mounted {
        const found = this.mounted.get(id);
        if (found === undefined) {
            throw new StaleElementError(`element ${id} is no longer attached to the screen`);
        }
        return found;
    }

    /** Type into a field, appending to what it holds. */
    type(element: Mounted, text: string): void {
        this.setField(element, (this.fieldValue(element) ?? '') + text);
    }

    clear(element: Mounted): void {
        this.setField(element, '');
    }

    /** Relaunch on a deep link: `<scheme>://<screen>?<params>`. */
    async deepLink(url: string): Promise<void> {
        const parsed = new URL(url);
        if (parsed.protocol !== `${this.app.scheme}:`) {
            throw new Error(`${this.app.name} does not handle ${parsed.protocol}// links`);
        }
        this.params = parsed.searchParams;
        await this.show(parsed.hostname);
    }

    async launch(): Promise<void> {
        this.params = new URLSearchParams();
        await this.show(this.app.launch);
    }

    scrollTo(element: Mounted): void {
        element.visible = true;
    }

    /** What the app draws, as the page source XCUITest publishes. */
    source(): string {
        return this.root === undefined
            ? '<?xml version="1.0" encoding="UTF-8"?><AppiumAUT></AppiumAUT>'
            : `<?xml version="1.0" encoding="UTF-8"?>\n<AppiumAUT>\n${xmlOf(this.root, 1)}</AppiumAUT>\n`;
    }

    async tap(element: Mounted): Promise<void> {
        if (element.source.tap !== undefined) {
            await this.show(element.source.tap);
        }
    }

    terminate(): void {
        this.fields.clear();
        this.mounted = new Map();
        this.root = undefined;
    }

    private fieldValue(element: Mounted): string | undefined {
        return element.identifier === undefined ? undefined : this.fields.get(element.identifier);
    }

    private labelOf(label: string | undefined): string | undefined {
        return label?.replaceAll(
            /\{(?<field>[\w-]+)\}/gu,
            (_whole, field: string) => this.fields.get(field) ?? '',
        );
    }

    private mount(
        source: ScreenElement,
        type: Mounted['type'],
        children: Mounted[],
        overrides: Partial<Mounted> = {},
    ): Mounted {
        this.nextId += 1;
        const node: Mounted = {
            children,
            id: `double-${this.nextId}`,
            source,
            type,
            visible: source.offscreen !== true,
            ...(source.identifier === undefined ? {} : { identifier: source.identifier }),
            ...overrides,
        };
        this.mounted.set(node.id, node);
        return node;
    }

    private async render(element: ScreenElement): Promise<Mounted> {
        const children = await Promise.all((element.children ?? []).map((child) => this.render(child)));
        if (element.rows !== undefined) {
            children.push(...(await this.rows(element, element.rows)));
        }
        const label = this.labelOf(element.label);
        const value = displayed(
            element,
            element.identifier === undefined ? undefined : this.fields.get(element.identifier),
        );
        return this.mount(element, element.type, children, {
            ...(label === undefined ? {} : { label }),
            ...(value === undefined ? {} : { value }),
        });
    }

    /** The rows a list reads from its api, or the one line saying it could not. */
    private async rows(owner: ScreenElement, rows: NonNullable<ScreenElement['rows']>): Promise<Mounted[]> {
        const failure = (): Mounted[] => [
            this.mount({ label: rows.failure, type: 'StaticText' }, 'StaticText', [], {
                label: rows.failure,
                visible: owner.offscreen !== true,
            }),
        ];
        const api = this.params.get('api');
        if (api === null) {
            return failure();
        }
        try {
            const response = await fetch(`${api}${rows.path}`);
            if (!response.ok) {
                return failure();
            }
            const items = (await response.json()) as Record<string, unknown>[];
            return items.map((item) => {
                const label = String(item[rows.field] ?? '');
                return this.mount({ label, type: 'StaticText' }, 'StaticText', [], { label });
            });
        } catch {
            return failure();
        }
    }

    private setField(element: Mounted, value: string): void {
        if (element.identifier === undefined || !element.type.endsWith('TextField')) {
            throw new Error(`element ${element.id} is not a text field`);
        }
        this.fields.set(element.identifier, value);
        const shown = displayed(element.source, value);
        if (shown === undefined) {
            delete element.value;
        } else {
            element.value = shown;
        }
    }

    private async show(screen: string): Promise<void> {
        const elements = this.app.screens[screen];
        if (elements === undefined) {
            throw new Error(`${this.app.name} has no screen '${screen}'`);
        }
        this.mounted = new Map();
        const drawn = await Promise.all(elements.map((element) => this.render(element)));
        const window = this.mount({ type: 'Other' }, 'Window', drawn);
        this.root = this.mount({ type: 'Other' }, 'Application', [window], {
            label: this.app.name,
        });
    }
}

/** The value a field shows: its placeholder while empty, bullets for a secret, else what was typed. */
function displayed(element: ScreenElement, typed: string | undefined): string | undefined {
    if (typed === undefined || typed === '') {
        return element.value;
    }
    return element.type === 'SecureTextField' ? SECRET.repeat(typed.length) : typed;
}

/** An attribute value, escaped for XML. */
function escapeXml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

/** XCUITest's `name`: the identifier, or the label when there is none. */
export function nameOf(node: Mounted): string | undefined {
    return node.identifier ?? node.label;
}

/** One mounted element and its subtree, as page-source XML. */
function xmlOf(node: Mounted, depth: number): string {
    const tag = `XCUIElementType${node.type}`;
    const attributes: [string, string | undefined][] = [
        ['type', tag],
        ['name', nameOf(node)],
        ['label', node.label],
        ['value', node.value],
        ['enabled', 'true'],
        ['visible', String(node.visible)],
    ];
    const written = attributes
        .filter((entry): entry is [string, string] => entry[1] !== undefined)
        .map(([key, value]) => ` ${key}="${escapeXml(value)}"`)
        .join('');
    const indent = '  '.repeat(depth);
    if (node.children.length === 0) {
        return `${indent}<${tag}${written}/>\n`;
    }
    const inner = node.children.map((child) => xmlOf(child, depth + 1)).join('');
    return `${indent}<${tag}${written}>\n${inner}${indent}</${tag}>\n`;
}
