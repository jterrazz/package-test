// ── Colors ──

const GREEN = '\u001B[32m';
const RED = '\u001B[31m';
const DIM = '\u001B[2m';
const BOLD = '\u001B[1m';
const RESET = '\u001B[0m';
const BG_CYAN = '\u001B[46m';
const BLACK = '\u001B[30m';

// ── Symbols (vitest-native) ──

const CHECK = '✓';
const CROSS = '×';
const ARROW = '→';

// ── Types ──

/** Status report for a single infrastructure service after startup. */
export type ServiceReport = {
    name: string;
    type: string;
    connectionString?: string;
    durationMs: number;
    error?: string;
    logs?: string;
};

/**
 * What the subject IS, for the line the startup report closes on.
 *
 * Four shapes, because there are four: an app built and served inside this
 * process (api), a child process the runner started and polls (a site's dev
 * server), a deployment already running somewhere (`url`), and a subject that
 * is not an app at all — a binary, a pipeline, a module, a screen — which gets
 * no line rather than a wrong one.
 */
export type AppInfo = {
    /** The command, for a child process. */
    command?: string | undefined;
    type: 'http' | 'in-process' | 'none' | 'process';
    url?: string | undefined;
};

/** The subject, in the words of the thing that started it. */
function describeApp(app: AppInfo): string {
    if (app.type === 'in-process') {
        return 'in-process (Hono)';
    }
    if (app.type === 'process') {
        return app.command === undefined ? 'a child process' : `${app.command} (child process)`;
    }
    return app.url ?? '';
}

// ── Startup report ──

/**
 * The block printed while the world comes up: one line per declared service,
 * then the app the subject is. There is one shape of world to report on, so the
 * report takes no mode — the parameter that named one left with compose mode
 * (ADR-007).
 */
export function formatStartupReport(services: ServiceReport[], app?: AppInfo): string {
    const lines: string[] = [];

    lines.push('', `${BG_CYAN}${BLACK}${BOLD} INFRA ${RESET} Starting infrastructure...`, '');

    for (const service of services) {
        if (service.error) {
            lines.push(
                `  ${RED}${CROSS}${RESET} ${service.type} (${service.name})  ${RED}${service.error}${RESET}  ${DIM}${service.durationMs}ms${RESET}`,
            );
            if (service.logs) {
                const logLines = service.logs.trim().split('\n').slice(-10);
                for (const logLine of logLines) {
                    lines.push(`    ${DIM}${logLine}${RESET}`);
                }
            }
        } else {
            const conn = service.connectionString
                ? `${DIM}${service.connectionString}${RESET}`
                : '';
            lines.push(
                `  ${GREEN}${CHECK}${RESET} ${service.type} (${service.name})  ${conn}  ${DIM}${service.durationMs}ms${RESET}`,
            );
        }
    }

    if (app && app.type !== 'none') {
        lines.push('', `  ${DIM}${ARROW} app: ${describeApp(app)}${RESET}`);
    }

    lines.push('');

    return lines.join('\n');
}
