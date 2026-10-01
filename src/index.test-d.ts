/* oxlint-disable jterrazz/runner-in-specification-file, typescript/no-unsafe-call, typescript/no-unsafe-return, typescript/no-unsafe-type-assertion -- every line below is a call the compiler REFUSES, and its `@ts-expect-error` is the assertion: a refused call has no type, and no runner is constructed */
import { expect } from 'vitest';

import { directory, file, mockOf, postgres, specification } from './index.js';
import type { ComponentChain, ComponentVisitor, MobileVisitor, Visitor } from './index.js';

/** Each `@ts-expect-error` below is the assertion: `typescript check` fails the day the line compiles. */

type Mailer = { send: (to: string) => Promise<void> };

type Assert<Row extends true> = Row;

type Carries<Verbs, Verb extends string> = Verb extends keyof Verbs ? true : false;

// verb-belongs-to-its-facet — the verb set is the boundary between the facets; `goto` is the page's alone.
export type WebsiteGoes = Assert<Carries<Visitor, 'goto'>>;
export type MobileNeverGoes = Assert<Carries<MobileVisitor, 'goto'> extends false ? true : false>;
export type ComponentNeverGoes = Assert<
    Carries<ComponentVisitor, 'goto'> extends false ? true : false
>;

export type ComponentRerenders = Assert<Carries<ComponentVisitor, 'rerender'>>;
export type ComponentUnmounts = Assert<Carries<ComponentVisitor, 'unmount'>>;
export type WebsiteNeverRerenders = Assert<
    Carries<Visitor, 'rerender'> extends false ? true : false
>;
export type WebsiteNeverUnmounts = Assert<Carries<Visitor, 'unmount'> extends false ? true : false>;
export type MobileNeverRerenders = Assert<
    Carries<MobileVisitor, 'rerender'> extends false ? true : false
>;

export type WebsiteSeesAbsence = Assert<Carries<Visitor, 'gone'>>;
export type ComponentSeesAbsence = Assert<Carries<ComponentVisitor, 'gone'>>;
export type MobileNeverAsksAboutAbsence = Assert<
    Carries<MobileVisitor, 'gone'> extends false ? true : false
>;

export type ComponentSetsViewport = Assert<Carries<ComponentChain, 'viewport'>>;
export type ComponentSetsClock = Assert<Carries<ComponentChain, 'clock'>>;
export type ComponentIntercepts = Assert<Carries<ComponentChain, 'intercept'>>;
export type ComponentWraps = Assert<Carries<ComponentChain, 'wrap'>>;

export async function typeRows(): Promise<void> {
    await specification.api({
        server: (services) =>
            // @ts-expect-error server-sees-declared-services — `cache` is not a key of the services record [`Property 'cache' does not exist on type '{ db: PostgresHandle; }'`]
            services.cache,
        services: { db: postgres() },
    });

    await specification.website(
        // @ts-expect-error no-server-with-url — `server` and `url` are mutually exclusive [`Types of property 'url' are incompatible`]
        { server: { command: 'npm start' }, url: 'https://site.test' },
    );

    const { api } = await specification.api({ server: () => ({}) as never });
    const { cli } = await specification.cli('./bin.sh');
    await specification.cli('./bin.sh', { commands: ['db', 'migrate'] });

    // @ts-expect-error no-chain-label — a chain carries no label [`Property 'label' does not exist on type 'ApiSpecification<never>'`]
    api.label('the happy path');

    // @ts-expect-error disk-named-by-relative-path — a bare string is a value, not a file [`Argument of type 'string' is not assignable to parameter of type 'SeedSource'`]
    api.seed('./_seeds/x.sql');
    // @ts-expect-error disk-named-by-relative-path — a seed's path ends in `.sql` [`Type '"./_seeds/x.json"' is not assignable to type 'RelativePath<".sql">'`]
    api.seed(file('./_seeds/x.json'));
    // @ts-expect-error disk-named-by-relative-path — a path is relative to the spec file [`Argument of type '"x.sql"' is not assignable to parameter of type 'RelativePath<string>'`]
    api.seed(file('x.sql'));
    // @ts-expect-error disk-named-by-relative-path — SQL is never written in the test: a seed is a `.sql` file [`Argument of type 'string' is not assignable to parameter of type 'SeedSource'`]
    api.seed(`INSERT INTO users (name) VALUES ('Ada');`);
    // @ts-expect-error disk-named-by-relative-path — a directory's path ends in `/` [`Argument of type '"./_fixtures/shop"' is not assignable to parameter of type 'RelativePath<"/">'`]
    cli.fixture(directory('./_fixtures/shop'));
    // @ts-expect-error disk-named-by-relative-path — a path ending in `/` is a directory [`Argument of type '"./_fixtures/shop/"' is not assignable to parameter of type 'never'`]
    cli.fixture(file('./_fixtures/shop/'));
    // @ts-expect-error disk-named-by-relative-path — a request is one `.http` file, not a directory [`is not assignable to parameter of type 'string | DiskFile<".http">'`]
    await api.request(directory('./_requests/'));
    // @ts-expect-error disk-named-by-relative-path — a document is a `.spec.yaml` file [`Argument of type 'FileAt<"./case.yaml">' is not assignable to parameter of type 'DiskFile<".spec.yaml">'`]
    await cli.run(file('./case.yaml'));
    // @ts-expect-error disk-named-by-relative-path — a path is a value where a verb takes one [`Argument of type 'FileAt<"./_requests/orders.http">' is not assignable to parameter of type 'string'`]
    await api.get(file('./_requests/orders.http'));
    // @ts-expect-error disk-named-by-relative-path — a command is a value where a verb takes one [`Argument of type 'FileAt<"./_fixtures/args.txt">' is not assignable to parameter of type 'string | string[] | undefined'`]
    await cli.exec(file('./_fixtures/args.txt'));

    const out = await cli.exec();
    // @ts-expect-error one-verb-per-meaning — a string subject has no golden: its argument is a value [`Argument of type 'FileAt<"./_expected/abc.txt">' is not assignable to parameter of type 'string | RegExp'`]
    expect('abc').toMatch(file('./_expected/abc.txt'));
    // @ts-expect-error one-verb-per-meaning — a stream's golden is a file [`is not assignable to parameter of type 'string | DiskFile'`]
    expect(out.stdout).toMatch(directory('./_expected/out/'));
    // @ts-expect-error one-verb-per-meaning — a tree's golden is a directory [`Argument of type 'FileAt<"./_expected/tree.txt">' is not assignable to parameter of type 'DiskDirectory'`]
    await expect(out.filesystem).toMatch(file('./_expected/tree.txt'));
    expect(out.stdout).toMatch(file('./_expected/out.txt'));
    expect(out.stdout.text).toMatch(/built/u);
    await expect(out.filesystem).toMatch(directory('./_expected/tree/'));

    await api.seed(file('./_seeds/orders.sql')).post('/orders', file('./_requests/order.json'));
    await cli
        .fixture(directory('../../_fixtures/shop/'))
        .fixture(file('./_fixtures/a.json'))
        .exec();

    const result = await api.get('/orders/1');

    await api.get('/orders/:id/lines/:line?full=1', { params: { id: 1, line: 'a' } });
    await api.post('/orders/:id/lines', file('./_requests/line.json'), { params: { id: 1 } });
    await api.get('/orders/latest', { params: {} });
    // @ts-expect-error route-written-as-template — a template's params are handed with it [`Expected 2 arguments, but got 1`]
    await api.get('/orders/:id');
    // @ts-expect-error route-written-as-template — every parameter of the template has a value [`Property 'line' is missing in type '{ id: number; }'`]
    await api.get('/orders/:id/lines/:line', { params: { id: 1 } });
    // @ts-expect-error route-written-as-template — a value no parameter takes is refused [`'orderId' does not exist in type 'Record<"id", string | number>'`]
    await api.delete('/orders/:id', { params: { orderId: 1 } });

    // @ts-expect-error one-terminal-action-per-chain — one terminal action closes the chain [`Property 'get' does not exist on type 'HttpResult'`]
    await result.get('/orders/2');

    // @ts-expect-error result-accessor-read-only — a result accessor is read-only [`Cannot assign to 'status' because it is a read-only property`]
    result.status = 200;

    const anonymous = mockOf();
    // @ts-expect-error mock-of-needs-a-port — a double with no port has nothing to call [`Property 'send' does not exist on type 'object'`]
    anonymous.send('reader@site.test');

    const mailer = mockOf<Mailer>();
    await mailer.send('reader@site.test');
}

/** `one-verb-per-meaning`, the value half: a stream is not a string. */
export async function streamValueRows(): Promise<void> {
    const { cli } = await specification.cli('./bin.sh');
    await specification.cli('./bin.sh', { commands: ['db', 'migrate'] });
    const out = await cli.exec();
    // @ts-expect-error one-verb-per-meaning — a stream compared as a value is its text [`Type 'never' has no call signatures`]
    expect(out.stdout).toContain('built');
    // @ts-expect-error one-verb-per-meaning — a stream compared as a value is its text [`Type 'never' has no call signatures`]
    expect(out.stderr).not.toContain('warning');
    expect(out.stdout.text).toContain('built');
    expect(['built']).toContain('built');
    // @ts-expect-error one-verb-per-meaning — an empty stream is an empty text [`Type 'never' has no call signatures`]
    await expect(out.stderr).toBeEmpty();
    expect(out.stderr.text).toBe('');
}

export async function streamMatcherRows(): Promise<void> {
    const { cli } = await specification.cli('./bin.sh');
    await specification.cli('./bin.sh', { commands: ['db', 'migrate'] });
    const out = await cli.exec();
    // @ts-expect-error one-verb-per-meaning — a stream is compared whole: a RegExp matches a part, on its .text [`Argument of type 'RegExp' is not assignable to parameter of type 'string | DiskFile'`]
    expect(out.stdout).toMatch(/built/u);
    expect(out.stderr).toMatch('warning: {{string}}\n');
    expect(out.stderr.text).toMatch(/warning/u);
}

export async function valueSubjectMatcherRows(): Promise<void> {
    const { api } = await specification.api({ server: () => ({}) as never });
    const { cli } = await specification.cli('./bin.sh');
    await specification.cli('./bin.sh', { commands: ['db', 'migrate'] });
    const result = await api.get('/orders/1');
    const out = await cli.exec();
    // @ts-expect-error one-verb-per-meaning — a response is compared whole to its .http text, never a RegExp [`Argument of type 'RegExp' is not assignable to parameter of type 'string | DiskFile'`]
    expect(result.response).toMatch(/200/u);
    // @ts-expect-error one-verb-per-meaning — a json is compared whole to its value, never a RegExp [`Argument of type 'RegExp' is not assignable to parameter of type 'JsonExpectation'`]
    expect(out.json).toMatch(/ok/u);
    expect(result.response).toMatch(`
        HTTP/1.1 200 OK

        {"id": 1}
    `);
    expect(out.json).toMatch({ ok: true });
}

export async function treeMatcherRows(): Promise<void> {
    const { cli } = await specification.cli('./bin.sh');
    await specification.cli('./bin.sh', { commands: ['db', 'migrate'] });
    const out = await cli.exec();
    // @ts-expect-error one-verb-per-meaning — a tree is matched against its directory(), never a value [`Argument of type 'string' is not assignable to parameter of type 'DiskDirectory'`]
    await expect(out.filesystem).toMatch('scaffolded');
    // @ts-expect-error one-verb-per-meaning — a directory is matched against its directory(), never a value [`Argument of type 'RegExp' is not assignable to parameter of type 'DiskDirectory'`]
    await expect(out.directory('out')).toMatch(/index/u);
    await expect(out.directory('out')).toMatch(directory('./_expected/out/'));
}

export async function assertedSubjectMatcherRows(): Promise<void> {
    const { api } = await specification.api({ server: () => ({}) as never });
    const { cli } = await specification.cli('./bin.sh');
    await specification.cli('./bin.sh', { commands: ['db', 'migrate'] });
    const result = await api.get('/orders/1');
    const out = await cli.exec();
    // @ts-expect-error one-verb-per-meaning — a table is compared whole to its rows, never a text [`Argument of type '"1"' is not assignable to parameter of type '"" | TableRows'`]
    await expect(result.table('orders')).toMatch('1');
    // @ts-expect-error one-verb-per-meaning — a container is asserted running, never a value [`is not assignable to method's 'this' of type 'SubjectIsNoValue'`]
    expect(out.container('db')).toMatch('up');
    await expect(result.table('orders')).toMatch([['{{int}}', 'ORD-1']]);
    expect(result.response).toMatch(file('./_expected/order.http'));
    expect(out.json).toMatch(file('./_expected/out.json'));
}
