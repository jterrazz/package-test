export const POOL = { 'specs/_shared/_fixtures/app/index.txt': 'app\n' };

export const API_READS = {
    'specs/api/boot.spec.ts': "api.fixture(directory('../_shared/_fixtures/app/'));\n",
};

export const APP_KEPT_FOR_API = [
    "specs/_shared/_fixtures/app: ground only specs/api reaches for, kept above it — move it to specs/api/_fixtures/app and name it directory('./_fixtures/app/') — `typescript fix` does both",
];

/** A tree whose pool entry is shared, outside the placement's reach, or not read at all. */
export const NOT_MISPLACED: [string, Record<string, string>][] = [
    [
        'two top folders read it',
        {
            ...POOL,
            ...API_READS,
            'specs/cli/x.spec.ts': "cli.fixture(directory('../_shared/_fixtures/app/'));\n",
        },
    ],
    [
        'it sits at the specs root',
        {
            'specs/_fixtures/app/index.txt': 'app\n',
            'specs/api/boot.spec.ts': "api.fixture(directory('../_fixtures/app/'));\n",
        },
    ],
    [
        'its reader climbs into a sibling',
        {
            'specs/api/_fixtures/app/index.txt': 'app\n',
            'specs/cli/x.spec.ts': "cli.fixture(directory('../api/_fixtures/app/'));\n",
        },
    ],
    [
        'the named entry is gone',
        {
            'specs/_shared/_fixtures/kept.txt': '',
            'specs/api/boot.spec.ts': "api.fixture(directory('../_shared/_fixtures/gone/'));\n",
        },
    ],
    [
        'the ground folder itself is named',
        {
            ...POOL,
            'specs/api/boot.spec.ts': "api.fixture(directory('../_shared/_fixtures/'));\n",
        },
    ],
    [
        'a path outside every ground is named',
        {
            'specs/cli/data.json': '{}\n',
            'specs/api/helper.ts': "export const data = '../cli/data.json';\n",
        },
    ],
    [
        'a module test names it by a relative path',
        {
            ...POOL,
            ...API_READS,
            'src/app.test.ts':
                "read('../specs/_shared/_fixtures/app/index.txt', '../package.json');\n",
        },
    ],
    [
        'a module test names it from the member',
        { ...POOL, ...API_READS, 'src/app.test.ts': "read('specs/_shared/_fixtures/app');\n" },
    ],
    [
        'a module test names it from its own folder',
        {
            ...POOL,
            ...API_READS,
            'src/app.test.ts':
                "read(join(import.meta.dirname, '../specs/_shared/_fixtures/app'));\n",
        },
    ],
    [
        'the Makefile names it',
        {
            ...POOL,
            ...API_READS,
            Makefile: 'seed:\n\tcat specs/_shared/_fixtures/app/index.txt\n',
        },
    ],
    [
        'the settings name it',
        {
            ...POOL,
            ...API_READS,
            'jterrazz.config.ts':
                "export default { note: 'seeded from specs/_shared/_fixtures/app' };\n",
        },
    ],
    [
        'only a file that is no code names it',
        {
            ...POOL,
            'specs/api/notes.json': '"../_shared/_fixtures/app/"\n',
            'specs/api/notes.jsonc': '"../_shared/_fixtures/app/"\n',
        },
    ],
    [
        'a helper only quotes a call',
        {
            ...POOL,
            'specs/api/helper.ts':
                'export const shown = "directory(\'../_shared/_fixtures/app/\')";\n',
        },
    ],
    [
        'a helper builds it around a hole',
        {
            ...POOL,
            'specs/api/helper.ts': [
                'export const at = (name) => `specs/_shared/_fixtures/app/$',
                '{name}`;\n',
            ].join(''),
        },
    ],
    [
        'a spec document quotes it outside its fixture',
        {
            ...POOL,
            'specs/api/_fixtures/own/a.txt': '',
            'specs/api/boot.spec.yaml':
                "description: reads its own\nfixture: ./_fixtures/own/\nruns:\n    - command: echo\n      exit: 0\n      stdout: '../_shared/_fixtures/app/'\n",
        },
    ],
];

/** Readers other than a spec module's fixture call, each reading the pool entry alone. */
export const READERS: [string, Record<string, string>][] = [
    [
        'a module helper',
        { 'specs/api/helper.mts': "export const app = '../_shared/_fixtures/app/';\n" },
    ],
    [
        'a path built from the helper',
        {
            'specs/api/helper.ts':
                "export const app = join(import.meta.dirname, '../_shared/_fixtures/app');\n",
        },
    ],
    [
        'a helper naming it from the member',
        { 'specs/api/helper.ts': "export const app = 'specs/_shared/_fixtures/app';\n" },
    ],
    [
        'a spec document',
        {
            'specs/api/boot.spec.yaml':
                'description: reads the pool\nfixture: ../_shared/_fixtures/app/\nruns:\n    - command: echo\n      exit: 0\n',
        },
    ],
];
