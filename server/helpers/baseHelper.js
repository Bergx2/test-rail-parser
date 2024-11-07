const reduce = require('lodash/reduce');
const assign = require('lodash/assign');
const isEqual = require('lodash/isEqual');

const formateObjectsByKey = (objects, key) =>
  reduce(objects, (acc, object) => assign(acc, { [object[key]]: object }), {});

const isTrue = value => isEqual(value, 'true');

module.exports = {
  formateObjectsByKey,
  isTrue,
};
