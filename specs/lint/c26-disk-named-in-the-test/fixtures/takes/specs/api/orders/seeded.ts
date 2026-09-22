import type { DiskFile } from '@jterrazz/test';

/** Every order spec starts from rows it names itself. */
export function seeded(rows: DiskFile) {
    return api.seed(rows);
}
