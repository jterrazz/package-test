import type { ComponentChain, ComponentVisitor } from '../facets/component/index.js';
import type { MobileVisitor } from '../facets/mobile/index.js';
import type { Visitor } from '../facets/website/index.js';
import type { ElementRef } from './element.port.js';

/**
 * The verb rows of CONVENTIONS W6, held by the COMPILER.
 *
 * Every row below is a type that only resolves when the row is true: a verb
 * offered on the wrong facet, or a modifier that leaked out of the one
 * descriptor type the facets share, fails `typescript check` rather than a
 * test run. Each visitor is read through its facet's face. The file is a
 * `*.test-d.ts`: it declares no test and is judged by the typechecker.
 */

/** Resolves only for `true` — the shape a row is stated in. */
type Assert<Row extends true> = Row;

/** Does this visitor offer the verb? */
type Carries<Verbs, Verb extends string> = Verb extends keyof Verbs ? true : false;

/** Does this descriptor accept the modifier? */
type Accepts<Ref, Key extends string> = Key extends keyof Ref ? true : false;

// `goto` is the page's alone: a component has no address to navigate to.
export type WebsiteGoes = Assert<Carries<Visitor, 'goto'>>;
export type ComponentNeverGoes = Assert<
    Carries<ComponentVisitor, 'goto'> extends false ? true : false
>;

// `rerender` and `unmount` are what a PARENT does to a component: swap its
// Props, take it off the screen. Neither is anything a visitor does to a page.
export type ComponentRerenders = Assert<Carries<ComponentVisitor, 'rerender'>>;
export type ComponentUnmounts = Assert<Carries<ComponentVisitor, 'unmount'>>;
export type WebsiteNeverRerenders = Assert<
    Carries<Visitor, 'rerender'> extends false ? true : false
>;
export type WebsiteNeverUnmounts = Assert<Carries<Visitor, 'unmount'> extends false ? true : false>;
export type MobileNeverRerenders = Assert<
    Carries<MobileVisitor, 'rerender'> extends false ? true : false
>;

// `gone` is on both rendered facets — the absence primitive `see` cannot
// State — and never on a simulator's visitor.
export type WebsiteSeesAbsence = Assert<Carries<Visitor, 'gone'>>;
export type ComponentSeesAbsence = Assert<Carries<ComponentVisitor, 'gone'>>;
export type MobileNeverAsksAboutAbsence = Assert<
    Carries<MobileVisitor, 'gone'> extends false ? true : false
>;

// The four states of a control are modifiers of the ONE descriptor type every
// Facet shares — so the boundary is the VERB set, not the ref: a mobile
// Visitor offers neither `gone` nor a `see` that reads them.
export type ElementTakesFocus = Assert<Accepts<ElementRef, 'focused'>>;
export type ElementTakesEnablement = Assert<Accepts<ElementRef, 'disabled'>>;
export type ElementTakesSelection = Assert<Accepts<ElementRef, 'selected'>>;
export type ElementTakesValue = Assert<Accepts<ElementRef, 'value'>>;

// The setups a component test states per render. The page size is one of them:
// A responsive component's Given is the viewport, and it belongs to ONE test.
export type ComponentSetsViewport = Assert<Carries<ComponentChain, 'viewport'>>;
export type ComponentSetsClock = Assert<Carries<ComponentChain, 'clock'>>;
export type ComponentIntercepts = Assert<Carries<ComponentChain, 'intercept'>>;
export type ComponentWraps = Assert<Carries<ComponentChain, 'wrap'>>;
