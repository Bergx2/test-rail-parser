const includes = require('lodash/includes');
const values = require('lodash/values');
const path = require('path');
const dotenv = require('dotenv');

const { parseWeb } = require("./helpers/webHelper");
const { parseNative } = require("./helpers/nativeHelper");
const { deleteAllSuites } = require("./helpers/testrailReportHelper");

const PARSER_TYPES = {
  WEB: 'web',
  NATIVE: 'native',
}

let currentType = null;

const parse = (params) => ({
  [PARSER_TYPES.WEB]: parseWeb.bind(params),
  [PARSER_TYPES.NATIVE]: parseNative.bind(params),
}[currentType])(params);

const init = (configurations) => {
  try {
    const {type} = configurations;
    if (!includes(values(PARSER_TYPES), type)) {
      throw new Error('Type of parser should be "native" or "web"');
    }

    dotenv.config({path: path.resolve(__dirname, `../.${type}.env`)});

    currentType = type;
    return {
      parse,
      deleteAllSuites
    }
  } catch (error) {
    console.error(error.message);
  }
}

module.exports = {
  init
};
