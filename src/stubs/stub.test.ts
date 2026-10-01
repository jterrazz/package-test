import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { STUB_KINDS } from '../../lint/engine/project/stub-kinds.js';
import {
    anthropic as publishedAnthropic,
    http as publishedHttp,
    openai as publishedOpenai,
} from '../index.js';
import { anthropic } from './kinds/anthropic.js';
import { http } from './kinds/http.js';
import { defineStub, defineStubs } from './stub.js';
import type { Stub } from './stub.js';

function route(method: 'GET' | 'POST', url: RegExp | string, tag: string): Stub {
    return {
        request: method === 'GET' ? http.get(url) : http.post(url),
        response: http.json({ tag }),
    };
}

function tagsOf(stubs: readonly Stub[]): string[] {
    return stubs.map((stub) => {
        const response = stub.response as { body: { tag: string } };
        return response.body.tag;
    });
}

async function builderModules(): Promise<string[]> {
    const named = readdirSync(join(import.meta.dirname, 'kinds'))
        .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
        .map((file) => file.replace(/\.ts$/u, ''));
    const builders = await Promise.all(
        named.map(async (name) => {
            const loaded: unknown = await import(`./kinds/${name}.ts`);
            return typeof loaded === 'object' && loaded !== null && name in loaded ? [name] : [];
        }),
    );
    return builders.flat();
}

describe('stub', () => {
    test('stubs — defineStub — accepts a dynamic response function of the request', () => {
        // Given - a stub whose response derives from the observed request
        const stub = defineStub({
            request: anthropic.messages(),
            response: (request) => {
                const body = request.body as { q: string };
                return anthropic.reply(`echo:${body.q}`);
            },
        });

        // Then - the response is stored as the function, evaluable per request, and the produced reply echoes the observed request into the envelope
        expect(stub.response).toBeTypeOf('function');
        const produced =
            typeof stub.response === 'function'
                ? stub.response({
                      body: { q: 'hi' },
                      headers: {},
                      method: 'POST',
                      url: 'https://x.test/',
                  })
                : stub.response;
        const { content } = produced.body as { content: { text: string }[] };
        expect(content[0]?.text).toBe('echo:hi');
    });

    test('stubs — defineStubs composition — flattens stubs, lists, and other composites, order preserved', () => {
        // Given - a composite built from a stub, a list, and a composite
        const base = defineStubs(route('GET', '/a', 'a'));
        const composite = defineStubs(
            base,
            [route('GET', '/b', 'b'), route('GET', '/c', 'c')],
            route('GET', '/d', 'd'),
        );

        // Then - one flat ordered list, stubs all the way down
        expect(tagsOf(composite.stubs)).toStrictEqual(['a', 'b', 'c', 'd']);
    });

    test('stubs — defineStubs composition — .with() replaces same-route stubs and prepends the overrides', () => {
        // Given - a two-route world and an override on one of them
        const base = defineStubs(route('GET', '/events', 'events'), route('GET', '/a', 'a'));

        // When - a scenario overrides the /events route
        const scenario = base.with(route('GET', '/events', 'events-empty'));

        // Then - the base entry is gone and the override leads the list
        expect(tagsOf(scenario.stubs)).toStrictEqual(['events-empty', 'a']);
    });

    test('stubs — defineStubs composition — .with() keeps a generic route but the more specific override wins first-match', () => {
        // Given - a generic token route, overridden by a concrete path
        const base = defineStubs(route('GET', '/articles/{{uuid}}', 'generic'));

        // When - the scenario states one article behaves differently
        const scenario = base.with(route('GET', '/articles/a-1', 'gone'));

        // Then - both survive; the specific one is selected first
        expect(tagsOf(scenario.stubs)).toStrictEqual(['gone', 'generic']);
    });

    test('stubs — defineStubs composition — same-route is method + declared url source, RegExp compared by source', () => {
        // Given - one route declared as a RegExp, plus a same-url POST
        const base = defineStubs(
            route('GET', /articles\/\d+/u, 'get-re'),
            route('POST', /articles\/\d+/u, 'post-re'),
        );

        // When - an override reuses an equal (but not identical) RegExp on GET
        const scenario = base.with(route('GET', /articles\/\d+/u, 'override'));

        // Then - only the GET was replaced; the POST on the same url stays
        expect(tagsOf(scenario.stubs)).toStrictEqual(['override', 'post-re']);
    });

    test('stubs — defineStubs composition — .with() is immutable — the base composite is untouched', () => {
        // Given - a base composite
        const base = defineStubs(route('GET', '/events', 'events'));

        // When - a scenario derives from it
        const scenario = base.with(route('GET', '/events', 'other'));

        // Then - the base still declares its own world, and composites nest
        expect(tagsOf(base.stubs)).toStrictEqual(['events']);
        const nested = scenario.with(route('GET', '/x', 'x'));
        expect(tagsOf(nested.stubs)).toStrictEqual(['x', 'other']);
    });

    test('stub kinds — the builders a stub folder is named for — names every builder module of `kinds/`, each a builder its entry exports', async () => {
        // Given - the modules under src/stubs/kinds/ exporting the builder they are named for, and the builders the entry exports
        const modules = await builderModules();
        const exported: Record<string, unknown> = {
            anthropic: publishedAnthropic,
            http: publishedHttp,
            openai: publishedOpenai,
        };

        // Then - one kind per builder module, and each kind is a builder the entry publishes
        expect(STUB_KINDS).toStrictEqual(modules.toSorted());
        expect(STUB_KINDS.map((kind) => typeof exported[kind])).toStrictEqual([
            'object',
            'object',
            'object',
        ]);
    });
});
