import type { ElementRef } from './element.js';

export function scopeChain(element: ElementRef): ElementRef[] {
    const chain: ElementRef[] = [];
    for (let current: ElementRef | undefined = element; current; current = current.scope) {
        chain.unshift(current);
    }
    return chain;
}
