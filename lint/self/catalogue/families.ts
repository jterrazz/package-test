import { FAMILIES } from '../../consumer/catalogue/families.js';

export const SELF_FAMILIES = {
    ...FAMILIES,
    catalogue: 'The catalogue holding itself',
} as const;

export type SelfFamily = keyof typeof SELF_FAMILIES;
