/** The module the neighbouring `scenario.test.ts` covers (CONVENTIONS I2). */
export function scenario(): string {
    return process.env.SCENARIO ?? 'scenario';
}
