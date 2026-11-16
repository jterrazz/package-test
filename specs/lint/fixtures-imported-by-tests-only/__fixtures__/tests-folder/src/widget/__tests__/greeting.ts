import { sharedUser } from '../widget.fixtures.js';
import { greet } from '../widget.js';

export const greeting = greet(sharedUser.name);
