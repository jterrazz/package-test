import { specification } from '@jterrazz/test';

// No cleanup registered — `cleanup-passed-to-after-all`, the rule whose reach is the specification role.
export const { cleanup, cli } = await specification.cli('./bin.sh');
