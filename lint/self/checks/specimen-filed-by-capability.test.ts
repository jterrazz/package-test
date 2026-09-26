import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { forgetTree } from '../../../src/kernel/files/git-tree.js';
import { checkCapabilityFolder } from './specimen-filed-by-capability.js';

function specsTree(files: Record<string, string>): string {
    const scratch = mkdtempSync(join(tmpdir(), 'checker-capability-'));
    const root = join(scratch, 'specs');
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), text);
    }
    forgetTree();
    return root;
}

const SPECIMEN = "import { createApp } from '../shared/fixtures/specimen-api/app.js';\n";

function spec(depth: number): string {
    return `import { api } from '${'../'.repeat(depth)}api.specification.js';\n`;
}

describe('checkCapabilityFolder', () => {
    test('c35 — a spec of a specimen is filed by its capability — a spec of a specimen filed by its route, or under no capability, is refused', () => {
        // Given - three specs of a specimen: by route, under a grab-bag, one folder too deep
        const root = specsTree({
            'api/api.specification.ts': SPECIMEN,
            'api/users/list/listing.spec.ts': spec(2),
            'api/assertions/whole.spec.ts': spec(1),
            'api/seed/nominal/nominal.spec.ts': spec(2),
        });

        // Then - each, at its first line
        expect(
            checkCapabilityFolder(root).map(({ file, found }) => `${file} ${found}`),
        ).toStrictEqual([
            'api/assertions/whole.spec.ts a spec of the specimen `shared/fixtures/specimen-api`, filed under `api/assertions/`',
            'api/seed/nominal/nominal.spec.ts a spec of the specimen `shared/fixtures/specimen-api`, filed under `api/seed/nominal/`',
            'api/users/list/listing.spec.ts a spec of the specimen `shared/fixtures/specimen-api`, filed under `api/users/list/`',
        ]);
    });

    test('c35 — a spec of a specimen is filed by its capability — a capability another column declares is no folder of this facet', () => {
        // Given - a cli spec of a specimen filed under `appium/`, a capability of the mobile column
        const root = specsTree({
            'cli/cli.specification.ts':
                "const BIN = resolve(import.meta.dirname, '../shared/fixtures/specimen-cli/cli.sh');\n",
            'cli/appium/session.spec.ts': "import { cli } from '../cli.specification.js';\n",
        });

        // Then - refused, naming the cli column's own capabilities
        expect(checkCapabilityFolder(root).map(({ file, fix }) => `${file} ${fix}`)).toStrictEqual([
            'cli/appium/session.spec.ts file it under the capability it specifies, one folder below its facet — `cli/<capability>/<aspect>.spec.ts`, the capability a name the matrix gives the `cli` column, kebab-cased (`seed`, `to-match`, `exec`, …; docs/03-testing.md § The capability matrix)',
        ]);
    });

    test('c35 — a spec of a specimen is filed by its capability — a capability folder passes, and a spec of the project’s own app is C30’s', () => {
        // Given - a specimen spec under seed/, and a project whose runner starts its own app
        const specimen = specsTree({
            'api/api.specification.ts': SPECIMEN,
            'api/seed/nominal.spec.ts': spec(1),
        });
        const product = specsTree({
            'api/api.specification.ts': "import { app } from '../../src/app.js';\n",
            'api/users/list/listing.spec.ts': spec(2),
        });

        // Then - no finding in either
        expect([
            ...checkCapabilityFolder(specimen),
            ...checkCapabilityFolder(product),
        ]).toStrictEqual([]);
    });

    test('c35 — a spec of a specimen is filed by its capability — a reasoned suppression above the first line of code keeps a spec where it is', () => {
        // Given - a spec of a specimen by its route, silenced above its first import
        const root = specsTree({
            'api/api.specification.ts': SPECIMEN,
            'api/users/list/listing.spec.ts': `// checker-disable-next-line c35 -- a document names this path\n${spec(2)}`,
            'api/users/get/reading.spec.ts': `/** A doc comment. */\n${spec(2)}`,
        });

        // Then - the silenced file passes, and the other is reported at its first line of code
        expect(
            checkCapabilityFolder(root).map(({ file, line }) => `${file}:${line}`),
        ).toStrictEqual(['api/users/get/reading.spec.ts:2']);
    });

    test('c35 — a spec of a specimen is filed by its capability — a repository suite, which has no column, files a specimen’s spec under a capability of any', () => {
        // Given - a suite's specs of a specimen under an api capability, a mobile one, and neither
        const suite = "import { surface } from '../surface.specification.js';\n";
        const root = specsTree({
            'surface/surface.specification.ts':
                "import { createApp } from '../shared/fixtures/specimen-api/app.js';\n",
            'surface/seed/nominal.spec.ts': suite,
            'surface/appium/session.spec.ts': suite,
            'surface/misc/grab-bag.spec.ts': suite,
        });

        // Then - only the folder no column names is refused
        expect(checkCapabilityFolder(root).map(({ file }) => file)).toStrictEqual([
            'surface/misc/grab-bag.spec.ts',
        ]);
    });

    test('c35 — a spec of a specimen is filed by its capability — an integration spec is filed by capability when its module is the shared fixtures’, and its author’s when inline', () => {
        // Given - two specs on a module-only runner under a folder the matrix never names
        const runner = "import { integration } from '../pure.specification.js';\n";
        const root = specsTree({
            'integration/pure.specification.ts':
                'export const { integration } = await specification.integration();\n',
            'integration/timekeeping/imported.spec.ts': `import { stamp } from '../../shared/fixtures/orders/stamp.js';\n${runner}`,
            'integration/timekeeping/inline.spec.ts': `${runner}const stamp = () => ({ at: new Date() });\n`,
        });

        // Then - the one calling the shared fixtures' module is refused; the inline module is out of reach
        expect(checkCapabilityFolder(root).map(({ file }) => file)).toStrictEqual([
            'integration/timekeeping/imported.spec.ts',
        ]);
    });

    test('c35 — a spec of a specimen is filed by its capability — a file of the component tree outside a component capability folder is refused', () => {
        // Given - a pair at the tree's root, one under a folder the matrix never names, one under a capability of another column, one a folder too deep, and the project's frame at the root
        const root = specsTree({
            'component/post-table.test.tsx': "import { PostTable } from './post-table.js';\n",
            'component/post-table.tsx': 'export function PostTable() {}\n',
            'component/hooks/use-modal.ts': 'export function useModal() {}\n',
            'component/exec/runner.tsx': 'export function Runner() {}\n',
            'component/intercept/nominal/feed.tsx': 'export function Feed() {}\n',
            'component/providers.tsx':
                '/** The frame. */\nexport default function Providers() {}\n',
        });

        // Then - each, at its first line of code, named with the column's own capabilities
        expect(
            checkCapabilityFolder(root).map(({ file, found, line }) => `${file}:${line} ${found}`),
        ).toStrictEqual([
            'component/exec/runner.tsx:1 a file of the component tree, filed under `component/exec/`',
            'component/hooks/use-modal.ts:1 a file of the component tree, filed under `component/hooks/`',
            'component/intercept/nominal/feed.tsx:1 a file of the component tree, filed under `component/intercept/nominal/`',
            'component/post-table.test.tsx:1 a file of the component tree, filed under `component/`',
            'component/post-table.tsx:1 a file of the component tree, filed under `component/`',
            'component/providers.tsx:2 a file of the component tree, filed under `component/`',
        ]);
        expect(checkCapabilityFolder(root)[0]?.fix).toBe(
            'file it under the capability it specifies, one folder below its facet — `component/<capability>/<unit>.test.tsx` beside the `<unit>.tsx` it renders, the capability a name the matrix gives the `component` column, kebab-cased (`intercept`, `clock`, `to-match`, …; docs/03-testing.md § The capability matrix)',
        );
    });

    test('c35 — a spec of a specimen is filed by its capability — a component capability folder passes, and a reasoned suppression keeps a file where it is', () => {
        // Given - a pair under intercept/, a hook and its test under render/, and a silenced file at the root
        const root = specsTree({
            'component/intercept/post-table.test.tsx':
                "import { PostTable } from './post-table.js';\n",
            'component/intercept/post-table.tsx': 'export function PostTable() {}\n',
            'component/render/use-modal.test.tsx': "import { useModal } from './use-modal.js';\n",
            'component/render/use-modal.ts': 'export function useModal() {}\n',
            'component/legacy.tsx':
                '// checker-disable-next-line c35 -- moved with its consumer next release\nexport function Legacy() {}\n',
        });

        // Then - no finding
        expect(checkCapabilityFolder(root)).toStrictEqual([]);
    });
});
