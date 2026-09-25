import type { CliEnv } from '../../model/ports/cli.port.js';

/** `.env(record)`, handing back the chain it was called on. */
export type EnvMethod<Self> = (env: CliEnv) => Self;
