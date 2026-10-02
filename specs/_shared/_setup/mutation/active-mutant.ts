import { afterAll, beforeEach } from 'vitest';

const NAMESPACE = '__stryker__';
const ACTIVE_MUTANT = '__STRYKER_ACTIVE_MUTANT__';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function strykerNamespace(): Record<string, unknown> | undefined {
    const namespace: unknown = Reflect.get(globalThis, NAMESPACE);
    return isRecord(namespace) ? namespace : undefined;
}

// A spawned process runs the instrumented build and reads the active mutant from its environment; its coverage never reaches this process, so none is reported and Stryker runs every test against each mutant.
beforeEach(() => {
    const active = strykerNamespace()?.activeMutant;
    if (typeof active === 'string' || typeof active === 'number') {
        process.env[ACTIVE_MUTANT] = String(active);
    } else {
        Reflect.deleteProperty(process.env, ACTIVE_MUTANT);
    }
});

afterAll(() => {
    delete strykerNamespace()?.mutantCoverage;
});
