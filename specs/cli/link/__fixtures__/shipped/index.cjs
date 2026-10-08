const { stringify } = require('yaml');

module.exports = stringify({ shipped: true }).trim();
