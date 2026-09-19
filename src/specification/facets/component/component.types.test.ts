import { describe, expect, test } from 'vitest';

import type { ElementRef, Visitor } from '../../ports/browser.port.js';
import type { MobileVisitor } from '../../ports/device.port.js';
import { disabled, focused } from '../website/elements.js';
import type { ComponentChain, ComponentVisitor } from './component.types.js';

/**
 * The verb rows of CONVENTIONS W6, held by the COMPILER.
 *
 * Every assertion below is a type that only resolves when the row is true; a
 * verb offered on the wrong facet, or a modifier that leaked into the mobile
 * vocabulary, fails `typescript check` rather than a test run. The two runtime
 * tests state the same rows in English so the file reads as what it guards.
 */

/** Resolves only for `true` — the shape a row is stated in. */
type Assert<Row extends true> = Row;

/** Does this visitor offer the verb? */
type Carries<Verbs, Verb extends string> = Verb extends keyof Verbs ? true : false;

/** Does this descriptor accept the modifier? */
type Accepts<Ref, Key extends string> = Key extends keyof Ref ? true : false;

// `rerender` and `unmount` are what a PARENT does to a component: swap its
// props, take it off the screen. Neither is anything a visitor does to a page.
export type ComponentRerenders = Assert<Carries<ComponentVisitor, 'rerender'>>;
export type ComponentUnmounts = Assert<Carries<ComponentVisitor, 'unmount'>>;
export type WebsiteNeverRerenders = Assert<
    Carries<Visitor, 'rerender'> extends false ? true : false
>;
export type WebsiteNeverUnmounts = Assert<Carries<Visitor, 'unmount'> extends false ? true : false>;

// `goto` is the page's alone: a component has no address to navigate to.
export type WebsiteGoes = Assert<Carries<Visitor, 'goto'>>;
export type ComponentNeverGoes = Assert<
    Carries<ComponentVisitor, 'goto'> extends false ? true : false
>;

// `gone` is on both rendered facets — the absence primitive `see` cannot state.
export type WebsiteSeesAbsence = Assert<Carries<Visitor, 'gone'>>;
export type ComponentSeesAbsence = Assert<Carries<ComponentVisitor, 'gone'>>;

// Focus is a modifier of the shared descriptor, and there is ONE descriptor
// Type across facets on purpose — so the boundary is the VERB set, not the ref:
// A simulator's visitor offers neither `gone` nor `see(focused(…))` to reach it,
// The way it offers no landmark (W4 refuses those at runtime).
export type WebElementTakesFocus = Assert<Accepts<ElementRef, 'focused'>>;
export type MobileNeverAsksAboutAbsence = Assert<
    Carries<MobileVisitor, 'gone'> extends false ? true : false
>;
export type MobileNeverRerenders = Assert<
    Carries<MobileVisitor, 'rerender'> extends false ? true : false
>;

// Enablement is the second modifier, and it is the one direction a behavioural
// Substitute cannot reach: clicking a disabled control is a timeout, not a no.
export type WebElementTakesEnablement = Assert<Accepts<ElementRef, 'disabled'>>;

// The setups a component test states per render. The page size is one of them:
// A responsive component's Given is the viewport, and it belongs to ONE test.
export type ComponentSetsViewport = Assert<Carries<ComponentChain, 'viewport'>>;
export type ComponentSetsClock = Assert<Carries<ComponentChain, 'clock'>>;
export type ComponentIntercepts = Assert<Carries<ComponentChain, 'intercept'>>;
export type ComponentWraps = Assert<Carries<ComponentChain, 'wrap'>>;

describe('the verb rows the compiler holds (W6)', () => {
    test('a modifier the web vocabulary carries is plain data, like any descriptor', () => {
        // Given - the focus modifier, applied to a button
        const element: ElementRef = focused({ kind: 'button', name: 'Open' });

        // Then - it travels as a field, which is why only the web refs have it
        expect(element.focused).toBeTruthy();
    });

    test('a modifier is data whichever state it names', () => {
        // Given - the enablement modifier, applied to a button
        const element: ElementRef = disabled({ kind: 'button', name: 'Publish' });

        // Then - it travels as a field, exactly as focus does
        expect(element.disabled).toBeTruthy();
    });

    test('states the rows in English beside the types that hold them', () => {
        // Given - the rows above, as a reader would say them
        const rows = [
            "rerender and unmount are the component facet's",
            "goto is the website facet's",
            'gone is on both rendered facets',
            'focused and disabled are reachable only where see and gone are',
            'the chain states intercept, clock, wrap and viewport',
        ];

        // Then - each has a compile-time twin in this file
        expect(rows).toHaveLength(5);
    });
});
