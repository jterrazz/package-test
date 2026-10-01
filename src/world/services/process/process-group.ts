import { pause } from '../../../kernel/pause.js';

export const KILL_GRACE_MS = 2000;
const GROUP_POLL_MS = 1000;
const GROUP_SETTLE_MS = 50;

export const WATCHDOG = `
const group = -Number(process.argv[1]);
const gone = () => { try { process.kill(group, 0); return false; } catch { return true; } };
const end = () => {
    try { process.kill(group, 'SIGTERM'); } catch { process.exit(0); }
    setTimeout(() => { try { process.kill(group, 'SIGKILL'); } catch {} process.exit(0); }, ${KILL_GRACE_MS});
};
process.stdin.on('end', end);
process.stdin.on('error', end);
process.stdin.resume();
setInterval(() => { if (gone()) process.exit(0); }, ${GROUP_POLL_MS});
`;

function groupRunning(group: number): boolean {
    try {
        process.kill(group, 0);
        return true;
    } catch {
        return false;
    }
}

export async function groupEnded(group: number, deadline: number): Promise<boolean> {
    if (!groupRunning(group)) {
        return true;
    }
    if (Date.now() >= deadline) {
        return false;
    }
    await pause(GROUP_SETTLE_MS);
    return await groupEnded(group, deadline);
}
