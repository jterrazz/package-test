/** The EUR rate the provider serves. */
export async function eurRate(): Promise<number> {
    const response = await fetch('https://rates.test/eur');
    const { rate } = (await response.json()) as { rate: number };
    return rate;
}
