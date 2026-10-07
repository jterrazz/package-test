import { file } from '@jterrazz/test';

/** Every order spec starts from the same rows — named here, for whichever spec calls it. */
export function seeded() {
    return api.seed(file('./__seeds__/orders.sql'));
}
