import { describe, expect, test } from 'vitest';

import { packageWith } from '../../kit/testing/package-tree.fixtures.js';
import { checkAdapterNamedForItsPort } from './adapter-named-for-its-port.js';

const PORTS = '../../../src/ports.js';

const implementing = (imported: string, implemented: string): string =>
    `import type { ${imported} } from '${PORTS}';\nexport class Adapter implements ${implemented} {}\n`;

describe('checkAdapterNamedForItsPort', () => {
    test('a setup module implementing a port of the product is named for that port, and nothing else is judged', () => {
        // Given - setup modules implementing ports each way, named well and badly, beside modules that implement none
        const root = packageWith({
            'src/default-clock.ts': 'export default interface ClockPort {}\n',
            'tsconfig.json': JSON.stringify({
                compilerOptions: {
                    paths: { '@ports': ['./src/ports.ts', './specs/cli/shared.ts'] },
                },
            }),
            'specs/cli/shared.ts': 'export interface ClockPort {}\n',
            'specs/cli/_setup/mixed.ts':
                "import type { ClockPort } from '@ports';\nexport class Either implements ClockPort {}\n",
            'src/ports.ts':
                'export interface ClockPort {}\nexport interface HTTPClientPort {}\nexport interface PortfolioPort {}\nexport interface TickerSourcePort {}\nexport interface Port {}\n',
            'specs/cli/_setup/base.port.ts': 'export interface BasePort {}\n',
            'specs/cli/_setup/broken.ts': 'const = ;\n',
            'specs/cli/_setup/by-default.ts':
                "import type Clock from '../../../src/default-clock.js';\nexport class Frozen implements Clock {}\n",
            'specs/cli/_setup/by-namespace.ts': `import type * as ports from '${PORTS}';\nexport default class implements ports.ClockPort {}\n`,
            'specs/cli/_setup/by-string.ts': `import type { 'TickerSourcePort' as Ticker } from '${PORTS}';\nexport class Fixed implements Ticker {}\n`,
            'specs/cli/_setup/from-specs.ts':
                "import type { BasePort } from './base.port.js';\nexport class Local implements BasePort {}\n",
            'specs/cli/_setup/from-package.ts':
                "import type { PkgPort } from 'pkg';\nexport class Wrapped implements PkgPort {}\n",
            'specs/cli/_setup/http.ts': implementing('HTTPClientPort', 'HTTPClientPort'),
            'specs/cli/_setup/local.ts': 'interface Mine {}\nexport class Own implements Mine {}\n',
            'specs/cli/_setup/plain.ts': 'export const seed = 1;\n',
            'specs/cli/_setup/portfolio.ts': implementing('PortfolioPort', 'PortfolioPort'),
            'specs/cli/_setup/re-exported.ts': `export type { ClockPort as Exported } from '${PORTS}';\nexport class Odd implements ClockPort {}\n`,
            'specs/cli/_setup/ticker-source.adapter.ts': implementing(
                'TickerSourcePort',
                'TickerSourcePort',
            ),
            'specs/cli/_setup/bare.ts': implementing('Port', 'Port'),
            'specs/cli/helpers/loose.ts': implementing('ClockPort', 'ClockPort'),
        });

        // Then - each misnamed adapter, told the name of its port
        expect(
            checkAdapterNamedForItsPort(root).map(
                ({ fix, found, line, path, rule }) => `${rule} ${path}:${line} ${found} — ${fix}`,
            ),
        ).toStrictEqual([
            'adapter-named-for-its-port specs/cli/_setup/bare.ts:2 `bare.ts`, whose `Adapter` implements the port `Port` — name the file for the port it replaces: `specs/cli/_setup/port.adapter.ts` — the class keeps whatever name it has',
            'adapter-named-for-its-port specs/cli/_setup/by-default.ts:2 `by-default.ts`, whose `Frozen` implements the port `Clock` — name the file for the port it replaces: `specs/cli/_setup/clock.adapter.ts` — the class keeps whatever name it has',
            'adapter-named-for-its-port specs/cli/_setup/by-namespace.ts:2 `by-namespace.ts`, whose `the class` implements the port `ClockPort` — name the file for the port it replaces: `specs/cli/_setup/clock.adapter.ts` — the class keeps whatever name it has',
            'adapter-named-for-its-port specs/cli/_setup/by-string.ts:2 `by-string.ts`, whose `Fixed` implements the port `TickerSourcePort` — name the file for the port it replaces: `specs/cli/_setup/ticker-source.adapter.ts` — the class keeps whatever name it has',
            'adapter-named-for-its-port specs/cli/_setup/http.ts:2 `http.ts`, whose `Adapter` implements the port `HTTPClientPort` — name the file for the port it replaces: `specs/cli/_setup/http-client.adapter.ts` — the class keeps whatever name it has',
            'adapter-named-for-its-port specs/cli/_setup/portfolio.ts:2 `portfolio.ts`, whose `Adapter` implements the port `PortfolioPort` — name the file for the port it replaces: `specs/cli/_setup/portfolio.adapter.ts` — the class keeps whatever name it has',
        ]);
    });
});
