import type { TickerSourcePort } from '../../../src/ticker-source.port.js';

export class FixedTickerSource implements TickerSourcePort {
    async latest(): Promise<number> {
        return 42;
    }
}
