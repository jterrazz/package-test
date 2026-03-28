/**
 * Base assertion that handles .not negation.
 * Subclasses call this.assert(condition, message, negatedMessage) for each predicate.
 */
export class BaseAssertion {
  protected negated = false;

  get not(): this {
    const clone = Object.create(Object.getPrototypeOf(this));
    Object.assign(clone, this);
    clone.negated = !this.negated;
    return clone;
  }

  protected assert(condition: boolean, message: string, negatedMessage: string): void {
    if (this.negated) {
      if (condition) {
        throw new Error(negatedMessage);
      }
    } else {
      if (!condition) {
        throw new Error(message);
      }
    }
  }
}
