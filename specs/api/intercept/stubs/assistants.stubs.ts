/**
 * The facade the specs import (C10): one streamed greeting per provider wire,
 * each unit filed under the kind of the builder that serves it.
 */
export { default as messagesHello } from './anthropic/messages-hello.js';
export { default as chatHello } from './openai/chat-hello.js';
export { default as responsesHello } from './openai/responses-hello.js';
