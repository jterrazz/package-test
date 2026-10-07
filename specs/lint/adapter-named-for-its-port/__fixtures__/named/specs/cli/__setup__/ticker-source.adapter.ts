import type { TickerSourcePort as Source } from '../../../src/ticker-source.port.js';

export class FixedTickerSource implements Source {
    async latest(): Promise<number> {
        return 42;
    }
}
