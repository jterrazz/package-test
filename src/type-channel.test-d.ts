/* oxlint-disable jterrazz/a1-specification-file, jterrazz/a2-known-constructors, jterrazz/d2-await-io-matcher, typescript/no-unsafe-call, typescript/no-unsafe-return, typescript/no-unsafe-type-assertion -- every line below is a call the compiler REFUSES, and its `@ts-expect-error` is the assertion: a refused call has no type, and no runner is constructed */
import { expect } from 'vitest';

import type { ComponentChain, ComponentVisitor } from './facets/component/index.js';
import type { MobileVisitor } from './facets/mobile/index.js';
import type { Visitor } from './facets/website/index.js';
import { directory, file, mockOf, postgres, specification } from './index.js';

/** Each `@ts-expect-error` below is the assertion: `typescript check` fails the day the line compiles. */

type Mailer = { send: (to: string) => Promise<void> };

type Assert<Row extends true> = Row;

type Carries<Verbs, Verb extends string> = Verb extends keyof Verbs ? true : false;

// W6 — the verb set is the boundary between the facets; `goto` is the page's alone.
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
            // @ts-expect-error A8 — `cache` is not a key of the services record [`Property 'cache' does not exist on type '{ db: PostgresHandle; }'`]
            services.cache,
        services: { db: postgres() },
    });

    await specification.website(
        // @ts-expect-error A11 — `server` and `url` are mutually exclusive [`Types of property 'url' are incompatible`]
        { server: { command: 'npm start' }, url: 'https://site.test' },
    );

    // @ts-expect-error A2 — `jobs` is retired: `specification.job()` [`Property 'jobs' does not exist on type 'Specification'`]
    await specification.jobs({ jobs: [] });

    const { api } = await specification.api({ server: () => ({}) as never });
    const { cli } = await specification.cli('./bin.sh');
    await specification.cli('./bin.sh', { commands: ['db', 'migrate'] });

    // @ts-expect-error B3 — a chain carries no label [`Property 'label' does not exist on type 'ApiSpecification<never>'`]
    api.label('the happy path');

    // @ts-expect-error B2 — a bare string is a value, not a file [`Argument of type 'string' is not assignable to parameter of type 'SeedSource'`]
    api.seed('./seeds/x.sql');
    // @ts-expect-error B2 — a seed's path ends in `.sql` [`Type '"./seeds/x.json"' is not assignable to type 'RelativePath<".sql">'`]
    api.seed(file('./seeds/x.json'));
    // @ts-expect-error B2 — a path is relative to the spec file [`Argument of type '"x.sql"' is not assignable to parameter of type 'RelativePath<string>'`]
    api.seed(file('x.sql'));
    // @ts-expect-error B2 — SQL is never written in the test: a seed is a `.sql` file [`Argument of type 'string' is not assignable to parameter of type 'SeedSource'`]
    api.seed(`INSERT INTO users (name) VALUES ('Ada');`);
    // @ts-expect-error B2 — a directory's path ends in `/` [`Argument of type '"./fixtures/shop"' is not assignable to parameter of type 'RelativePath<"/">'`]
    cli.fixture(directory('./fixtures/shop'));
    // @ts-expect-error B2 — a path ending in `/` is a directory [`Argument of type '"./fixtures/shop/"' is not assignable to parameter of type 'never'`]
    cli.fixture(file('./fixtures/shop/'));
    // @ts-expect-error B2 — a request is one `.http` file, not a directory [`is not assignable to parameter of type 'string | DiskFile<".http">'`]
    await api.request(directory('./requests/'));
    // @ts-expect-error B2 — a document is a `.spec.yaml` file [`Argument of type 'FileAt<"./case.yaml">' is not assignable to parameter of type 'DiskFile<".spec.yaml">'`]
    await cli.run(file('./case.yaml'));
    // @ts-expect-error B2 — a path is a value where a verb takes one [`Argument of type 'FileAt<"./requests/orders.http">' is not assignable to parameter of type 'string'`]
    await api.get(file('./requests/orders.http'));
    // @ts-expect-error B2 — a command is a value where a verb takes one [`Argument of type 'FileAt<"./fixtures/args.txt">' is not assignable to parameter of type 'string | string[] | undefined'`]
    await cli.exec(file('./fixtures/args.txt'));

    // @ts-expect-error B2 — `seedFile` is retired: `seed(file(…))` [`Property 'seedFile' does not exist on type 'ApiSpecification<never>'`]
    api.seedFile('./seeds/x.sql');
    // @ts-expect-error B2 — `requestFile` is retired: `request(file(…))` [`Property 'requestFile' does not exist on type 'ApiSpecification<never>'`]
    await api.requestFile('./requests/x.http');
    // @ts-expect-error B2 — `fixtureFile` is retired: `fixture(file(…))` [`Property 'fixtureFile' does not exist on type`]
    cli.fixtureFile('./fixtures/a.json');
    // @ts-expect-error B2 — `fixtureDirectory` is retired: `fixture(directory(…))` [`Property 'fixtureDirectory' does not exist on type`]
    cli.fixtureDirectory('./fixtures/shop/');
    // @ts-expect-error B2 — `runFile` is retired: `run(file(…))` [`Property 'runFile' does not exist on type`]
    await cli.runFile('./case.spec.yaml');

    const out = await cli.exec();
    // @ts-expect-error D14 — a string subject has no golden: its argument is a value [`Argument of type 'FileAt<"./expected/abc.txt">' is not assignable to parameter of type 'string | RegExp'`]
    expect('abc').toMatch(file('./expected/abc.txt'));
    // @ts-expect-error D14 — a stream's golden is a file [`is not assignable to parameter of type 'string | DiskFile'`]
    expect(out.stdout).toMatch(directory('./expected/out/'));
    // @ts-expect-error D14 — a tree's golden is a directory [`Argument of type 'FileAt<"./expected/tree.txt">' is not assignable to parameter of type 'DiskDirectory'`]
    await expect(out.filesystem).toMatch(file('./expected/tree.txt'));
    expect(out.stdout).toMatch(file('./expected/out.txt'));
    expect(out.stdout.text).toMatch(/built/u);
    await expect(out.filesystem).toMatch(directory('./expected/tree/'));

    await api.seed(file('./seeds/orders.sql')).post('/orders', file('./requests/order.json'));
    await cli.fixture(directory('../../fixtures/shop/')).fixture(file('./fixtures/a.json')).exec();

    const result = await api.get('/orders/1');

    await api.get('/orders/:id/lines/:line?full=1', { params: { id: 1, line: 'a' } });
    await api.post('/orders/:id/lines', file('./requests/line.json'), { params: { id: 1 } });
    await api.get('/orders/latest', { params: {} });
    // @ts-expect-error B12 — a template's params are handed with it [`Expected 2 arguments, but got 1`]
    await api.get('/orders/:id');
    // @ts-expect-error B12 — every parameter of the template has a value [`Property 'line' is missing in type '{ id: number; }'`]
    await api.get('/orders/:id/lines/:line', { params: { id: 1 } });
    // @ts-expect-error B12 — a value no parameter takes is refused [`'orderId' does not exist in type 'Record<"id", string | number>'`]
    await api.delete('/orders/:id', { params: { orderId: 1 } });

    // @ts-expect-error B1 — one terminal action closes the chain [`Property 'get' does not exist on type 'HttpResult'`]
    await result.get('/orders/2');

    // @ts-expect-error D1 — a result accessor is read-only [`Cannot assign to 'status' because it is a read-only property`]
    result.status = 200;

    const anonymous = mockOf();
    // @ts-expect-error M2 — a double with no port has nothing to call [`Property 'send' does not exist on type 'object'`]
    anonymous.send('reader@site.test');

    const mailer = mockOf<Mailer>();
    await mailer.send('reader@site.test');
}

/** D14, the value half: a stream is not a string. */
export async function streamValueRows(): Promise<void> {
    const { cli } = await specification.cli('./bin.sh');
    await specification.cli('./bin.sh', { commands: ['db', 'migrate'] });
    const out = await cli.exec();
    // @ts-expect-error D14 — a stream compared as a value is its text [`Type 'never' has no call signatures`]
    expect(out.stdout).toContain('built');
    // @ts-expect-error D14 — a stream compared as a value is its text [`Type 'never' has no call signatures`]
    expect(out.stderr).not.toContain('warning');
    expect(out.stdout.text).toContain('built');
    expect(['built']).toContain('built');
    // @ts-expect-error D14 — an empty stream is an empty text [`Type 'never' has no call signatures`]
    await expect(out.stderr).toBeEmpty();
    expect(out.stderr.text).toBe('');
}

export async function streamMatcherRows(): Promise<void> {
    const { cli } = await specification.cli('./bin.sh');
    await specification.cli('./bin.sh', { commands: ['db', 'migrate'] });
    const out = await cli.exec();
    // @ts-expect-error D14 — a stream is compared whole: a RegExp matches a part, on its .text [`Argument of type 'RegExp' is not assignable to parameter of type 'string | DiskFile'`]
    expect(out.stdout).toMatch(/built/u);
    expect(out.stderr).toMatch('warning: {{string}}\n');
    expect(out.stderr.text).toMatch(/warning/u);
}

/** B2 — the retired disk matchers stay retired. */
export async function retiredMatcherRows(): Promise<void> {
    const { api } = await specification.api({ server: () => ({}) as never });
    const { cli } = await specification.cli('./bin.sh');
    await specification.cli('./bin.sh', { commands: ['db', 'migrate'] });
    const out = await cli.exec();
    const result = await api.get('/orders/1');
    // @ts-expect-error B2 — `toMatchFile` is retired: `toMatch(file(…))` [`Property 'toMatchFile' does not exist on type`]
    expect(out.stdout).toMatchFile('./expected/out.txt');
    // @ts-expect-error B2 — `toMatchDirectory` is retired: `toMatch(directory(…))` [`Property 'toMatchDirectory' does not exist on type`]
    await expect(out.filesystem).toMatchDirectory('./expected/tree/');
    // @ts-expect-error B2 — `toMatchRows` is retired: a table is compared whole, `toMatch(rows)` [`Property 'toMatchRows' does not exist on type`]
    await expect(result.table('orders')).toMatchRows({ columns: ['id'], rows: [[1]] });
}

export async function valueSubjectMatcherRows(): Promise<void> {
    const { api } = await specification.api({ server: () => ({}) as never });
    const { cli } = await specification.cli('./bin.sh');
    await specification.cli('./bin.sh', { commands: ['db', 'migrate'] });
    const result = await api.get('/orders/1');
    const out = await cli.exec();
    // @ts-expect-error D14 — a response is compared whole to its .http text, never a RegExp [`Argument of type 'RegExp' is not assignable to parameter of type 'string | DiskFile'`]
    expect(result.response).toMatch(/200/u);
    // @ts-expect-error D14 — a json is compared whole to its value, never a RegExp [`Argument of type 'RegExp' is not assignable to parameter of type 'JsonExpectation'`]
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
    // @ts-expect-error D14 — a tree is matched against its directory(), never a value [`Argument of type 'string' is not assignable to parameter of type 'DiskDirectory'`]
    await expect(out.filesystem).toMatch('scaffolded');
    // @ts-expect-error D14 — a directory is matched against its directory(), never a value [`Argument of type 'RegExp' is not assignable to parameter of type 'DiskDirectory'`]
    await expect(out.directory('out')).toMatch(/index/u);
    await expect(out.directory('out')).toMatch(directory('./expected/out/'));
}

export async function assertedSubjectMatcherRows(): Promise<void> {
    const { api } = await specification.api({ server: () => ({}) as never });
    const { cli } = await specification.cli('./bin.sh');
    await specification.cli('./bin.sh', { commands: ['db', 'migrate'] });
    const result = await api.get('/orders/1');
    const out = await cli.exec();
    // @ts-expect-error D14 — a table is compared whole to its rows, never a text [`Argument of type '"1"' is not assignable to parameter of type '"" | TableRows'`]
    await expect(result.table('orders')).toMatch('1');
    // @ts-expect-error D14 — a container is asserted running, never a value [`is not assignable to method's 'this' of type 'SubjectIsNoValue'`]
    expect(out.container('db')).toMatch('up');
    await expect(result.table('orders')).toMatch([['{{int}}', 'ORD-1']]);
    expect(result.response).toMatch(file('./expected/order.http'));
    expect(out.json).toMatch(file('./expected/out.json'));
}
