import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PLUGIN = 'jterrazz';

export type PluginDiagnostic = {
    code: string;
    column: number;
    file: string;
    line: number;
    message: string;
    severity: 'error' | 'warn';
};

/** Never one found above the root: a fixture project inside another repository would be linted with that repository's config. */
export function oxlintOf(root: string): string | undefined {
    const candidate = join(root, 'node_modules', '.bin', 'oxlint');
    return existsSync(candidate) ? candidate : undefined;
}

type OxlintReport = {
    diagnostics?: {
        code?: string;
        filename?: string;
        labels?: { span?: { column?: number; line?: number } }[];
        message?: string;
        severity?: string;
    }[];
};

function diagnosticsIn(json: string, source: string): PluginDiagnostic[] {
    let report: OxlintReport;
    try {
        report = JSON.parse(json) as OxlintReport;
    } catch {
        throw new Error(`the checker read ${source} for the ratchet and it holds no JSON report`);
    }
    return (report.diagnostics ?? [])
        .filter((diagnostic) => (diagnostic.code ?? '').startsWith(`${PLUGIN}(`))
        .map((diagnostic) => {
            const span = diagnostic.labels?.[0]?.span;
            return {
                code: diagnostic.code ?? '',
                column: span?.column ?? 1,
                file: diagnostic.filename ?? '',
                line: span?.line ?? 1,
                message: diagnostic.message ?? '',
                severity: diagnostic.severity === 'error' ? 'error' : 'warn',
            };
        });
}

/** The toolchain sets these aside, so they are judged here or nowhere. Without a report, the project's own oxlint runs without `--type-aware`: the plugin's rules never read a type. */
export function pluginDiagnostics(root: string, report?: string): PluginDiagnostic[] {
    if (report !== undefined) {
        return diagnosticsIn(readFileSync(report, 'utf8'), report);
    }
    const oxlint = oxlintOf(root);
    if (oxlint === undefined) {
        return [];
    }
    const run = spawnSync(oxlint, ['--format', 'json'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
    });
    try {
        return diagnosticsIn(run.stdout, oxlint);
    } catch {
        throw new Error(
            `the checker ran ${oxlint} for the ratchet and it wrote no JSON report:\n${run.stderr}`,
        );
    }
}
