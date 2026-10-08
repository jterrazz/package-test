import { nameOf, RunningApp } from './app.js';
import type { Mounted, ScriptedApp } from './app.js';
import { InvalidSelectorError } from './invalid-selector-error.js';
import { compilePredicate } from './predicate.js';
import { ProtocolError } from './protocol-error.js';

export type Json = Record<string, unknown>;

const ELEMENT_KEY = 'element-6066-11e4-a23f-4f71c9fb7e65';

export function isJson(value: unknown): value is Json {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function predicateAttributes(node: Mounted): Record<string, string | undefined> {
    return {
        label: node.label ?? '',
        name: nameOf(node) ?? '',
        type: `XCUIElementType${node.type}`,
        value: node.value ?? '',
        visible: node.visible ? '1' : '0',
    };
}

function firstArgument(body: Json): Json | undefined {
    const { args } = body;
    const argument: unknown = Array.isArray(args) ? args[0] : undefined;
    return isJson(argument) ? argument : undefined;
}

export class Session {
    readonly app: RunningApp;

    private readonly scripted: ScriptedApp;

    constructor(scripted: ScriptedApp) {
        this.scripted = scripted;
        this.app = new RunningApp(scripted);
    }

    async execute(body: Json): Promise<unknown> {
        const script = String(body.script);
        const argument = firstArgument(body);
        switch (script) {
            case 'mobile: terminateApp': {
                this.app.terminate();
                return true;
            }
            case 'mobile: activateApp': {
                this.bundle(argument);
                await this.app.launch();
                return null;
            }
            case 'mobile: deepLink': {
                this.bundle(argument);
                this.app.terminate();
                await this.app.deepLink(String(argument?.url));
                return null;
            }
            case 'mobile: scrollToElement': {
                this.app.element(String(argument?.elementId)).visible = true;
                return null;
            }
            case 'mobile: scroll': {
                // outside: what WebDriverAgent answers `toVisible` with on a SwiftUI
                // scroll view, as a simulator run met it.
                throw new ProtocolError(
                    'unknown error',
                    500,
                    'Failed to perform scroll with visible cell due to max scroll count reached',
                );
            }
            default: {
                throw new ProtocolError('unknown command', 404, `unsupported script: ${script}`);
            }
        }
    }

    elementsMatching(body: Json, scope?: Mounted): Json[] {
        if (body.using !== '-ios predicate string') {
            throw new ProtocolError(
                'invalid selector',
                400,
                `locator strategy '${String(body.using)}' is not one the double answers`,
            );
        }
        let predicate;
        try {
            predicate = compilePredicate(String(body.value));
        } catch (error) {
            if (error instanceof InvalidSelectorError) {
                throw new ProtocolError('invalid selector', 400, error.message);
            }
            throw error;
        }
        return this.app
            .descendants(scope)
            .filter((node) => predicate(predicateAttributes(node)))
            .map((node) => ({ ELEMENT: node.id, [ELEMENT_KEY]: node.id }));
    }

    private bundle(argument: Json | undefined): void {
        if (argument?.bundleId !== this.scripted.bundleId) {
            throw new ProtocolError(
                'unknown error',
                500,
                `app with bundle identifier '${String(argument?.bundleId)}' is not installed`,
            );
        }
    }
}
