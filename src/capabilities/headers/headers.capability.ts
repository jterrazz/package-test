/** `.headers(record)`, handing back the chain it was called on. */
export type HeadersMethod<Self> = (headers: Record<string, string>) => Self;
