const reduce = require('lodash/reduce');
const assign = require('lodash/assign');

const formateObjectsByKey = (objects, key) =>
  reduce(objects, (acc, object) => assign(acc, { [object[key]]: object }), {});

module.exports = {
  formateObjectsByKey,
};
