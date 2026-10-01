import { LANDMARK_SELECTOR } from './landmark-of-tag.js';

/** One candidate of an ambiguous target, as the refusal lists it. */
export type ElementMatch = {
    /** The accessible name, when it differs from the text (an `aria-label`). */
    accessibleName?: string | undefined;
    /** Nearest landmark ancestor (`nav`, `footer`, `main`…), when there is one. */
    context?: string | undefined;
    /** That landmark's accessible name. */
    contextName?: string | undefined;
    /** The attribute that disambiguates most — `href` for links, `name` for fields. */
    detail?: string | undefined;
    /** Tag name, lower-cased. */
    tag: string;
    /** Text content, whitespace-collapsed and truncated. */
    text: string;
};

export const MAX_REPORTED_MATCHES = 10;

export const MATCH_TEXT_LENGTH = 80;

export function shortened(text: string): string {
    return text.replaceAll(/\s+/gu, ' ').trim().slice(0, MATCH_TEXT_LENGTH);
}

export type CandidateLimits = {
    landmarks: string;
    limit: number;
    textLength: number;
};

export const CANDIDATE_LIMITS: CandidateLimits = {
    landmarks: LANDMARK_SELECTOR,
    limit: MAX_REPORTED_MATCHES,
    textLength: MATCH_TEXT_LENGTH,
};

/** Serialized into the page by playwright: it reads nothing from module scope. */
export function candidatesOf(
    nodes: Element[],
    { landmarks, limit, textLength }: CandidateLimits,
): ElementMatch[] {
    const landmarkOf = (node: Element): Pick<ElementMatch, 'context' | 'contextName'> => {
        const landmark = node.parentElement?.closest(landmarks);
        if (landmark === null || landmark === undefined) {
            return { context: undefined, contextName: undefined };
        }
        const labelledBy = (landmark.getAttribute('aria-labelledby') ?? '')
            .split(/\s+/u)
            .filter((id) => id !== '')
            .map((id) => document.querySelector(`#${CSS.escape(id)}`)?.textContent ?? '')
            .join(' ');
        const name = (landmark.getAttribute('aria-label') ?? labelledBy)
            .replaceAll(/\s+/gu, ' ')
            .trim();
        return {
            context: landmark.getAttribute('role') ?? landmark.tagName.toLowerCase(),
            contextName: name === '' ? undefined : name,
        };
    };
    return nodes.slice(0, limit).map((node) => {
        const detail = node.getAttribute('href') ?? node.getAttribute('name');
        const text = (node.textContent ?? '').replaceAll(/\s+/gu, ' ').trim().slice(0, textLength);
        const label = node.getAttribute('aria-label')?.trim();
        const { context, contextName } = landmarkOf(node);
        return {
            accessibleName:
                label === undefined || label === '' || label === text ? undefined : label,
            context,
            contextName,
            detail: detail ?? undefined,
            tag: node.tagName.toLowerCase(),
            text,
        };
    });
}
