const fs = require("fs");
const split = require("lodash/split");
const forEach = require("lodash/forEach");
const endsWith = require("lodash/endsWith");
const startsWith = require("lodash/startsWith");
const trim = require("lodash/trim");
const includes = require("lodash/includes");
const filter = require("lodash/filter");
const isNull = require("lodash/isNull");
const map = require("lodash/map");
const {addCase, extractCommentBlock, parseComments, addSuite, addSection, deleteAllSuites} = require("./testrailReportHelper");
const {extractAndParseCommentBlock} = require("./commonHelper");

let isDeletedNativeSuites = false;

const countOccurrences = (str, subStr) => {
  return split(str, subStr).length - 1;
}

const addNativeCaseHandler = async (data) => {
  const { testName, testPath, section } = data;
  const testCode = fs.readFileSync(testPath, 'utf8');
  const lines = split(testCode, '\n');

  let insideItBlock = false;
  let itBlockContent = '';
  let braceCount = 0;
  // let preparedObject = null;

  forEach(lines, async fileLine => {
    const line = trim(fileLine);
    // Check if this line is the start of the `it` block we're looking for
    if (startsWith(line, 'it(') && includes(line, testName)) {
      insideItBlock = true;
      braceCount = 0; // Reset the brace count
    }

    if (!insideItBlock) {
      return;
    }

    itBlockContent += `${line  }\n`;

    // Count opening and closing braces in the line
    braceCount += countOccurrences(line, '{');
    braceCount -= countOccurrences(line, '}');

    // Check if this line ends the `it` block
    if (!(braceCount === 0 && endsWith(line, '});'))) {
      return;
    }

    insideItBlock = false;
  });

  return extractAndParseCommentBlock({
    content: itBlockContent,
    testName,
    section
  });
}

const parseNative = async (params) => {
  try {
    if (!isDeletedNativeSuites) {
      console.log('START DELETE SUITES');
      await deleteAllSuites();
      isDeletedNativeSuites = true;
    }

    const { testPath, test } = params;
    console.log('START ADD SUITE');
    const suite = await addSuite({
      name: test.parent.name
    });

    console.log('CREATED SUITE: ', suite);

    console.log('START ADD SECTION');
    const section = await addSection({
      name: test.parent.name
    }, suite.id);

    console.log('CREATED SECTION: ', section);

    const casePromises = map(test.parent.tests, async test => addNativeCaseHandler({
      testName: test.name,
      testPath,
      section
    }));
    const cases = await Promise.all(casePromises);
    console.log('CREATED CASES: ', filter(cases, testCase => !isNull(testCase)));
    console.log('______________________________________________');
  } catch (error) {
    console.error(error.message);
  }
};


module.exports = {
  addNativeCaseHandler,
  parseNative
};
