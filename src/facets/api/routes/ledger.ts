import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { VITEST_ARTIFACTS_DIR } from '../../../../lint/engine/project/artifacts.js';
import type { Route, SentRequest } from './routes.js';

export type Ledger = { declared?: Route[] | undefined; reached: SentRequest[] };

export const ROUTES_DIR = `${VITEST_ARTIFACTS_DIR}/routes`;

export type Shard = { count: number; index: number };

export function shardLedgersDir(shard: Shard): string {
    return `${ROUTES_DIR}/shard-${shard.index}-${shard.count}`;
}

export function clearLedgers(directory: string): void {
    rmSync(directory, { force: true, recursive: true });
}

export function writeLedger(directory: string, ledger: Ledger): void {
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, `${randomUUID()}.json`), `${JSON.stringify(ledger)}\n`);
}

export function readLedgers(directory: string): Ledger[] {
    if (!existsSync(directory)) {
        return [];
    }
    return readdirSync(directory)
        .filter((name) => name.endsWith('.json'))
        .map((name) => JSON.parse(readFileSync(join(directory, name), 'utf8')) as Ledger);
}

const PARTIAL_MARK = 'partial';

export function markPartial(directory: string): void {
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, PARTIAL_MARK), '');
}

export function partialShards(directory: string): string[] {
    if (!existsSync(directory)) {
        return [];
    }
    return readdirSync(directory, { withFileTypes: true })
        .filter(
            (entry) =>
                entry.isDirectory() &&
                entry.name.startsWith('shard-') &&
                existsSync(join(directory, entry.name, PARTIAL_MARK)),
        )
        .map((entry) => entry.name)
        .toSorted();
}

export function readShardLedgers(directory: string): Ledger[] {
    if (!existsSync(directory)) {
        return [];
    }
    return readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith('shard-'))
        .flatMap((entry) => readLedgers(join(directory, entry.name)));
}

export function measure(ledgers: readonly Ledger[]): Ledger {
    const tables = ledgers.map((ledger) => ledger.declared);
    return {
        declared: tables.every((table) => table !== undefined) ? tables.flat() : undefined,
        reached: ledgers.flatMap((ledger) => ledger.reached),
    };
}

export async function routesLedger(): Promise<string | undefined> {
    try {
        const { inject } = await import('vitest');
        return inject('routesLedger');
    } catch {
        return undefined;
    }
}

declare module 'vitest' {
    // oxlint-disable-next-line typescript/consistent-type-definitions -- a module augmentation MERGES only as an interface; a type alias redeclares the name and every member is lost
    interface ProvidedContext {
        routesLedger?: string;
    }
}
