import type { SpecDocument } from '../../../../lint/kit/project/spec-grammar.js';
import { invariant, refusal } from '../../../chain/refusals/refusal.js';
import { ServedProcess } from '../../../services/process/serve.js';
import type { CliConfig } from '../cli.handle.js';
import type { CliEnv } from '../process/cli.port.js';

/** Every child gets `TEST_WORKDIR`, the resolved working directory, with the fixtures already on disk; the document's own env wins. */
export async function startServers(
    document: SpecDocument,
    config: CliConfig,
    displayPath: string,
    workdir: string,
): Promise<{ env: CliEnv; stop: () => Promise<void> }> {
    const registry = config.serveRegistry ?? {};
    const started: ServedProcess[] = [];
    const env: CliEnv = {};

    const stop = async (): Promise<void> => {
        for (const adapter of started.toReversed()) {
            await adapter.stop();
        }
    };

    for (const entry of document.serve) {
        const registration = registry[entry.name];
        if (!registration) {
            await stop();
            const known = Object.keys(registry);
            throw new Error(
                refusal({
                    fix:
                        known.length === 0
                            ? 'register it in the `serve` option of specification.cli()'
                            : `serve a registered server: ${known.join(', ')}`,
                    found: `${displayPath}:${entry.line}: serve: "${entry.name}" is not registered`,
                    read: 'docs/guides/cli-specs.md#registration-once-per-app',
                    why: 'A document serves what the app registered once, in the options of specification.cli().',
                }),
            );
        }
        const adapter = new ServedProcess(
            { command: registration.command, ready: registration.ready },
            config.root ?? process.cwd(),
            'cli',
            { TEST_WORKDIR: workdir, ...entry.env },
        );
        started.push(adapter);
        try {
            await adapter.start();
        } catch (error) {
            await stop();
            throw error;
        }
        if (adapter.port === null) {
            throw invariant('a served process answered its readiness without a port');
        }
        env[registration.env] = registration.url(adapter.port);
    }

    return { env, stop };
}

export function documentEnv(
    document: SpecDocument,
    config: CliConfig,
    displayPath: string,
): CliEnv {
    const sets = config.envSets ?? {};
    const env: CliEnv = {};
    for (const token of document.env) {
        if (token.kind === 'set') {
            const declared = sets[token.name];
            if (!declared) {
                const known = Object.keys(sets);
                throw new Error(
                    refusal({
                        fix:
                            known.length === 0
                                ? 'register it in the `env` option of specification.cli(), or write it inline: KEY=value'
                                : `name a registered set: ${known.join(', ')}, or write it inline: KEY=value`,
                        found: `${displayPath}:${token.line}: env: "${token.name}" is not a registered env set`,
                        read: 'docs/guides/cli-specs.md#registration-once-per-app',
                        why: 'A bare word under `env:` names a set the app registered once, in the options of specification.cli().',
                    }),
                );
            }
            Object.assign(env, declared);
            continue;
        }
        env[token.key] = token.value;
    }
    return env;
}
