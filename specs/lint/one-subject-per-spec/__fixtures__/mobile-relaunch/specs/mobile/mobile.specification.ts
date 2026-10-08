import { afterAll } from 'vitest';
import { specification } from '@jterrazz/test';

export const { cleanup, mobile } = await specification.mobile({ app: { bundleId: 'com.acme.app' } });

afterAll(cleanup);
