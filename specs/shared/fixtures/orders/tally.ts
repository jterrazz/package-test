/** The orders' count and total, from the totals of each. */
export function tally(totals: readonly number[]): { count: number; total: number } {
    return {
        count: totals.length,
        total: totals.reduce((sum, each) => sum + each, 0),
    };
}
