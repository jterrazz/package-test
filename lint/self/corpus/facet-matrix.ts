/** A facet's own rows are stated by its composition's definitions (`self/compositions.ts`), never here; zero framework imports, so the lint layer stays runtime-free (the layer map). */

export const FACET_MATRIX_COLUMNS = [
    'api',
    'job',
    'cli',
    'lint',
    'integration',
    'website',
    'mobile',
    'component',
    'module',
] as const;

export type Column = (typeof FACET_MATRIX_COLUMNS)[number];

export type CapabilityGroup =
    | 'Constructor option'
    | 'Descriptor'
    | 'Golden'
    | 'Result accessor'
    | 'Route option'
    | 'Setup'
    | 'Terminal action'
    | 'Time & doubles'
    | 'Token'
    | 'Verb';

/** A call probe is matched as a shape against each file's syntax tree (`matrix-calls.ts`), so a formatter splitting it changes nothing; any other probe is a literal, on a word boundary. */
export type Capability = {
    columns: readonly Column[];
    exempt?: Partial<Record<Column, string>>;
    group: CapabilityGroup;
    member?: string;
    name: string;
    probe: string;
    /** A token family is `{{token}}` in a golden and `match.<kind>()` in a module test: one probe would call one of them absent. */
    probeByColumn?: Partial<Record<Column, string>>;
};

export function facetMatrixMember(capability: Pick<Capability, 'member' | 'name'>): string {
    return capability.member ?? capability.name.replace(/^\./u, '').replace(/\(\)$/u, '');
}

const IN_PLACE =
    "every golden of this facet's tree is read by one test, so it is written in place (`ground-shared-or-inline`); the file form is proven where goldens are shared";

export const FACET_MATRIX_EXEMPTIONS: Readonly<Record<string, Partial<Record<Column, string>>>> = {
    'Constructor option · root': {
        lint: 'a lint specification resolves its plugins and checkers from the project it sits in, and `no-redundant-root` refuses a `root` the walk already finds; the option is proven where a facet runs a product of its own (api, integration)',
    },
    'Constructor option · settings': {
        lint: "what a repository adds beside its presets is `@jterrazz/typescript`'s to resolve, and its own lint specs run it (`declared-preset-lint`); this package states its additions as the `self()` preset, which `presets` carries",
    },
};

export const FACET_MATRIX_CAPABILITIES: Capability[] = [
    {
        columns: ['api', 'cli', 'integration', 'website', 'component', 'module'],
        exempt: { website: IN_PLACE },
        group: 'Golden',
        name: 'toMatch(file())',
        probe: '.toMatch(file(',
    },
    {
        columns: ['api', 'cli', 'lint', 'integration', 'module'],
        group: 'Golden',
        name: 'toMatch(directory())',
        probe: '.toMatch(directory(',
    },
    {
        columns: ['api', 'job', 'cli', 'integration'],
        group: 'Golden',
        name: 'toMatch(<rows>)',
        probe: ')).toMatch([',
    },
    {
        columns: ['api', 'module'],
        group: 'Golden',
        name: '.http exchange',
        probe: ".http'",
    },
    {
        columns: ['website', 'component'],
        exempt: { website: IN_PLACE },
        group: 'Golden',
        name: '.aria.yaml tree',
        probe: ".aria.yaml'",
    },
    {
        columns: ['api', 'cli', 'integration', 'website', 'module'],
        exempt: { website: IN_PLACE },
        group: 'Golden',
        name: '.json body',
        probe: ".json'",
    },
    {
        columns: ['api', 'cli', 'integration', 'website', 'module'],
        group: 'Golden',
        name: '.txt stream',
        probe: ".txt'",
    },
    {
        columns: ['api', 'cli', 'component', 'module'],
        group: 'Golden',
        name: '{ frozen }',
        probe: 'frozen',
    },

    { columns: ['module'], group: 'Time & doubles', name: 'clock()', probe: 'clock.' },
    { columns: ['module'], group: 'Time & doubles', name: 'intercept()', probe: 'intercept(' },
    { columns: ['module'], group: 'Time & doubles', name: 'mockOf()', probe: 'mockOf' },
    { columns: ['module'], group: 'Time & doubles', name: 'match.*', probe: 'match.' },
];
