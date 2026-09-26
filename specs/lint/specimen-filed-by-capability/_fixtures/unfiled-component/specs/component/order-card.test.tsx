import { expect, test } from 'vitest';

import { OrderCard } from './order-card.js';

test('renders the order', () => {
    // Given - the card
    const card = OrderCard();

    // Then - it renders
    expect(card).not.toBeNull();
});
