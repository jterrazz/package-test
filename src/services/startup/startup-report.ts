const GREEN = '\u001B[32m';
const RED = '\u001B[31m';
const DIM = '\u001B[2m';
const BOLD = '\u001B[1m';
const RESET = '\u001B[0m';
const BG_CYAN = '\u001B[46m';
const BLACK = '\u001B[30m';

const CHECK = '✓';
const CROSS = '×';
const ARROW = '→';

export type ServiceReport = {
    name: string;
    type: string;
    connectionString?: string;
    durationMs: number;
    error?: string;
    logs?: string;
};

export type AppInfo = {
    command?: string | undefined;
    type: 'http' | 'in-process' | 'none' | 'process';
    url?: string | undefined;
};

function describeApp(app: AppInfo): string {
    if (app.type === 'in-process') {
        return 'in-process (Hono)';
    }
    if (app.type === 'process') {
        return app.command === undefined ? 'a child process' : `${app.command} (child process)`;
    }
    return app.url ?? '';
}

/** One line per declared service, then the app the subject is. */
export function formatStartupReport(services: ServiceReport[], app?: AppInfo): string {
    const lines: string[] = [
        '',
        `${BG_CYAN}${BLACK}${BOLD} INFRA ${RESET} Starting infrastructure...`,
        '',
    ];

    for (const service of services) {
        if (service.error !== undefined && service.error !== '') {
            lines.push(
                `  ${RED}${CROSS}${RESET} ${service.type} (${service.name})  ${RED}${service.error}${RESET}  ${DIM}${service.durationMs}ms${RESET}`,
            );
            if (service.logs !== undefined && service.logs !== '') {
                const logLines = service.logs.trim().split('\n').slice(-10);
                for (const logLine of logLines) {
                    lines.push(`    ${DIM}${logLine}${RESET}`);
                }
            }
        } else {
            const conn =
                service.connectionString === undefined || service.connectionString === ''
                    ? ''
                    : `${DIM}${service.connectionString}${RESET}`;
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
