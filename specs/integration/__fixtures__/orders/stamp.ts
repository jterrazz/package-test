/** When an order was placed: the moment the module ran, as the clock reads it. */
export function stamp(): { stampedAt: string } {
    return { stampedAt: new Date().toISOString() };
}
