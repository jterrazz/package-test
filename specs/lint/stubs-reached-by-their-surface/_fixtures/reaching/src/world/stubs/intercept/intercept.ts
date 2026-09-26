import type { InterceptPort } from './intercept.port.js';

export const intercept = (port: InterceptPort): void => port.arm();
