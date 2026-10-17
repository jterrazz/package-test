import { dirname, resolve } from 'node:path';

import { argumentsOf, closingOf } from './source-scan.js';
import { listFiles, readSource } from './tree.js';

const NON_RUNNER_BINDINGS: ReadonlySet<string> = new Set(['cleanup', 'docker', 'orchestrator']);

const RUNNER_DECLARATION =
    /\{(?<names>[^{}]*)\}\s*=\s*await\s+specification\.(?:api|cli|job)\s*\(/gu;

const SQL_SERVICES: ReadonlySet<string> = new Set(['mysql', 'postgres', 'sqlite']);

const SERVICES_RECORD = /\bservices\s*:\s*\{/u;

const SERVICE_CALL = /^[^:]*:\s*(?<callee>[A-Za-z_$][\w$]*)\s*\(/u;

const CLI_CONSTRUCTION = /specification\.cli\s*\(/gu;

const DOCKER_OPTION = /\bdocker\s*:/u;

const NAMED_IMPORT =
    /import\s+(?:type\s+)?\{(?<names>[^}]*)\}\s+from\s+['"](?<source>[^'"]+)['"]/gu;

const RENAMED = /\s+as\s+/u;

/** The text between a call's parentheses, to the end of the text when they never close. */
export function argumentsAt(text: string, open: number): string {
    return text.slice(open + 1, closingOf(text, open));
}

/** `{ api, cli: run } = await specification.cli(...)` binds `api` as `api`, `cli` as `run`; the helpers beside a runner are none. */
export function runnerBindings(text: string): { key: string; local: string }[] {
    return [...text.matchAll(RUNNER_DECLARATION)].flatMap((match) => {
        // Stryker disable next-line StringLiteral: a declaration match always carries its names
        const { names = '' } = match.groups ?? {};
        return argumentsOf(names).flatMap((part) => {
            const [key = '', local = key] = part.split(':').map((token) => token.trim());
            return NON_RUNNER_BINDINGS.has(key) ? [] : [{ key, local }];
        });
    });
}

export type SpecModel = {
    dockerAware: boolean;
    file: string;
    runnerExports: Set<string>;
    sqlDatabaseCount: null | number;
};

// invariant: `null` when the services record is not one the count can read: a value no call opens, or a brace never closed.
function sqlDatabaseCount(text: string): null | number {
    const record = SERVICES_RECORD.exec(text);
    if (record === null) {
        return null;
    }
    const open = record.index + record[0].length - 1;
    const close = closingOf(text, open);
    if (close === text.length) {
        return null;
    }
    let count = 0;
    for (const pair of argumentsOf(text.slice(open + 1, close))) {
        // Stryker disable next-line OptionalChaining: a service call match always carries its callee
        const service = SERVICE_CALL.exec(pair)?.groups?.callee;
        if (service === undefined) {
            return null;
        }
        count += SQL_SERVICES.has(service) ? 1 : 0;
    }
    return count;
}

export function modelSpecFile(file: string): SpecModel {
    const text = readSource(file);
    const dockerAware = [...text.matchAll(CLI_CONSTRUCTION)].some((call) => {
        // Stryker disable next-line StringLiteral: read from the call's own name, its arguments still close where its parenthesis does
        const open = text.indexOf('(', call.index);
        return DOCKER_OPTION.test(argumentsAt(text, open));
    });
    return {
        dockerAware,
        file,
        runnerExports: new Set(runnerBindings(text).map(({ local }) => local)),
        sqlDatabaseCount: sqlDatabaseCount(text),
    };
}

/** The specification files under a root whose model the caller keeps. */
export function specificationModels(
    rootDir: string,
    keeps: (model: SpecModel) => boolean,
): Map<string, SpecModel> {
    return new Map(
        listFiles(rootDir, (path) => path.endsWith('.specification.ts'))
            .map((file) => modelSpecFile(file))
            .filter((model) => model.runnerExports.size > 0 && keeps(model))
            .map((model) => [model.file, model]),
    );
}

type ImportedBinding = { local: string; name: string; source: string };

export function namedImports(text: string): ImportedBinding[] {
    const bindings: ImportedBinding[] = [];
    for (const match of text.matchAll(NAMED_IMPORT)) {
        // Stryker disable next-line StringLiteral: an import match always carries its names and source
        const { names = '', source = '' } = match.groups ?? {};
        for (const part of argumentsOf(names)) {
            const [name = '', local = name] = part.split(RENAMED);
            bindings.push({ local, name, source });
        }
    }
    return bindings;
}

/** Each runner a test imports from one of the models, under the name the test reads it by; a specification imported with any extension or none. */
export function importedRunners(
    testFile: string,
    text: string,
    models: ReadonlyMap<string, SpecModel>,
): { local: string; model: SpecModel }[] {
    return namedImports(text).flatMap(({ local, name, source }) => {
        const target = resolve(dirname(testFile), source).replace(/(?:\.[jt]s)?$/u, '.ts');
        const model = source.startsWith('.') ? models.get(target) : undefined;
        return model?.runnerExports.has(name) === true ? [{ local, model }] : [];
    });
}
