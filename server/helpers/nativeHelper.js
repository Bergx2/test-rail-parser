const fs = require("fs");
const split = require("lodash/split");
const forEach = require("lodash/forEach");
const endsWith = require("lodash/endsWith");
const startsWith = require("lodash/startsWith");
const trim = require("lodash/trim");
const includes = require("lodash/includes");
const map = require("lodash/map");
const find = require("lodash/find");
const head = require("lodash/head");
const filter = require("lodash/filter");
const {addSection, getSuites, getSections, TEST_CASE_TYPES} = require("./testrailReportHelper");
const {extractAndParseCommentBlock, getParsedObject, createCases, createSuiteAndSection, deleteNativeTestCases} = require("./commonHelper");

let isDeletedNativeSuites = false;

const countOccurrences = (str, subStr) => {
  return split(str, subStr).length - 1;
}

const getItBlockContent = (data) => {
  const { testName, testPath } = data;
  const testCode = fs.readFileSync(testPath, 'utf8');
  const lines = split(testCode, '\n');

  let insideItBlock = false;
  let itBlockContent = '';
  let braceCount = 0;
  let isUsingFunctionReference = false;

  forEach(lines, (fileLine) => {
    const line = trim(fileLine);

    // Check if this line is the start of the `it` block we're looking for
    if (startsWith(line, 'it(') && includes(line, testName)) {
      insideItBlock = true;
      braceCount = 0; // Reset the brace count

      // Check if this `it` block uses a function reference
      isUsingFunctionReference = endsWith(line, ');') && !includes(line, '=>');

      // If it's a function reference, we capture this line and exit the block
      if (isUsingFunctionReference) {
        itBlockContent = `${line}\n`;
        insideItBlock = false; // Since it's a single line reference, exit immediately
      }
    }

    if (!insideItBlock) {
      return;
    }

    itBlockContent += `${line}\n`;

    // Count opening and closing braces in the line
    braceCount += countOccurrences(line, '{');
    braceCount -= countOccurrences(line, '}');

    // Check if this line ends the `it` block
    if (braceCount === 0 && endsWith(line, '});')) {
      insideItBlock = false;
    }
  });

  return itBlockContent;
};

const addNativeCaseHandler = async (data) => {
  const { testName, section } = data;
  const itBlockContent = getItBlockContent(data);

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
      await deleteNativeTestCases();
      isDeletedNativeSuites = true;
    }

    const { testPath, test } = params;

    const parsedTests = map(test.parent.tests, currentTest => getParsedObject({
      content: getItBlockContent({
        testName: currentTest.name,
        testPath,
      }),
      testName: currentTest.name,
    }));

    const nativeParsedTests  = filter(parsedTests, parsedTest => parsedTest && includes([TEST_CASE_TYPES.native, null], parsedTest.custom_type));
    const allNativeSuites = await getSuites({ type: 'native' });
    const foundNativeSuite = find(allNativeSuites, suite => suite.name === test.parent.name);
    let section;

    if (foundNativeSuite) {
      // Get the first section of the found suite or create a new one if it doesn't exist
      const sections = await getSections({
        suiteId: foundNativeSuite.id,
        type: 'native',
      });

      section = head(sections) || await addSection({
        sectionData: { name: test.parent.name },
        suiteId: foundNativeSuite.id,
        type: 'native',
      });
    } else {
      // Create a new suite and section if no matching suite is found
      const suiteSectionData = await createSuiteAndSection({
        testName: test.parent.name,
        type: 'native',
      });
      section = suiteSectionData.section;
    }

    // Create test cases in the determined section
    await createCases({
      parsedTests: nativeParsedTests,
      section,
    });
  } catch (error) {
    console.error(error.message);
  }
};


module.exports = {
  addNativeCaseHandler,
  parseNative
};
