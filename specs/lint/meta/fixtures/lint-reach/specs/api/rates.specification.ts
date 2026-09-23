import { specification } from '@jterrazz/test';

// No cleanup registered — A4, the rule whose reach is the specification role.
export const { cleanup, cli } = await specification.cli('./bin.sh');
