import { expect } from 'vitest';

import { REFUSAL_WHY } from '../../chain/refusals/rows.js';
import type { DatabasePort } from '../../services/database.port.js';
import { ContainerAccessor } from '../command/container.js';
import { TableAccessor } from '../table/table.js';

type Registered = (...args: unknown[]) => unknown;

/** A registered matcher reached by the name no member access spells, as the golden routing reaches it. */
export function registered(subject: unknown, name: string, negated = false): Registered {
    // oxlint-disable-next-line vitest/valid-expect -- the assertion's matcher is the registered comparison, called by the name no member access spells
    const assertion = expect(subject);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the matcher is registered under a name no member access spells; reaching it by that name is how a test calls it
    const target = (negated ? assertion.not : assertion) as unknown as Record<string, Registered>;
    return (...args) => target[name]?.(...args);
}

/** The message of what the call throws, or the empty text when it throws nothing. */
export function refusalOf(call: () => unknown): string {
    try {
        call();
        return '';
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

/** A refusal of the one-verb rule, whole. */
export function oneVerb(found: string, fix: string): string {
    return [
        `found: ${found}`,
        `why: ${REFUSAL_WHY['one-verb-per-meaning']}`,
        `fix: ${fix}`,
        'read: docs/24-linting.md#one-verb-per-meaning',
    ].join('\n');
}

export function absentContainer(): ContainerAccessor {
    return new ContainerAccessor({
        containerId: null,
        inspectData: null,
        resultOf: () => {
            throw new Error('an absent container runs no command');
        },
        testDir: '/tmp',
    });
}

export function tableOf(rows: unknown[][]): TableAccessor {
    const database: DatabasePort = {
        columns: async () => ['id'],
        query: async (_table, columns) =>
            await Promise.resolve(columns.join(',') === '*' ? rows : []),
        reset: async () => {
            await Promise.resolve();
        },
        seed: async () => {
            await Promise.resolve();
        },
    };
    return new TableAccessor('orders', database);
}

/** `passed`, or the message of the error an awaited assertion rejects with. */
export async function settled(assertion: Promise<unknown>): Promise<string> {
    try {
        await assertion;
        return 'passed';
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

/** What `toBeEmpty` says of a subject, negated or not: `passed`, or the first line of its refusal. */
export async function emptiness(subject: unknown, negated = false): Promise<string> {
    return await settled(Promise.resolve(registered(subject, 'toBeEmpty', negated)()));
}
