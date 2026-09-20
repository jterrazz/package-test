import { asOxlintRule, ruleTester } from '../rule-tester.fixtures.js';
import { d19wProbeCluster } from './d19w-probe-cluster.js';

const SPEC_FILE = '/repo/specs/cli/build/build.spec.ts';

ruleTester().run('d19w-probe-cluster', asOxlintRule(d19wProbeCluster), {
    invalid: [
        // Three greps where a golden would say the whole thing.
        {
            code: `test('builds', async () => {
                const result = await cli.exec('build');
                expect(result.stdout).toContain('compiled');
                expect(result.stdout).toContain('2 files');
                expect(result.stdout).toContain('done');
            });`,
            errors: [{ messageId: 'cluster' }],
            filename: SPEC_FILE,
        },
        // Two subjects, each with its own cluster.
        {
            code: `test('builds', async () => {
                const result = await cli.exec('build');
                expect(result.stdout).toContain('compiled');
                expect(result.stdout).toContain('2 files');
                expect(result.stdout).toMatch(/done/);
                expect(result.stderr).toContain('warn: a');
                expect(result.stderr).toContain('warn: b');
                expect(result.stderr).toContain('warn: c');
            });`,
            errors: [{ messageId: 'cluster' }, { messageId: 'cluster' }],
            filename: SPEC_FILE,
        },
    ],
    valid: [
        // Two probes are a scalpel, not a cluster.
        {
            code: `test('builds', async () => {
                const result = await cli.exec('build');
                expect(result.stdout).toContain('compiled');
                expect(result.stdout).toContain('done');
            });`,
            filename: SPEC_FILE,
        },
        // The golden on the same subject answers for all of it.
        {
            code: `test('builds', async () => {
                const result = await cli.exec('build');
                expect(result.stdout).toMatch('build.txt');
                expect(result.stdout).toContain('compiled');
                expect(result.stdout).toContain('2 files');
                expect(result.stdout).toContain('done');
            });`,
            filename: SPEC_FILE,
        },
        // A status is one value: d15w owns that test, not this one.
        {
            code: `test('answers', async () => {
                const result = await api.get('/health');
                expect(result.status).toBe(200);
                expect(result.status).toBe(200);
                expect(result.status).toBe(200);
            });`,
            filename: SPEC_FILE,
        },
        // The threshold is an option.
        {
            code: `test('builds', async () => {
                const result = await cli.exec('build');
                expect(result.stdout).toContain('compiled');
                expect(result.stdout).toContain('2 files');
                expect(result.stdout).toContain('done');
            });`,
            filename: SPEC_FILE,
            options: [{ threshold: 4 }],
        },
    ],
});
