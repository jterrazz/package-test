import type * as ports from '../../../src/clock.port.js';

export class FrozenClock implements ports.ClockPort {
    now(): Date {
        return new Date('2026-01-01T00:00:00.000Z');
    }
}
