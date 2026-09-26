import type { ElementRef } from './element.js';

/** Where the keyboard is: `see(focused(button('Open')))`. */
export const focused = (element: ElementRef): ElementRef => ({ ...element, focused: true });

/** The element refuses input: `see(disabled(button('Delete')))`. */
export const disabled = (element: ElementRef): ElementRef => ({ ...element, disabled: true });

/** The other direction of {@link disabled} — the element takes input. */
export const enabled = (element: ElementRef): ElementRef => ({ ...element, disabled: false });

/** The option the field is on: `see(selected(option('LinkedIn')))`. */
export const selected = (element: ElementRef): ElementRef => ({ ...element, selected: true });

/** What the field holds, read from its live value: `see(valued(field('Title'), '…'))`. */
export const valued = (element: ElementRef, value: string): ElementRef => ({ ...element, value });
