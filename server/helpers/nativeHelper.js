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
const {
  addSection,
  getSuites,
  getSections,
  updateSuite,
  updateSection,
  updateCase,
  getProjectPrefix,
  getProjectId,
  TEST_CASE_TYPES
} = require("./testrailReportHelper");
const {
  extractAndParseCommentBlock,
  getParsedObject,
  createCases,
  createSuiteAndSection,
  deleteNativeTestCases,
  getAllExistingSuites,
  getAllExistingCases,
  getProjectName,
  deleteSuitesInProjects
} = require("./commonHelper");
const { extractIdAndTitle } = require('./parserHelper');

let isDeletedNativeSuites = false;
let isTakenSuites = false;
let allNativeSuites = [];
let existingNativeSuites = [];
let existingNativeTestCases = [];

let appProject = null;

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

const getAllSuitesAndCases = async () => {
  try {
    allNativeSuites = await getSuites({ type: appProject });
    existingNativeSuites = getAllExistingSuites(allNativeSuites);
    existingNativeTestCases = await getAllExistingCases({ type: appProject, suites: existingNativeSuites });
  } catch (error) {
    throw error;
  }
}

const deleteSuites = async () => {
  try {
    const suites = [...allNativeSuites];
    const projects = [appProject];
    deleteSuitesInProjects({
      projects,
      suites,
    });
  } catch (error) {
    throw error;
  }
}

const formateProjects = async () => {
  try {
    const projectPrefix = getProjectPrefix();
    appProject = `${projectPrefix}_NATIVE`;

    if (!getProjectId(appProject)) {
      throw new Error('NATIVE project not found');
    }
  } catch (error) {
    throw error;
  }
}

const parseNative = async (params) => {
  const { describes } = params;

  formateProjects();

  await getAllSuitesAndCases();
  await deleteSuites();

  const parserPromises = map(describes, describe => parseTest(describe));
  await Promise.all(parserPromises);
};

const parseTest = async (params) => {
  try {
    const { testPath, test } = params;
    const testName = test.parent.name;

    const currentProjectName = getProjectName(testName);

    if (!currentProjectName) {
      return;
    }

    const parsedTests = map(test.parent.tests, currentTest => getParsedObject({
      content: getItBlockContent({
        testName: currentTest.name,
        testPath,
      }),
      testName: currentTest.name,
    }));

    const suiteSectionData = await createSuiteAndSection({
      testName,
      type: currentProjectName
    });
    await createCases({
      parsedTests: map(parsedTests, parsedTest => ({...parsedTest, custom_id: `${currentProjectName}_${Buffer.from(parsedTest.title).toString('base64')}`})),
      section: suiteSectionData.section
    });
  } catch (error) {
    console.error(error.message);
  }
}


// const parseTest = async (params) => {
//   try {
//     const { testPath, test } = params;
//     const testName = test.parent.name;
//
//     const parsedTests = map(test.parent.tests, currentTest => getParsedObject({
//       content: getItBlockContent({
//         testName: currentTest.name,
//         testPath,
//       }),
//       testName: currentTest.name,
//     }));
//
//     const nativeParsedTests  = filter(parsedTests, parsedTest => parsedTest && includes([TEST_CASE_TYPES.native, null], parsedTest.custom_type));
//
//     const currentTestSuiteObject = extractIdAndTitle(testName);
//     const nativeSuite = find(existingNativeSuites, existingNativeSuite => existingNativeSuite.uuid === currentTestSuiteObject.uuid);
//     let section;
//
//     if (nativeSuite) {
//       const suiteId = nativeSuite.id;
//       // update suite
//       // update section
//       await updateSuite({ ...nativeSuite, name: testName });
//
//       // Get the first section of the found suite or create a new one if it doesn't exist
//       const sections = await getSections({
//         suiteId: nativeSuite.id,
//         type: 'native',
//       });
//
//       if (sections) {
//         section = await updateSection({ ...sections[0], name: testName });
//       } else {
//         section = await addSection({
//           sectionData: { name: testName },
//           suiteId: nativeSuite.id,
//           type: 'native',
//         });
//       }
//
//       const existingNativeSuiteTestCases = existingNativeTestCases[suiteId];
//       const removeSuiteTestCaseIds = [];
//       const updateSuiteTestCases = [];
//       const createSuiteTestCases = [];
//
//       map(existingNativeSuiteTestCases, existingNativeSuiteTestCase => {
//         const foundCase = find(parsedTests, parsedTest => parsedTest.custom_id === existingNativeSuiteTestCase.custom_id);
//         // console.log('ЕЕЕЕЕЕЕЕЕЕ#2: ', !!foundCase, existingNativeSuiteTestCase);
//         if (!foundCase && !includes([TEST_CASE_TYPES.common], existingNativeSuiteTestCase.custom_type)) {
//           removeSuiteTestCaseIds.push(existingNativeSuiteTestCase.id);
//         }
//
//         // console.log('NNNNNNNN#1: ', existingNativeSuiteTestCase);
//         // console.log('NNNNNNNN#2: ', foundCase, includes([TEST_CASE_TYPES.common], existingNativeSuiteTestCase.custom_type));
//
//         if (foundCase && !includes([TEST_CASE_TYPES.common], existingNativeSuiteTestCase.custom_type)) {
//           updateSuiteTestCases.push({ ...foundCase, id: existingNativeSuiteTestCase.id });
//         }
//       });
//       // search new cases for create from "parsedTests"
//       // console.log('SSSSSSSS: ', parsedTests);
//       map(parsedTests, parsedTest => {
//         const foundTestCase = find(updateSuiteTestCases, updateSuiteTestCase =>
//           parsedTest.custom_id === updateSuiteTestCase.custom_id
//         );
//
//         if (!foundTestCase) {
//           createSuiteTestCases.push(parsedTest);
//         }
//       });
//
//       // console.log('updateSuiteTestCases: ', updateSuiteTestCases);
//       const updateSuiteTestCasePromises = map(updateSuiteTestCases, updateSuiteTestCase => updateCase(updateSuiteTestCase));
//       await Promise.all(updateSuiteTestCasePromises);
//
//       await createCases({
//         parsedTests: createSuiteTestCases,
//         section
//       });
//
//       console.log('removeSuiteTestCaseIds: ', removeSuiteTestCaseIds);
//       const deleteTestCasePromises = map(removeSuiteTestCaseIds, removeSuiteTestCaseId => deleteTestCase(removeSuiteTestCaseId));
//       await Promise.all(deleteTestCasePromises);
//     } else {
//       // Create a new suite and section if no matching suite is found
//       const suiteSectionData = await createSuiteAndSection({
//         testName,
//         type: 'native',
//       });
//       section = suiteSectionData.section;
//
//       // Create test cases in the determined section
//       await createCases({
//         parsedTests: nativeParsedTests,
//         section,
//       });
//     }
//   } catch (error) {
//     console.error(error.message);
//   }
// }


module.exports = {
  parseNative
};
