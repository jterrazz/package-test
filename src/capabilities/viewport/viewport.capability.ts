/** `.viewport(size)`, handing back the chain it was called on. */
export type ViewportMethod<Self> = (size: { height: number; width: number }) => Self;
