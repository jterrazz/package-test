import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { join } from 'node:path';

import { VITEST_ARTIFACTS_DIR } from '../../../../lint/kit/project/artifacts.js';
import { isRecord } from '../../../../lint/kit/project/json-shape.js';
import type { Route, SentRequest } from './routes.js';

export type Ledger = { declared?: Route[] | undefined; reached: SentRequest[] };

const isLedger = (value: unknown): value is Ledger =>
    isRecord(value) &&
    Array.isArray(value.reached) &&
    (value.declared === undefined || Array.isArray(value.declared));

/** A folder no run wrote holds nothing. */
function entriesOf(directory: string): Dirent[] {
    try {
        return readdirSync(directory, { withFileTypes: true });
    } catch {
        return [];
    }
}

const isShard = (entry: Dirent): boolean => entry.isDirectory() && entry.name.startsWith('shard-');

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

// Stryker disable StringLiteral: a file read as a Buffer parses as the same text
const parsed = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));
// Stryker restore StringLiteral

export function readLedgers(directory: string): Ledger[] {
    return entriesOf(directory)
        .filter((entry) => entry.name.endsWith('.json'))
        .map((entry) => parsed(join(directory, entry.name)))
        .filter((ledger) => isLedger(ledger));
}

const PARTIAL_MARK = 'partial';

export function markPartial(directory: string): void {
    mkdirSync(directory, { recursive: true });
    // Stryker disable next-line StringLiteral: the mark is read by its existence alone
    writeFileSync(join(directory, PARTIAL_MARK), '');
}

export function partialShards(directory: string): string[] {
    return entriesOf(directory)
        .filter((entry) => isShard(entry) && existsSync(join(directory, entry.name, PARTIAL_MARK)))
        .map((entry) => entry.name)
        .toSorted();
}

export function readShardLedgers(directory: string): Ledger[] {
    return entriesOf(directory)
        .filter((entry) => isShard(entry))
        .flatMap((entry) => readLedgers(join(directory, entry.name)));
}

export function measure(ledgers: readonly Ledger[]): Ledger {
    const tables = ledgers.map((ledger) => ledger.declared);
    return {
        declared: tables.every((table) => table !== undefined) ? tables.flat() : undefined,
        reached: ledgers.flatMap((ledger) => ledger.reached),
    };
}

// Stryker disable all: only the api project's setup provides it, which no module test runs, so every read answers undefined; the api specs judge it
export async function routesLedger(): Promise<string | undefined> {
    try {
        const { inject } = await import('vitest');
        return inject('routesLedger');
    } catch {
        return undefined;
    }
}
// Stryker restore all

declare module 'vitest' {
    interface ProvidedContext {
        routesLedger?: string;
    }
}
