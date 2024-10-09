const {
  addSection,
  getSections,
  updateSuite,
  updateSection,
  updateCase,
  deleteTestCase,
  getSuites,
  deleteSuite,
  getProjectPrefix,
  getProjects,
  getProjectId,
  TEST_CASE_TYPES
} = require("./testrailReportHelper");
const {
  getParsedObject,
  createCases,
  createSuiteAndSection,
  getAllExistingSuites,
  getAllExistingCases,
  getProjectName,
  deleteSuitesInProjects
} = require("./commonHelper");
const map = require("lodash/map");
const filter = require("lodash/filter");
const head = require("lodash/head");
const includes = require("lodash/includes");
const keys = require("lodash/keys");
const replace = require("lodash/replace");
const split = require("lodash/split");
// const find = require("lodash/find");
// const flatten = require("lodash/flatten");
// const values = require("lodash/values");

// const { extractIdAndTitle } = require("./parserHelper");

let allWebSuites = [];
let allNativeSuites = [];
let existingWebSuites = [];
let existingNativeSuites = [];
let existingWebTestCases = [];
let existingNativeTestCases = [];
let createdCommonCases = [];

let webProject = null;
let appProject = null;

let allTests = [];

const getAllSuitesAndCases = async () => {
  try {
    allWebSuites = await getSuites({ type: webProject });
    existingWebSuites = getAllExistingSuites(allWebSuites);
    existingWebTestCases = await getAllExistingCases({ type: webProject, suites: existingWebSuites });

    if (appProject) {
      allNativeSuites = await getSuites({ type: appProject });
      existingNativeSuites = getAllExistingSuites(allNativeSuites);
      existingNativeTestCases = await getAllExistingCases({ type: appProject, suites: existingNativeSuites });
    }
  } catch (error) {
    throw error;
  }
}

const deleteSuites = async () => {
  try {
    const suites = [...allWebSuites, ...allNativeSuites];
    const projects = [webProject];
    if (appProject) {
      projects.push(appProject);
    }
    deleteSuitesInProjects({
      projects,
      suites,
    });
  } catch (error) {
    throw error;
  }
}

const deleteAllSuites = async () => {
  try {
    const deletePromises = map([...allWebSuites, ...allNativeSuites], suite => deleteSuite(suite.id));
    await Promise.all(deletePromises);
  } catch (error) {
    throw error;
  }
}

const formateProjects = async () => {
  try {
    const projectPrefix = getProjectPrefix();
    webProject = `${projectPrefix}_WEB`;

    if (!getProjectId(webProject)) {
      throw new Error('WEB project not found');
    }
    if (getProjectId(`${projectPrefix}_APP`)) {
      appProject = `${projectPrefix}_APP`;
    }
  } catch (error) {
    throw error;
  }
}

const parseHandler = async (describes) => {
  try {
    formateProjects();

    await getAllSuitesAndCases();
    await deleteSuites();
    // process.exit();

    const parserPromises = map(describes, describe => parseTest(describe));
    await Promise.all(parserPromises);

    // await getAllSuitesAndCases();
    // await removeCommonNativeCases();
    process.exit();
  } catch (error) {
    throw error;
  }
}


const parseTest = async (describe) => {
  try {
    const testName = describe.title;
    const currentProjectName = getProjectName(testName);

    if (!currentProjectName) {
      return;
    }

    let parsedTests = map(describe.tests, currentTest => getParsedObject({
      content: currentTest.body,
      testName: currentTest.title,
    }));

    // todo: need to optimize
    const suiteSectionData = await createSuiteAndSection({
      testName,
      type: currentProjectName
    });
    await createCases({
      parsedTests: map(parsedTests, parsedTest => ({...parsedTest, custom_id: `${currentProjectName}_${Buffer.from(parsedTest.title).toString('base64')}`})),
      section: suiteSectionData.section
    });


    if (currentProjectName === webProject && appProject) {
      const commonParsedTests = filter(parsedTests, parsedTest => parsedTest && parsedTest.custom_type === TEST_CASE_TYPES.common);
      await createCommonCases({
        testName: replace(testName, currentProjectName, appProject),
        parsedTests: commonParsedTests,
        appProject
      });
    }
  } catch (error) {
    throw error;
  }
}

const createCommonCases = async (data) => {
  const {
    testName,
    parsedTests,
    appProject
  } = data;

  const suiteSectionData = await createSuiteAndSection({
    testName,
    type: appProject
  });

  await createCases({
    parsedTests: map(parsedTests, parsedTest => ({...parsedTest, custom_id: `${appProject}_${parsedTest.title}`})),
    section: suiteSectionData.section
  });
}

// const removeCommonNativeCases = async (data) => {
//   const commonWebTestCaseCustomIds = map(
//     filter(
//       flatten(values(existingWebTestCases)),
//       existingWebTestCase => includes([TEST_CASE_TYPES.common], existingWebTestCase.custom_type)
//     ),
//     existingWebTestCase => existingWebTestCase.custom_id
//   );
//
//   console.log('commonWebTestCaseCustomIds: ', commonWebTestCaseCustomIds);
//   const removeNativeTestCaseIds = map(
//     filter(
//       flatten(values(existingNativeTestCases)),
//       existingNativeTestCase =>
//         includes([TEST_CASE_TYPES.common], existingNativeTestCase.custom_type) &&
//         !includes(commonWebTestCaseCustomIds, existingNativeTestCase.custom_id)
//     ), filteredExistingNativeTestCase => filteredExistingNativeTestCase.id
//   );
//
//   console.log('removeNativeTestCaseIds: ', removeNativeTestCaseIds);
//   const removeNativeTestCasePromises = map(removeNativeTestCaseIds, removeNativeTestCaseId => deleteTestCase(removeNativeTestCaseId));
//   await Promise.all(removeNativeTestCasePromises);
//
//   const afterRemovingExistingNativeTestCases = filter(
//     flatten(values(existingNativeTestCases)),
//     existingNativeTestCase => !includes(removeNativeTestCaseIds, existingNativeTestCase.id)
//   );
//
//   const afterRemovingExistingNativeSuiteIds = map(afterRemovingExistingNativeTestCases, afterRemovingExistingNativeTestCase => afterRemovingExistingNativeTestCase.suite_id);
//   const removeNativeSuiteIds = map(filter(
//     existingNativeSuites,
//     existingNativeSuite => !includes(afterRemovingExistingNativeSuiteIds, existingNativeSuite.id)
//   ), filteredExistingNativeSuite => filteredExistingNativeSuite.id);
//
//   console.log('removeNativeSuiteIds: ', removeNativeSuiteIds);
//   const removeNativeTestSuitePromises = map(removeNativeSuiteIds, removeNativeSuiteId => deleteSuite(removeNativeSuiteId));
//   await Promise.all(removeNativeTestSuitePromises);
// }
//
// const newParseTest = async (describe) => {
//   try {
//     const testName = describe.title;
//     const currentTestSuiteObject = extractIdAndTitle(testName);
//     const webSuite = find(existingWebSuites, existingWebSuite => existingWebSuite.uuid === currentTestSuiteObject.uuid);
//     let section;
//
//     let parsedTests = map(describe.tests, currentTest => getParsedObject({
//       content: currentTest.body,
//       testName: currentTest.title,
//     }));
//
//     const commonParsedTests = filter(parsedTests, parsedTest => parsedTest && includes([TEST_CASE_TYPES.common], parsedTest.custom_type));
//     const webParsedTests = filter(parsedTests, parsedTest => parsedTest && includes([TEST_CASE_TYPES.web, null], parsedTest.custom_type));
//
//     if (webSuite) {
//       const suiteId = webSuite.id;
//       // update suite
//       await updateSuite({ ...webSuite, name: testName });
//       // get section by suiteId === webSuite.id
//       const sections = await getSections({ suiteId, type: 'web' });
//       // update section
//       if (sections) {
//         section = await updateSection({ ...sections[0], name: testName });
//       } else {
//         // create section
//         console.log('START ADD SECTION');
//         const sectionData = {
//           sectionData: {
//             name: testName
//           },
//           suiteId,
//           type
//         };
//         section = await addSection(sectionData);
//       }
//
//       const existingWebSuiteTestCases = existingWebTestCases[suiteId];
//       const removeSuiteTestCaseIds = [];
//       const updateSuiteTestCases = [];
//       const createSuiteTestCases = [];
//       map(existingWebSuiteTestCases, existingWebSuiteTestCase => {
//         const foundCase = find(parsedTests, parsedTest => parsedTest.custom_id === existingWebSuiteTestCase.custom_id);
//         if (!foundCase) {
//           removeSuiteTestCaseIds.push(existingWebSuiteTestCase.id);
//         } else {
//           updateSuiteTestCases.push({ ...foundCase, id: existingWebSuiteTestCase.id });
//         }
//       });
//       // search new cases for create from "parsedTests"
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
//       const updateSuiteTestCasePromises = map(updateSuiteTestCases, updateSuiteTestCase => updateCase(updateSuiteTestCase));
//       await Promise.all(updateSuiteTestCasePromises);
//
//       await createCases({
//         parsedTests: createSuiteTestCases,
//         section
//       });
//
//       const deleteTestCasePromises = map(removeSuiteTestCaseIds, removeSuiteTestCaseId => deleteTestCase(removeSuiteTestCaseId));
//       await Promise.all(deleteTestCasePromises);
//     } else {
//       const suiteSectionData = await createSuiteAndSection({
//         testName,
//         type: 'web'
//       });
//
//       await createCases({
//         parsedTests,
//         section: suiteSectionData.section
//       });
//     }
//
//     // Create common test cases in native project
//     await createCommonTestCases({
//       testName,
//       commonParsedTests
//     });
//   } catch(error) {
//     throw error;
//   }
// }
//
// const createCommonTestCases = async (data) => {
//   try {
//     const {
//       testName,
//       commonParsedTests
//     } = data;
//
//     let createCommonParsedTests = commonParsedTests;
//     const currentTestSuiteObject = extractIdAndTitle(testName);
//     const foundNativeSuite = find(existingNativeSuites, existingNativeSuite => existingNativeSuite.uuid === currentTestSuiteObject.uuid);
//
//     let section;
//     let suiteId;
//
//     if (foundNativeSuite) {
//       suiteId = foundNativeSuite.id;
//       await updateSuite({ ...foundNativeSuite, name: testName });
//       const sections = await getSections({ suiteId, type: 'native' });
//       section = await updateSection({ ...sections[0], name: testName });
//
//       // duplicated
//       const existingNativeSuiteTestCases = existingNativeTestCases[suiteId];
//       const removeSuiteTestCaseIds = [];
//       const updateSuiteTestCases = [];
//       const createSuiteTestCases = [];
//       map(existingNativeSuiteTestCases, existingNativeSuiteTestCase => {
//         const foundCase = find(commonParsedTests, commonParsedTest => commonParsedTest.custom_id === existingNativeSuiteTestCase.custom_id);
//         if (!foundCase && includes([TEST_CASE_TYPES.common], existingNativeSuiteTestCase.custom_type)) {
//           removeSuiteTestCaseIds.push(existingNativeSuiteTestCase.id);
//         }
//         if (foundCase) {
//           updateSuiteTestCases.push({ ...foundCase, id: existingNativeSuiteTestCase.id });
//         }
//       });
//
//
//       // console.log('commonParsedTests: ', commonParsedTests);
//       map(commonParsedTests, commonParsedTest => {
//         const foundTestCase = find(updateSuiteTestCases, updateSuiteTestCase =>
//           commonParsedTest.custom_id === updateSuiteTestCase.custom_id
//         );
//
//         if (!foundTestCase) {
//           createSuiteTestCases.push(commonParsedTest);
//         }
//       });
//
//       // console.log('createSuiteTestCases: ', createSuiteTestCases);
//       createCommonParsedTests = createSuiteTestCases;
//       const updateSuiteTestCasePromises = map(updateSuiteTestCases, updateSuiteTestCase => updateCase(updateSuiteTestCase));
//       await Promise.all(updateSuiteTestCasePromises);
//     }
//
//     if (!section) {
//       // Check if we need to create a new suite
//       if (!foundNativeSuite) {
//         // Create suite and its default section since no suite was found
//         const suiteSectionData = await createSuiteAndSection({
//           testName: testName,
//           type: 'native',
//         });
//         section = suiteSectionData.section;
//       } else {
//         // Create a section in the found suite
//         section = await addSection({
//           sectionData: { name: testName },
//           suiteId,
//           type: 'native',
//         });
//       }
//     }
//
//     await createCases({
//       parsedTests: createCommonParsedTests,
//       section
//     });
//   } catch(error) {
//     throw error;
//   }
// }

const parseWeb = async (params) => {
  let indents = 0;
  const { runner, runnerConstants } = params;
  const { stats } = runner;
  const {
    EVENT_RUN_BEGIN,
    EVENT_RUN_END,
    EVENT_TEST_FAIL,
    EVENT_TEST_PASS,
    EVENT_SUITE_BEGIN,
    EVENT_SUITE_END
  } = runnerConstants;
  runner
    .once(EVENT_RUN_BEGIN, async () => {
      console.log('START RUNNER');
    })
    .on(EVENT_SUITE_BEGIN, async (test) => {
      if (process.env.IS_TESTRAIL && !(test.suites.length && !test.title.length)) {
        console.log('START TESTS');
        allTests.push(test);
      }

      indents++;
    })
    .on(EVENT_SUITE_END, () => {
      indents--;
    })
    .on(EVENT_TEST_PASS, test => {
      console.log(`${Array(indents).join('  ')}pass parse here: ${test.fullTitle()}`);
    })
    .on(EVENT_TEST_FAIL, (test, err) => {
      console.log(
        `${Array(indents).join('  ')}fail parse here: ${test.fullTitle()} - error: ${err.message}`
      );
    })
    .once(EVENT_RUN_END, async () => {
      try {
        await parseHandler(allTests);
      } catch (error) {
        console.error('ERROR: ', error);
      }
      console.log(`end: ${stats.passes}/${stats.passes + stats.failures} ok`);
    });
}

module.exports = {
  parseWeb
};
