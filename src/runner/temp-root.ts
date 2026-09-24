import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

/**
 * The global setup every preset project carries: the run's own temp root.
 *
 * Every scratch folder a run makes — a command spec's working directory, a
 * worker's database copy, what a checker a spec spawns writes — is a
 * `mkdtemp` under `os.tmpdir()`. The setup points `TMPDIR` (and `TMP`/`TEMP`,
 * its Windows spellings) at ONE folder of the run before any worker starts,
 * so every such call, in a worker or in a child it spawns, lands inside it;
 * the teardown removes that folder whole and puts the variables back.
 *
 * Every project of a run reaches the same root: the first setup makes it, the
 * others join it, and the teardown of the setup that made it removes it —
 * vitest tears the setups down once every project has run. A root whose run died
 * before its teardown carries that run's pid in its name, and the next run
 * sweeps it.
 */

/** The prefix of a run's temp root, below the system temp directory. */
export const TEMP_ROOT_PREFIX = 'jterrazz-test-run-';

/** The variables a runtime reads its temp directory from. */
const TEMP_VARIABLES = ['TMPDIR', 'TMP', 'TEMP'] as const;

/** Is the process of that pid still running? */
function isAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return error instanceof Error && 'code' in error && error.code === 'EPERM';
    }
}

/** Remove every temp root, below `system`, whose run no longer exists. */
export function sweepOrphanRoots(system: string): void {
    for (const entry of readdirSync(system)) {
        if (!entry.startsWith(TEMP_ROOT_PREFIX)) {
            continue;
        }
        const pid = Number(entry.slice(TEMP_ROOT_PREFIX.length).split('-')[0]);
        if (Number.isInteger(pid) && pid > 0 && !isAlive(pid)) {
            rmSync(join(system, entry), { force: true, recursive: true });
        }
    }
}

/** Set each variable to its value, or unset it where the value is absent. */
function setVariables(values: Record<string, string | undefined>): void {
    for (const [name, value] of Object.entries(values)) {
        if (value === undefined) {
            // env-sanction: the temp-directory variables, restored to absent
            Reflect.deleteProperty(process.env, name);
        } else {
            // env-sanction: the temp-directory variables, pointed at the root
            process.env[name] = value;
        }
    }
}

/**
 * Each project loads this module anew, so the run is recognised by the
 * variable itself: a temp directory that is a root of this process is joined.
 */
function joinedRoot(): boolean {
    return basename(tmpdir()).startsWith(`${TEMP_ROOT_PREFIX}${process.pid}-`);
}

export default function setup(): () => void {
    if (joinedRoot()) {
        return () => {
            // The root is removed by the teardown of the setup that made it.
        };
    }
    const system = tmpdir();
    sweepOrphanRoots(system);
    const root = mkdtempSync(join(system, `${TEMP_ROOT_PREFIX}${process.pid}-`));
    const previous = Object.fromEntries(
        // env-sanction: the temp-directory variables, read to be restored
        TEMP_VARIABLES.map((name) => [name, process.env[name]]),
    );
    setVariables(Object.fromEntries(TEMP_VARIABLES.map((name) => [name, root])));
    return () => {
        setVariables(previous);
        rmSync(root, { force: true, recursive: true });
    };
}
