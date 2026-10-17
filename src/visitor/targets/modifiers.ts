import type { Target } from './target.js';

/** Where the keyboard is: `see(focused(button('Open')))`. */
export const focused = (target: Target): Target => ({ ...target, focused: true });

/** The element refuses input: `see(disabled(button('Delete')))`. */
export const disabled = (target: Target): Target => ({ ...target, disabled: true });

/** The other direction of {@link disabled}: the element takes input. */
export const enabled = (target: Target): Target => ({ ...target, disabled: false });

/** The option the field is on: `see(selected(option('LinkedIn')))`. */
export const selected = (target: Target): Target => ({ ...target, selected: true });

/** What the field holds, read from its live value: `see(valued(field('Title'), '...'))`. */
export const valued = (target: Target, value: string): Target => ({ ...target, value });
