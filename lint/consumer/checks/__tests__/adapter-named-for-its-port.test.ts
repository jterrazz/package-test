import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../kit/testing/package-tree.fixtures.js';
import { checkAdapterNamedForItsPort } from '../adapter-named-for-its-port.js';

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
            'specs/cli/__setup__/mixed.ts':
                "import type { ClockPort } from '@ports';\nexport class Either implements ClockPort {}\n",
            'src/ports.ts':
                'export interface ClockPort {}\nexport interface HTTPClientPort {}\nexport interface PortfolioPort {}\nexport interface TickerSourcePort {}\nexport interface Port {}\n',
            'specs/cli/__setup__/base.port.ts': 'export interface BasePort {}\n',
            'specs/cli/__setup__/broken.ts': 'const = ;\n',
            'specs/cli/__setup__/by-default.ts':
                "import type Clock from '../../../src/default-clock.js';\nexport class Frozen implements Clock {}\n",
            'specs/cli/__setup__/by-namespace.ts': `import type * as ports from '${PORTS}';\nexport default class implements ports.ClockPort {}\n`,
            'specs/cli/__setup__/by-string.ts': `import type { 'TickerSourcePort' as Ticker } from '${PORTS}';\nexport class Fixed implements Ticker {}\n`,
            'specs/cli/__setup__/from-specs.ts':
                "import type { BasePort } from './base.port.js';\nexport class Local implements BasePort {}\n",
            'specs/cli/__setup__/from-package.ts':
                "import type { PkgPort } from 'pkg';\nexport class Wrapped implements PkgPort {}\n",
            'specs/cli/__setup__/http.ts': implementing('HTTPClientPort', 'HTTPClientPort'),
            'specs/cli/__setup__/local.ts':
                'interface Mine {}\nexport class Own implements Mine {}\n',
            'specs/cli/__setup__/plain.ts': 'export const seed = 1;\n',
            'specs/cli/__setup__/portfolio.ts': implementing('PortfolioPort', 'PortfolioPort'),
            'specs/cli/__setup__/re-exported.ts': `export type { ClockPort as Exported } from '${PORTS}';\nexport class Odd implements ClockPort {}\n`,
            'specs/cli/__setup__/ticker-source.adapter.ts': implementing(
                'TickerSourcePort',
                'TickerSourcePort',
            ),
            'specs/cli/__setup__/bare.ts': implementing('Port', 'Port'),
            'specs/cli/helpers/loose.ts': implementing('ClockPort', 'ClockPort'),
        });

        // Then - each misnamed adapter, told the name of its port
        expect(
            checkAdapterNamedForItsPort(root).map(
                ({ fix, found, line, path, rule }) => `${rule} ${path}:${line} ${found} — ${fix}`,
            ),
        ).toStrictEqual([
            'adapter-named-for-its-port specs/cli/__setup__/bare.ts:2 `bare.ts`, whose `Adapter` implements the port `Port` — name the file for the port it replaces: `specs/cli/__setup__/port.adapter.ts` — the class keeps whatever name it has',
            'adapter-named-for-its-port specs/cli/__setup__/by-default.ts:2 `by-default.ts`, whose `Frozen` implements the port `Clock` — name the file for the port it replaces: `specs/cli/__setup__/clock.adapter.ts` — the class keeps whatever name it has',
            'adapter-named-for-its-port specs/cli/__setup__/by-namespace.ts:2 `by-namespace.ts`, whose `the class` implements the port `ClockPort` — name the file for the port it replaces: `specs/cli/__setup__/clock.adapter.ts` — the class keeps whatever name it has',
            'adapter-named-for-its-port specs/cli/__setup__/by-string.ts:2 `by-string.ts`, whose `Fixed` implements the port `TickerSourcePort` — name the file for the port it replaces: `specs/cli/__setup__/ticker-source.adapter.ts` — the class keeps whatever name it has',
            'adapter-named-for-its-port specs/cli/__setup__/http.ts:2 `http.ts`, whose `Adapter` implements the port `HTTPClientPort` — name the file for the port it replaces: `specs/cli/__setup__/http-client.adapter.ts` — the class keeps whatever name it has',
            'adapter-named-for-its-port specs/cli/__setup__/portfolio.ts:2 `portfolio.ts`, whose `Adapter` implements the port `PortfolioPort` — name the file for the port it replaces: `specs/cli/__setup__/portfolio.adapter.ts` — the class keeps whatever name it has',
        ]);
    });
});
