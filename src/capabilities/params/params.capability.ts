import type { ActionOption } from '../../model/chain/capability.js';

/**
 * `{ params }`: the values of a route template's parameters, handed to a
 * request beside the template it names (`route.ts` fills and refuses them).
 */
export const params: ActionOption<'params'> = {
    kind: 'option',
    name: 'params',
    row: { group: 'Route option', member: 'params', name: '{ params }', probe: 'params:' },
};
