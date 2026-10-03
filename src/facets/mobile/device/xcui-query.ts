import { refusal } from '../../../chain/refusals/refusal.js';
import { MAX_REPORTED_MATCHES, shortened } from '../../../visitor/matching/candidates.js';
import { asWritten } from '../../../visitor/targets/as-written.js';
import type { Target } from '../../../visitor/targets/target.js';
import type { Driver } from '../session/driver-session.js';
import type { MobileElementKind, MobileElementMatch } from './device.port.js';

export type ElementList = Awaited<ReturnType<Driver['$$']>>;

export type DriverElement = ElementList[number];

export type MatchScope = Driver | DriverElement;

function escapePredicate(value: string): string {
    return value.replaceAll('\\', String.raw`\\`).replaceAll("'", String.raw`\'`);
}

type PredicateParts = {
    contains: (attribute: string) => string;
    name: string;
    visible: string;
};

const PREDICATES: Record<MobileElementKind, (parts: PredicateParts) => string> = {
    button: ({ contains, visible }) =>
        `type == 'XCUIElementTypeButton' AND ${contains('label')} AND ${visible}`,
    field: ({ contains, visible }) =>
        `type IN {'XCUIElementTypeTextField','XCUIElementTypeSecureTextField'}` +
        ` AND (${contains('label')} OR ${contains('value')}) AND ${visible}`,
    testId: ({ name, visible }) => `name == '${name}' AND ${visible}`,
    text: ({ contains, visible }) =>
        `(${contains('label')} OR ${contains('value')}) AND ${visible}`,
};

function isMobileKind(kind: Target['kind']): kind is MobileElementKind {
    return Object.hasOwn(PREDICATES, kind);
}

/** Landmarks have no XCUITest analog: the boundary is refused, not approximated. */
export function compilePredicate(target: Target, options?: { anyVisibility?: boolean }): string {
    if (!isMobileKind(target.kind)) {
        throw new Error(
            refusal('no-landmark-on-mobile', {
                fix: `scope with within(testId('…'), …) — any target works as the scope`,
                found: `${asWritten(target)}, a landmark — an iOS screen has no '${target.kind}' region`,
            }),
        );
    }
    const name = escapePredicate(target.name ?? '');
    return PREDICATES[target.kind]({
        contains: (attribute) =>
            target.exact === false
                ? `${attribute} CONTAINS '${name}'`
                : `${attribute} == '${name}'`,
        name,
        visible: options?.anyVisibility === true ? '1 == 1' : 'visible == 1',
    });
}

/** `$$` answers a chainable typed as its array: the one await of it lives here. */
export async function matching(
    scope: MatchScope,
    target: Target,
    options?: { anyVisibility?: boolean },
): Promise<ElementList> {
    /* oxlint-disable typescript/await-thenable -- webdriverio's chainable is TYPED as the array it resolves to and is a promise at runtime: the await is what runs the query */
    /* oxlint-disable typescript/return-await -- same reason: the value returned is a promise, whatever its type says */
    return await scope.$$(`-ios predicate string:${compilePredicate(target, options)}`);
    /* oxlint-enable typescript/return-await */
    /* oxlint-enable typescript/await-thenable */
}

async function captureMatch(element: DriverElement): Promise<MobileElementMatch> {
    const [type, label, value, identifier] = await Promise.all([
        element.getAttribute('type'),
        element.getAttribute('label'),
        element.getAttribute('value'),
        element.getAttribute('name'),
    ]);
    const shortLabel = label === null || label === '' ? undefined : shortened(label);
    return {
        type: (type ?? 'Unknown').replace(/^XCUIElementType/u, ''),
        ...(shortLabel === undefined ? {} : { label: shortLabel }),
        ...(value === null || value === '' || value === label ? {} : { value }),
        ...(identifier === null || identifier === '' || identifier === label ? {} : { identifier }),
    };
}

export async function captureMatches(matches: ElementList): Promise<MobileElementMatch[]> {
    const count = Math.min(await matches.length, MAX_REPORTED_MATCHES);
    const evidence: MobileElementMatch[] = [];
    for (let index = 0; index < count; index++) {
        const match = matches[index];
        if (match !== undefined) {
            evidence.push(await captureMatch(match));
        }
    }
    return evidence;
}

/** invariant: actionability includes scroll-into-view: the next pass re-resolves the element as visible. */
export async function scrollToOffscreen(
    driver: Driver,
    scope: MatchScope,
    level: Target,
): Promise<void> {
    const offscreen = await matching(scope, level, { anyVisibility: true });
    const first = offscreen[0];
    if (first === undefined) {
        return;
    }
    try {
        // outside: `mobile: scroll`'s `toVisible` is for table and collection views: scroll the found element by id.
        await driver.executeScript('mobile: scrollToElement', [{ elementId: first.elementId }]);
    } catch {
        // invariant: not scrollable (or already settling) — keep polling.
    }
}

/** The labels a page source shows, for a timeout's evidence. */
export function onScreenLabels(source: string): string[] {
    return [
        ...new Set(
            [...source.matchAll(/label="(?<label>[^"]{2,60})"/gu)].map(
                (match) => match.groups?.label ?? '',
            ),
        ),
    ].slice(0, 15);
}
