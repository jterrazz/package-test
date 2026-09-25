// The cli facet's face: the names it contributes to `@jterrazz/test`.
export type { CliSpecification } from './cli.facet.js';
export type {
    CliHandle,
    CliSpecificationOptions,
    LiterateServeRegistration,
} from './cli.handle.js';
export type { LiterateRunFlags } from './documents/literate.js';
export type {
    SpecDocument,
    SpecEnvToken,
    SpecFileAssertion,
    SpecFixture,
    SpecRun,
    SpecServeEntry,
    SpecStream,
} from './documents/spec-document.js';
export type { CliEnv, CliInput, CliOutput, CliPort, ExecOptions } from './process/cli.port.js';
// A linter's report as a golden keeps it — the transform a rule's cli specs share.
export { lintReport } from './report/lint-report.js';
