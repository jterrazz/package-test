import { StaleElementError } from './stale-element-error.js';

export type ElementType = 'Button' | 'Other' | 'SecureTextField' | 'StaticText' | 'TextField';

export type ScreenElement = {
    children?: ScreenElement[];
    identifier?: string;
    label?: string;
    offscreen?: boolean;
    rows?: { failure: string; field: string; path: string };
    tap?: string;
    type: ElementType;
    value?: string;
};

export type ScriptedApp = {
    bundleId: string;
    launch: string;
    name: string;
    scheme: string;
    screens: Record<string, ScreenElement[]>;
};

export type Mounted = {
    children: Mounted[];
    id: string;
    identifier?: string;
    label?: string;
    source: ScreenElement;
    type: 'Application' | 'Window' | ElementType;
    value?: string;
    visible: boolean;
};

const SECRET = '•';

export class RunningApp {
    private readonly fields = new Map<string, string>();
    private mounted = new Map<string, Mounted>();
    private nextId = 0;
    private params = new URLSearchParams();
    private root: Mounted | undefined;

    private readonly app: ScriptedApp;

    constructor(app: ScriptedApp) {
        this.app = app;
    }

    descendants(of?: Mounted): Mounted[] {
        const start = of ?? this.root;
        if (start === undefined) {
            return [];
        }
        const found: Mounted[] = [];
        for (const child of start.children) {
            found.push(child, ...this.descendants(child));
        }
        return found;
    }

    element(id: string): Mounted {
        const found = this.mounted.get(id);
        if (found === undefined) {
            throw new StaleElementError(`element ${id} is no longer attached to the screen`);
        }
        return found;
    }

    type(element: Mounted, text: string): void {
        this.setField(element, (this.fieldValue(element) ?? '') + text);
    }

    clear(element: Mounted): void {
        this.setField(element, '');
    }

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
        const children = await Promise.all(
            (element.children ?? []).map(async (child) => await this.render(child)),
        );
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

    private async rows(
        owner: ScreenElement,
        rows: NonNullable<ScreenElement['rows']>,
    ): Promise<Mounted[]> {
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
            const items: unknown = await response.json();
            if (!Array.isArray(items)) {
                return failure();
            }
            return items.map((item: unknown) => {
                const label = fieldOf(item, rows.field);
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
        const drawn = await Promise.all(
            elements.map(async (element) => await this.render(element)),
        );
        const window = this.mount({ type: 'Other' }, 'Window', drawn);
        this.root = this.mount({ type: 'Other' }, 'Application', [window], {
            label: this.app.name,
        });
    }
}

function fieldOf(item: unknown, field: string): string {
    const value: unknown =
        typeof item === 'object' && item !== null ? Reflect.get(item, field) : undefined;
    return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function displayed(element: ScreenElement, typed: string | undefined): string | undefined {
    if (typed === undefined || typed === '') {
        return element.value;
    }
    return element.type === 'SecureTextField' ? SECRET.repeat(typed.length) : typed;
}

function escapeXml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

export function nameOf(node: Mounted): string | undefined {
    return node.identifier ?? node.label;
}

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
