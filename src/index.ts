export { specification } from './specifications/specification.js';
export type * from './specifications/api/api.face.js';
export type * from './specifications/cli/cli.face.js';
export * from './specifications/component/component.face.js';
export type * from './specifications/integration/integration.face.js';
export type * from './specifications/job/job.face.js';
export type * from './specifications/lint/lint.face.js';
export { ruleTester } from './specifications/lint/lint.face.js';
export type * from './specifications/mobile/mobile.face.js';
export type * from './specifications/website/website.face.js';

export {
    directory,
    type DiskDirectory,
    type DiskFile,
    type DiskTarget,
    file,
    type FileAt,
    type RelativePath,
} from './disk/spec-path.js';
export { packed, type PackedPackage } from './disk/packed.js';
export { clock, type PinnedClock } from './clock/clock.js';
export { mockOf, type MockOfOptions, type MockPort } from './mocks/mock-of.js';

export {
    button,
    content,
    dialog,
    field,
    heading,
    link,
    listitem,
    option,
    row,
    status,
    table,
    testId,
} from './visitor/targets/roles.js';
export {
    banner,
    complementary,
    contentinfo,
    form,
    main,
    navigation,
    region,
    search,
    within,
} from './visitor/targets/landmarks.js';
export { disabled, enabled, focused, selected, valued } from './visitor/targets/modifiers.js';
export type { ElementKind, LandmarkKind, Target, TargetOptions } from './visitor/targets/target.js';
export type { ElementMatch } from './visitor/matching/candidates.js';

export { match, Matcher, type MatcherKind } from './expectations/tokens/match.js';
export type { CaptureScope } from './expectations/tokens/capture-scope.js';
export type { BaseResult, FileAccessor } from './expectations/result.js';
export type { CliResult, DockerSpecConfig } from './expectations/command/cli.result.js';
export type { ContainerAccessor } from './expectations/command/container.js';
export type { DirectoryAccessor } from './expectations/disk/directory.js';
export type { FilesystemAccessor } from './expectations/disk/filesystem.js';
export type { ResponseAccessor } from './expectations/http/response.js';
export type { TableAccessor } from './expectations/table/table.js';
export type { JsonAccessor } from './expectations/text/json.js';
export type { TextAccessor } from './expectations/text/text.js';
export { text } from './expectations/text/text-subject.js';
export { required } from './expectations/conditions/required.js';
export { waitUntil, type WaitUntilOptions } from './expectations/conditions/wait-until.js';
// outside: also carries the vitest `Assertion` augmentation: the one `types` entry publishes the matchers through it.
export type { MatchFixtureOptions } from './expectations/goldens/match-options.js';
