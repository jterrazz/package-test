// ── Colors ──

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";
const BG_CYAN = "\x1b[46m";
const BLACK = "\x1b[30m";

// ── Symbols (vitest-native) ──

const CHECK = "✓";
const CROSS = "×";
const ARROW = "→";
const DASH = "⎯";

// ── Types ──

export interface ServiceReport {
  name: string;
  type: string;
  connectionString?: string;
  durationMs: number;
  error?: string;
  logs?: string;
}

export interface AppInfo {
  type: "http" | "in-process";
  url?: string;
}

// ── Startup report ──

export function formatStartupReport(
  mode: "e2e" | "integration",
  services: ServiceReport[],
  app?: AppInfo,
): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(`${BG_CYAN}${BLACK}${BOLD} INFRA ${RESET} Starting infrastructure...`);
  lines.push("");

  for (const service of services) {
    if (service.error) {
      lines.push(
        `  ${RED}${CROSS}${RESET} ${service.type} (${service.name})  ${RED}${service.error}${RESET}  ${DIM}${service.durationMs}ms${RESET}`,
      );
      if (service.logs) {
        const logLines = service.logs.trim().split("\n").slice(-10);
        for (const logLine of logLines) {
          lines.push(`    ${DIM}${logLine}${RESET}`);
        }
      }
    } else {
      const conn = service.connectionString ? `${DIM}${service.connectionString}${RESET}` : "";
      lines.push(
        `  ${GREEN}${CHECK}${RESET} ${service.type} (${service.name})  ${conn}  ${DIM}${service.durationMs}ms${RESET}`,
      );
    }
  }

  if (app) {
    lines.push("");
    if (app.type === "in-process") {
      lines.push(`  ${DIM}${ARROW} app: in-process (Hono)${RESET}`);
    } else {
      lines.push(`  ${DIM}${ARROW} app: ${app.url}${RESET}`);
    }
  }

  lines.push("");

  return lines.join("\n");
}

// ── Error divider ──

export function formatErrorDivider(label: string): string {
  const dashes = DASH.repeat(30);
  return `\n${RED}${dashes} ${label} ${dashes}${RESET}\n`;
}

// ── Status error ──

export function formatStatusError(
  expectedStatus: number,
  receivedStatus: number,
  request: { method: string; path: string; body?: unknown },
  responseBody: unknown,
): string {
  const lines: string[] = [];

  lines.push(`Expected status: ${GREEN}${expectedStatus}${RESET}`);
  lines.push(`Received status: ${RED}${receivedStatus}${RESET}`);
  lines.push("");
  lines.push(`${DIM}${request.method} ${request.path}${RESET}`);

  if (request.body) {
    lines.push(formatJson(request.body, DIM));
  }

  if (responseBody) {
    lines.push("");
    lines.push(`${DIM}Response:${RESET}`);
    lines.push(formatJson(responseBody, RED));
  }

  return lines.join("\n");
}

// ── Table diff ──

export function formatTableDiff(
  table: string,
  columns: string[],
  expected: unknown[][],
  actual: unknown[][],
): string {
  const lines: string[] = [];

  lines.push(`Table "${table}" mismatch`);
  lines.push(`${DIM}  query: ${columns.join(", ")}${RESET}`);
  lines.push(`${DIM}  expected: ${rowLabel(expected.length)}${RESET}`);
  lines.push(`${DIM}  received: ${rowLabel(actual.length)}${RESET}`);
  lines.push("");
  lines.push(`${GREEN}- Expected${RESET}`);
  lines.push(`${RED}+ Received${RESET}`);
  lines.push("");

  const header = columns.join("  |  ");
  lines.push(`${DIM}  ${header}${RESET}`);

  const maxRows = Math.max(expected.length, actual.length);

  for (let i = 0; i < maxRows; i++) {
    const exp = expected[i];
    const act = actual[i];

    if (exp && !act) {
      lines.push(`${GREEN}- ${formatRow(exp)}${RESET}`);
    } else if (!exp && act) {
      lines.push(`${RED}+ ${formatRow(act)}${RESET}`);
    } else if (exp && act) {
      const same = JSON.stringify(exp) === JSON.stringify(act);
      if (same) {
        lines.push(`  ${formatRow(act)}`);
      } else {
        lines.push(`${GREEN}- ${formatRow(exp)}${RESET}`);
        lines.push(`${RED}+ ${formatRow(act)}${RESET}`);
      }
    }
  }

  if (expected.length === 0 && actual.length === 0) {
    lines.push(`  (empty)`);
  }

  return lines.join("\n");
}

// ── Response diff ──

export function formatResponseDiff(file: string, expected: unknown, actual: unknown): string {
  const lines: string[] = [];

  lines.push(`Response mismatch (${file})`);
  lines.push("");
  lines.push(`${GREEN}- Expected${RESET}`);
  lines.push(`${RED}+ Received${RESET}`);
  lines.push("");

  const expectedLines = JSON.stringify(expected, null, 2).split("\n");
  const actualLines = JSON.stringify(actual, null, 2).split("\n");
  const maxLines = Math.max(expectedLines.length, actualLines.length);

  for (let i = 0; i < maxLines; i++) {
    const exp = expectedLines[i];
    const act = actualLines[i];

    if (exp === act) {
      lines.push(`  ${exp}`);
    } else {
      if (exp !== undefined) {
        lines.push(`${GREEN}- ${exp}${RESET}`);
      }
      if (act !== undefined) {
        lines.push(`${RED}+ ${act}${RESET}`);
      }
    }
  }

  return lines.join("\n");
}

// ── Exit code error ──

export function formatExitCodeError(
  expected: number,
  received: number,
  stdout: string,
  stderr: string,
): string {
  const lines: string[] = [];

  lines.push(`Expected exit code: ${GREEN}${expected}${RESET}`);
  lines.push(`Received exit code: ${RED}${received}${RESET}`);

  if (stdout.trim()) {
    lines.push("");
    lines.push(`${DIM}stdout:${RESET}`);
    for (const line of stdout.trim().split("\n").slice(-15)) {
      lines.push(`  ${DIM}${line}${RESET}`);
    }
  }

  if (stderr.trim()) {
    lines.push("");
    lines.push(`${DIM}stderr:${RESET}`);
    for (const line of stderr.trim().split("\n").slice(-15)) {
      lines.push(`  ${RED}${line}${RESET}`);
    }
  }

  return lines.join("\n");
}

// ── Stdout/stderr diff ──

export function formatStdoutDiff(file: string, expected: string, actual: string): string {
  const lines: string[] = [];

  lines.push(`Output mismatch (${file})`);
  lines.push("");
  lines.push(`${GREEN}- Expected${RESET}`);
  lines.push(`${RED}+ Received${RESET}`);
  lines.push("");

  const expectedLines = expected.split("\n");
  const actualLines = actual.split("\n");
  const maxLines = Math.max(expectedLines.length, actualLines.length);

  for (let i = 0; i < maxLines; i++) {
    const exp = expectedLines[i];
    const act = actualLines[i];

    if (exp === act) {
      lines.push(`  ${exp}`);
    } else {
      if (exp !== undefined) {
        lines.push(`${GREEN}- ${exp}${RESET}`);
      }
      if (act !== undefined) {
        lines.push(`${RED}+ ${act}${RESET}`);
      }
    }
  }

  return lines.join("\n");
}

// ── Directory diff ──

interface DirectoryDiffData {
  added: string[];
  changed: { path: string; expected: string; actual: string }[];
  removed: string[];
}

export function formatDirectoryDiff(
  fixtureName: string,
  diff: DirectoryDiffData,
  hint: string,
): string {
  const lines: string[] = [];

  const total = diff.added.length + diff.removed.length + diff.changed.length;
  lines.push(`Directory mismatch: ${BOLD}${fixtureName}${RESET}`);
  lines.push(
    `${DIM}  ${total} difference${total === 1 ? "" : "s"}: ${diff.added.length} added, ${diff.removed.length} removed, ${diff.changed.length} changed${RESET}`,
  );
  lines.push("");
  lines.push(`${GREEN}- Expected (fixture)${RESET}`);
  lines.push(`${RED}+ Received (generated)${RESET}`);
  lines.push("");

  for (const path of diff.added) {
    lines.push(`${RED}+ added    ${path}${RESET}  ${DIM}(not in fixture)${RESET}`);
  }
  for (const path of diff.removed) {
    lines.push(`${GREEN}- removed  ${path}${RESET}  ${DIM}(in fixture, not generated)${RESET}`);
  }
  for (const { path, expected, actual } of diff.changed) {
    const expectedLines = expected.split("\n");
    const actualLines = actual.split("\n");
    const changedCount = countLineDifferences(expectedLines, actualLines);
    lines.push(
      `${BOLD}~ changed  ${path}${RESET}  ${DIM}(${changedCount} line${changedCount === 1 ? "" : "s"} differ)${RESET}`,
    );

    let shown = 0;
    const maxShown = 5;
    const maxLines = Math.max(expectedLines.length, actualLines.length);
    for (let i = 0; i < maxLines && shown < maxShown; i++) {
      const exp = expectedLines[i];
      const act = actualLines[i];
      if (exp !== act) {
        lines.push(`${DIM}    line ${i + 1}:${RESET}`);
        if (exp !== undefined) {
          lines.push(`    ${GREEN}- ${exp}${RESET}`);
        }
        if (act !== undefined) {
          lines.push(`    ${RED}+ ${act}${RESET}`);
        }
        shown++;
      }
    }
    if (changedCount > maxShown) {
      lines.push(`    ${DIM}... ${changedCount - maxShown} more line(s)${RESET}`);
    }
  }

  lines.push("");
  lines.push(`${DIM}${hint}${RESET}`);

  return lines.join("\n");
}

function countLineDifferences(expected: string[], actual: string[]): number {
  let count = 0;
  const max = Math.max(expected.length, actual.length);
  for (let i = 0; i < max; i++) {
    if (expected[i] !== actual[i]) {
      count++;
    }
  }
  return count;
}

// ── File assertions ──

export function formatFileMissing(path: string): string {
  return `Expected file to exist: ${RED}${path}${RESET}`;
}

export function formatFileUnexpected(path: string): string {
  return `Expected file NOT to exist: ${RED}${path}${RESET}`;
}

export function formatFileContentMismatch(path: string, expected: string, actual: string): string {
  const lines: string[] = [];
  lines.push(`File "${path}" does not contain expected content`);
  lines.push("");
  lines.push(`${GREEN}Expected to contain:${RESET}`);
  lines.push(`  ${GREEN}${expected}${RESET}`);
  lines.push("");
  lines.push(`${RED}Actual content (first 20 lines):${RESET}`);
  for (const line of actual.split("\n").slice(0, 20)) {
    lines.push(`  ${DIM}${line}${RESET}`);
  }
  return lines.join("\n");
}

// ── Service logs section ──

export function formatServiceLogs(services: { name: string; logs: string }[]): string {
  const lines: string[] = [];

  for (const { name, logs } of services) {
    if (!logs.trim()) {
      continue;
    }

    lines.push("");
    lines.push(`${DIM}${name} logs (last 10 lines):${RESET}`);

    const logLines = logs.trim().split("\n").slice(-10);
    for (const line of logLines) {
      lines.push(`  ${DIM}${line}${RESET}`);
    }
  }

  return lines.join("\n");
}

// ── Helpers ──

function rowLabel(n: number): string {
  return n === 1 ? "1 row" : `${n} rows`;
}

function formatJson(value: unknown, color: string): string {
  return JSON.stringify(value, null, 2)
    .split("\n")
    .map((line) => `${color}${line}${RESET}`)
    .join("\n");
}

function formatRow(row: unknown[]): string {
  return row.map((v) => String(v ?? "null")).join("  |  ");
}

// ── Test utilities ──

export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

export function normalizeOutput(str: string): string {
  return stripAnsi(str)
    .replace(/localhost:\d+/g, "localhost:PORT")
    .replace(/\d+ms/g, "Xms")
    .replace(/\d+\.\d+s/g, "X.Xs")
    .trim();
}
