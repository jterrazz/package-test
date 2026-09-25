/** `.clock(iso)`, handing back the chain it was called on. */
export type ClockMethod<Self> = (iso: string) => Self;
