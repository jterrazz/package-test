export interface TickerSourcePort {
    latest(): Promise<number>;
}
