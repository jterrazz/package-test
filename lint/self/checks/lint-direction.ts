const CONSUMER = ['consumer/catalogue', 'consumer/rulebook', 'consumer/rules', 'consumer/checks'];

const SELF_READS = [
    'self/rules',
    'self/checks',
    'self/corpus',
    'self/catalogue',
    ...CONSUMER,
    'engine',
    'src',
];

export const LINT_DIRECTION: Readonly<Record<string, readonly string[]>> = {
    'consumer/catalogue': ['consumer/catalogue', 'engine'],
    'consumer/checks': ['consumer/checks', 'consumer/catalogue', 'engine'],
    'consumer/rulebook': ['consumer/rulebook', 'consumer/catalogue', 'engine'],
    'consumer/rules': ['consumer/rules', 'consumer/catalogue', 'engine'],
    engine: ['engine'],
    index: [...CONSUMER, 'engine'],
    'self/catalogue': ['self/catalogue', ...CONSUMER, 'engine'],
    'self/checks': SELF_READS,
    'self/corpus': SELF_READS,
    'self/index': SELF_READS,
    'self/rules': SELF_READS,
    src: ['src', 'engine', 'index'],
};
