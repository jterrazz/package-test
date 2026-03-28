import type { ServiceHandle } from "./services/service.port.js";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

interface ServiceReport {
  handle: ServiceHandle;
  durationMs: number;
  error?: string;
}

/**
 * Print a formatted status report for test infrastructure.
 */
export function printReport(
  mode: "e2e" | "integration",
  services: ServiceReport[],
  appInfo?: { type: string; url?: string },
): void {
  const modeLabel = mode.toUpperCase();
  const line = "─".repeat(50);

  console.log(`\n${CYAN}┌ ${BOLD}${modeLabel}${RESET}${CYAN} ${line}${RESET}`);
  console.log(`${CYAN}│${RESET}`);

  for (const { handle, durationMs, error } of services) {
    const name = handle.composeName ?? handle.type;
    const status = error ? `${RED}✗${RESET}` : `${GREEN}✓${RESET}`;
    const timing = `${DIM}${durationMs}ms${RESET}`;

    if (error) {
      console.log(`${CYAN}│${RESET}  ${status} ${name}  ${RED}${error}${RESET}`);
    } else {
      const conn = handle.connectionString ? `${DIM}${handle.connectionString}${RESET}` : "";
      console.log(`${CYAN}│${RESET}  ${status} ${name}  ${conn}  ${timing}`);
    }
  }

  if (appInfo) {
    console.log(`${CYAN}│${RESET}`);
    const appLabel =
      appInfo.type === "in-process"
        ? `${DIM}App: in-process (Hono)${RESET}`
        : `${DIM}App: ${appInfo.url}${RESET}`;
    console.log(`${CYAN}│${RESET}  ${appLabel}`);
  }

  console.log(`${CYAN}│${RESET}`);
  console.log(`${CYAN}└${line}───${RESET}\n`);
}
