export default {
    meta: { name: 'acme' },
    rules: {
        'no-x': {
            create(context) {
                return {
                    Identifier(node) {
                        if (node.name === 'x') {
                            context.report({ message: 'no x', node });
                        }
                    },
                };
            },
        },
    },
};
