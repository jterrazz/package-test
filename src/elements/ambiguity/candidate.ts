import type { ElementMatch } from './ambiguity.js';
import { LANDMARK_SELECTOR } from './landmark-of-tag.js';

export const MAX_REPORTED_MATCHES = 10;

export const MATCH_TEXT_LENGTH = 80;

export function shortened(text: string): string {
    return text.replaceAll(/\s+/gu, ' ').trim().slice(0, MATCH_TEXT_LENGTH);
}

function landmarkNameOf(landmark: Element | null | undefined): string | undefined {
    const labelledBy = (landmark?.getAttribute('aria-labelledby') ?? '')
        .split(/\s+/u)
        .filter((id) => id !== '')
        .map((id) => document.querySelector(`#${CSS.escape(id)}`)?.textContent ?? '')
        .join(' ');
    const name = (landmark?.getAttribute('aria-label') ?? labelledBy)
        .replaceAll(/\s+/gu, ' ')
        .trim();
    return name === '' ? undefined : name;
}

export function candidateOf(node: Element): ElementMatch {
    const landmark = node.parentElement?.closest(LANDMARK_SELECTOR);
    const context = landmark?.getAttribute('role') ?? landmark?.tagName.toLowerCase();
    const detail = node.getAttribute('href') ?? node.getAttribute('name');
    const text = shortened(node.textContent ?? '');
    const label = node.getAttribute('aria-label')?.trim();
    return {
        accessibleName: label !== undefined && label !== text ? label : undefined,
        context: context ?? undefined,
        contextName: landmarkNameOf(landmark),
        detail: detail ?? undefined,
        tag: node.tagName.toLowerCase(),
        text,
    };
}
