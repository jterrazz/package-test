import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { VITEST_ARTIFACTS_DIR } from '../../../kernel/files/artifacts.js';
import type { Route, SentRequest } from './routes.js';

/*
 * The run's route ledgers. Each specification writes its ledger — the routes
 * its app declares, the requests it sent — when it cleans up; the api
 * project's global teardown reads every ledger of the run, a split run's
 * shards each in a folder of their own.
 */

/**
 * What one specification of the run declared and sent — `declared` absent
 * when its app exposes no route table.
 */
export type Ledger = { declared?: Route[] | undefined; reached: SentRequest[] };

/** Where the run's ledgers are written, below the project root. */
export const ROUTES_DIR = `${VITEST_ARTIFACTS_DIR}/routes`;

/** One shard of a split run: its index, from 1, and the count of shards. */
export type Shard = { count: number; index: number };

/**
 * Where one shard of a split run writes its ledgers, below the project root —
 * a folder of its own in the run's, so a whole run clears every shard's too.
 */
export function shardLedgersDir(shard: Shard): string {
    return `${ROUTES_DIR}/shard-${shard.index}-${shard.count}`;
}

/** Forget the ledgers a previous run left in `directory` — the run measures from nothing. */
export function clearLedgers(directory: string): void {
    rmSync(directory, { force: true, recursive: true });
}

/** Write one specification's ledger into the run's `directory`, under a name no other takes. */
export function writeLedger(directory: string, ledger: Ledger): void {
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, `${randomUUID()}.json`), `${JSON.stringify(ledger)}\n`);
}

/** Every ledger the run wrote into `directory`. */
export function readLedgers(directory: string): Ledger[] {
    if (!existsSync(directory)) {
        return [];
    }
    return readdirSync(directory)
        .filter((name) => name.endsWith('.json'))
        .map((name) => JSON.parse(readFileSync(join(directory, name), 'utf8')) as Ledger);
}

/** The file a shard that ran only some of its tests (`-t`) leaves beside its ledgers. */
const PARTIAL_MARK = 'partial';

/** Mark a shard's ledger folder as a part of its shard's tests: its merge is no whole run. */
export function markPartial(directory: string): void {
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, PARTIAL_MARK), '');
}

/** The shard folders of `directory` whose shard ran only some of its tests. */
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

/** Every ledger the shards of a split run wrote into their folders of `directory`. */
export function readShardLedgers(directory: string): Ledger[] {
    if (!existsSync(directory)) {
        return [];
    }
    return readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith('shard-'))
        .flatMap((entry) => readLedgers(join(directory, entry.name)));
}

/**
 * The run's measure: the routes declared and the requests sent, over every
 * ledger — `declared` absent when a specification's app exposed no table.
 */
export function measure(ledgers: readonly Ledger[]): Ledger {
    const tables = ledgers.map((ledger) => ledger.declared);
    return {
        declared: tables.every((table) => table !== undefined) ? tables.flat() : undefined,
        reached: ledgers.flatMap((ledger) => ledger.reached),
    };
}

/**
 * Where the run collects route ledgers, read on the worker's side — what the
 * api project's global setup provides; `undefined` for a run that measures no
 * route coverage.
 */
export async function routesLedger(): Promise<string | undefined> {
    try {
        const { inject } = await import('vitest');
        return inject('routesLedger');
    } catch {
        return undefined;
    }
}

/** Where the run collects the ledgers — the path the api project's global setup provides to its workers. */
declare module 'vitest' {
    // oxlint-disable-next-line typescript/consistent-type-definitions -- a module augmentation MERGES only as an interface; a type alias redeclares the name and every member is lost
    interface ProvidedContext {
        /** Where each api specification writes its route ledger. */
        routesLedger?: string;
    }
}
