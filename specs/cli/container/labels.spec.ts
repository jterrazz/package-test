import { execSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';

import { cli as dockerCli } from '../docker-cli.specification.js';

// invariant: asked of `docker` directly, a second opinion: reading it through the dispose path's helper would agree with the code by construction.
function containersLabelled(key: string, value: string): string[] {
    try {
        return execSync(`docker ps -aq -f label=${key}=${value}`, {
            encoding: 'utf8',
            timeout: 10_000,
        })
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
    } catch {
        return [];
    }
}

/* invariant: a live container's log stream is cut at an arbitrary instant: targeted probes, `output-asserted-as-a-golden` scalpel. */

describe('labels', () => {
    test('reads a spawned container: its state, its files and a command run inside it', async () => {
        // Given - a run that spawned the container named test-a
        await using result = await dockerCli.exec('spawn test-a');
        const neo = result.container('test-a');
        const file = neo.file('/workspace/out.txt');
        const inside = await neo.exec('ls /workspace');

        // Then - the accessor reads the container as the daemon reports it
        expect({
            file: { content: file.content.trim(), exists: file.exists },
            inside: {
                exitCode: inside.exitCode,
                listsOut: inside.stdout.text.split('\n').includes('out.txt'),
                stderr: inside.stderr.text,
            },
            run: result.exitCode,
            state: { exists: neo.exists, status: neo.status },
        }).toMatchObject({
            file: { content: 'hello-from-test-a', exists: true },
            inside: { exitCode: 0, listsOut: true, stderr: '' },
            run: 0,
            state: { exists: true, status: 'running' },
        });
        await expect(neo).toBeRunning();
    }, 60_000);

    test('names an unknown container absent, and refuses to call it running', async () => {
        // Given - a run that spawned one container, and a name it never spawned
        await using result = await dockerCli.exec('spawn test-a');

        // Then - the unknown name reads absent, and the matcher refuses it
        expect(result.container('nope').exists).toBe(false);
        await expect(expect(result.container('nope')).toBeRunning()).rejects.toThrow(
            /does not exist/u,
        );
    }, 60_000);

    test('tracks a spawned container under the run label, and removes it on dispose', async () => {
        // Given - the runner's injected test-run id, the label scope the dispose path queries
        await using idRun = await dockerCli.exec('label');
        const runId = idRun.stdout.text.trim();
        let trackedId: string | undefined;

        {
            await using result = await dockerCli.exec('spawn test-a');
            trackedId = result.containerIds[0];

            // Then - while the scope is live the id carries the run label, which makes the after-dispose assertion falsifiable
            expect(trackedId).toMatch(/^[\da-f]{12}$/u);
            expect(containersLabelled('fake.test.run', runId)).toContain(trackedId);
        }

        // Then - scope exit disposed the container: the same label query the runner uses comes back empty
        expect(containersLabelled('fake.test.run', runId)).toStrictEqual([]);
    }, 60_000);

    // RUNTIME containers-removed-with-the-run — the capture is docker-aware: every container a run spawned carries its run label, and the scope's exit removes them.
    test('dispose removes containers even when the run was never asserted on', async () => {
        // Given - the runner's test-run id, read from the injected child env
        await using idRun = await dockerCli.exec('label');
        const runId = idRun.stdout.text.trim();
        expect(runId).not.toBe('unset');

        {
            // Given - a spawn whose containers are never touched via .container()
            await using result = await dockerCli.exec('spawn never-asserted');
            expect(result.exitCode).toBe(0);
        }

        // Then - scope exit removed every container carrying the run label
        expect(containersLabelled('fake.test.run', runId)).toStrictEqual([]);
    }, 60_000);

    test('a label no container carries queries clean, so the oracle is falsifiable', () => {
        // Given - a label value that no container carries
        const ids = containersLabelled('nonexistent.label.key', 'definitely-not-a-real-run-id');

        // Then - empty result, no throw: an empty answer above means REMOVED, not "the query never worked"
        expect(ids).toStrictEqual([]);
    });
});
