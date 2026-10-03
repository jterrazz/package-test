import { hostname } from 'node:os';
import { describe, expect, test } from 'vitest';

import { fakePeer } from './testcontainers.adapter.fixtures.js';
import type { BuildLog } from './testcontainers.adapter.fixtures.js';
import {
    containerLabels,
    processOwner,
    reuseEnabled,
    TestcontainersAdapter,
} from './testcontainers.adapter.js';

describe('TestcontainersAdapter', () => {
    test('testcontainers adapter — a container never started — has no logs, and no address', async () => {
        // Given - an adapter nothing ever started
        const never = new TestcontainersAdapter({ image: 'postgres:17', port: 5432 });

        // Then - log capture answers empty rather than throwing, and its address is a framework fault
        await expect(never.getLogs()).resolves.toBe('');
        expect(() => never.getHost()).toThrow('a container was read before it started');
        expect(() => never.getMappedPort(5432)).toThrow('a container was read before it started');
    });

    test('container reuse — is asked for by TESTCONTAINERS_REUSE_ENABLE=true, and never on CI', () => {
        // Given - the environments a run starts in
        const decided = {
            asked: reuseEnabled({ TESTCONTAINERS_REUSE_ENABLE: 'true' }),
            askedOnCi: reuseEnabled({ CI: 'true', TESTCONTAINERS_REUSE_ENABLE: 'true' }),
            askedWithCiBlank: reuseEnabled({ CI: '', TESTCONTAINERS_REUSE_ENABLE: 'true' }),
            askedWithCiOff: reuseEnabled({ CI: 'false', TESTCONTAINERS_REUSE_ENABLE: 'true' }),
            declined: reuseEnabled({ TESTCONTAINERS_REUSE_ENABLE: 'false' }),
            unasked: reuseEnabled({}),
        };

        // Then - only a local run that asked reuses
        expect(decided).toStrictEqual({
            asked: true,
            askedOnCi: false,
            askedWithCiBlank: true,
            askedWithCiOff: true,
            declined: false,
            unasked: false,
        });
    });

    test('container reuse — labels every container, a reused one as outliving the run, and any other with its owner', () => {
        // Given - the labels of a container of the run, and of a reused one, asked by one owner
        const labels = {
            reused: containerLabels(true, 'host:42'),
            run: containerLabels(false, 'host:42'),
        };

        // Then - both carry the package's label; only the reused one says it outlives the run, and only the other names its owner
        expect(labels).toStrictEqual({
            reused: { 'com.jterrazz.test': 'true', 'com.jterrazz.test.reuse': 'true' },
            run: { 'com.jterrazz.test': 'true', 'com.jterrazz.test.owner': 'host:42' },
        });
    });

    test('testcontainers adapter — builds the container the request states, waits on a postgres until it accepts connections, and answers where it listens', async () => {
        // Given - a postgres with an environment, a command and a tmpfs, and a bare redis
        const log: BuildLog = [];
        const postgres = new TestcontainersAdapter(
            {
                command: ['-c', 'fsync=off'],
                env: { POSTGRES_DB: 'app', POSTGRES_USER: 'test' },
                image: 'postgres:17-alpine',
                port: 5432,
                reuse: false,
                tmpfs: { '/var/lib/postgresql/data': 'rw' },
            },
            fakePeer(log),
        );
        const redis = new TestcontainersAdapter(
            { image: 'redis:7-alpine', port: 6379, reuse: false },
            fakePeer(log),
        );

        // When - each starts
        await postgres.start();
        await redis.start();

        // Then - each built as stated, and reached on its mapped port
        expect([log, postgres.getConnectionString()]).toStrictEqual([
            [
                'image postgres:17-alpine',
                'port 5432',
                'labels com.jterrazz.test,com.jterrazz.test.owner',
                'env {"POSTGRES_DB":"app"}',
                'env {"POSTGRES_USER":"test"}',
                'command -c fsync=off',
                'tmpfs {"/var/lib/postgresql/data":"rw"}',
                'wait /database system is ready to accept connections/u x2',
                'image redis:7-alpine',
                'port 6379',
                'labels com.jterrazz.test,com.jterrazz.test.owner',
            ],
            'docker.test:35432',
        ]);
    });

    test('testcontainers adapter — a reused container is marked so, and outlives its stop; a container of the run stops once', async () => {
        // Given - a reused redis and one of the run, both started
        const log: BuildLog = [];
        const reused = new TestcontainersAdapter(
            { image: 'redis:7-alpine', port: 6379, reuse: true },
            fakePeer(log),
        );
        const owned = new TestcontainersAdapter(
            { image: 'redis:8-alpine', port: 6379, reuse: false },
            fakePeer(log),
        );
        await reused.start();
        await owned.start();

        // When - each is stopped twice
        for (const adapter of [reused, owned, reused, owned]) {
            await adapter.stop();
        }

        // Then - the reused one built with reuse and never stopped, the other stopped once
        expect(log.filter((line) => /^(?:labels|reuse|stop) /u.test(`${line} `))).toStrictEqual([
            'labels com.jterrazz.test,com.jterrazz.test.reuse',
            'reuse',
            'labels com.jterrazz.test,com.jterrazz.test.owner',
            'stop redis:8-alpine',
        ]);
    });

    test('testcontainers adapter — reads a started container’s logs, since a moment in seconds', async () => {
        // Given - a started container
        const log: BuildLog = [];
        const adapter = new TestcontainersAdapter(
            { image: 'redis:7-alpine', port: 6379, reuse: false },
            fakePeer(log),
        );
        await adapter.start();

        // When - its logs are read whole, then since a moment
        const whole = await adapter.getLogs();
        const since = await adapter.getLogs(new Date('2026-01-01T00:00:00.500Z'));

        // Then - the text it logged, and the moment asked in seconds
        expect([whole, since, log.filter((line) => line.startsWith('logs'))]).toStrictEqual([
            'redis:7-alpine booted\nready\n',
            'redis:7-alpine booted\nready\n',
            ['logs undefined', 'logs {"since":1767225600.5}'],
        ]);
    });

    test('container reuse — names this process as the owner, host and pid', () => {
        // Given - the process this test runs in
        // Then - the owner is where a sweep can ask whether it still runs
        expect(processOwner()).toBe(`${hostname()}:${process.pid}`);
    });
});
