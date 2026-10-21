// invariant: only ESRCH says no process holds the pid: signal 0 to a process another user owns throws EPERM, and that process runs.
export function processAlive(
    pid: number,
    probe: (pid: number) => void = (target) => process.kill(target, 0),
): boolean {
    try {
        probe(pid);
        return true;
    } catch (error) {
        return Reflect.get(new Object(error), 'code') !== 'ESRCH';
    }
}
