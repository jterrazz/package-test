import { file } from '@jterrazz/test';

// @ts-expect-error disk-named-by-relative-path — a relative path ending in `.sql` is a seed's file, and compiles
export const seed = file('./__seeds__/orders.sql');
