const includes = require('lodash/includes');
const values = require('lodash/values');
const dotenv = require('dotenv');
const path = require('path');


const { parseWeb } = require("./helpers/webHelper");
const { parseNative } = require("./helpers/nativeHelper");
const { deleteNativeTestCases } = require("./helpers/commonHelper");
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
    const {type, envPath} = configurations;
    dotenv.config({ path: path.resolve(envPath, '.env') || path.resolve(process.cwd(), '.env'), override: true });

    if (!includes(values(PARSER_TYPES), type)) {
      throw new Error('Type of parser should be "native" or "web"');
    }

    currentType = type;
    return {
      parse,
      deleteNativeTestCases,
      deleteAllSuites
    }
  } catch (error) {
    console.error(error.message);
  }
}

module.exports = {
  init
};
