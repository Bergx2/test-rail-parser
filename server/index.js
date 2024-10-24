const includes = require('lodash/includes');
const values = require('lodash/values');
const dotenv = require('dotenv');
const path = require('path');

const logger = require('./utils/logger');
const { runner } = require('./helpers/runner');

const PARSER_TYPES = {
  WEB: 'web',
};

let currentType = null;

const parse = params =>
  ({
    [PARSER_TYPES.WEB]: runner.bind(params),
  }[currentType](params));

const init = configurations => {
  try {
    const { type, envPath } = configurations;
    dotenv.config({
      path:
        path.resolve(envPath, '.env') || path.resolve(process.cwd(), '.env'),
      override: true,
    });

    if (!includes(values(PARSER_TYPES), type)) {
      throw new Error('Type of parser should be "native" or "web"');
    }

    currentType = type;
    return {
      parse,
    };
  } catch (error) {
    return logger.log('error', error.message);
  }
};

module.exports = {
  init,
};
