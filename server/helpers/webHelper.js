const { addSection, getSuites, getSections, TEST_CASE_TYPES } = require("./testrailReportHelper");
const { getParsedObject, createCases, createSuiteAndSection, deleteWebTestCases} = require("./commonHelper");
const map = require("lodash/map");
const filter = require("lodash/filter");
const find = require("lodash/find");
const head = require("lodash/head");
const includes = require("lodash/includes");

let isDeletedSuites = false;

const parseHandler = async (test) => {
  try {
    if (!isDeletedSuites) {
      console.log('START DELETE SUITES');
      await deleteWebTestCases();
      isDeletedSuites = true;
    }

    // Create test cases in web project
    const parsedTests = map(test.tests, currentTest => getParsedObject({
      content: currentTest.body,
      testName: currentTest.title,
    }));

    const commonParsedTests  = filter(parsedTests, parsedTest => parsedTest && includes([TEST_CASE_TYPES.common], parsedTest.custom_type));
    const webParsedTests  = filter(parsedTests, parsedTest => parsedTest && includes([TEST_CASE_TYPES.web, null], parsedTest.custom_type));

    const suiteSectionData = await createSuiteAndSection({
      testName: test.title,
      type: 'web'
    });

    await createCases({
      parsedTests: [...webParsedTests, ...commonParsedTests],
      section: suiteSectionData.section
    });

    // Create common test cases in native project
    await createCommonTestCases({
      testName: test.title,
      commonParsedTests
    });

  } catch (error) {
    console.error(error.message);
  }
}

const createCommonTestCases = async (data) => {
  const {
    testName,
    commonParsedTests
  } = data;
  const allNativeSuites = await getSuites({ type: 'native' });
  const foundNativeSuite = find(allNativeSuites, suite => suite.name === testName);
  let section;
  let suiteId;

  if (foundNativeSuite) {
    suiteId = foundNativeSuite.id;
    const sections = await getSections({ suiteId, type: 'native' });
    section = head(sections);
  }

  if (!section) {
    // Check if we need to create a new suite
    if (!foundNativeSuite) {
      // Create suite and its default section since no suite was found
      const suiteSectionData = await createSuiteAndSection({
        testName: testName,
        type: 'native',
      });
      section = suiteSectionData.section;
    } else {
      // Create a section in the found suite
      section = await addSection({
        sectionData: { name: testName },
        suiteId,
        type: 'native',
      });
    }
  }

  await createCases({
    parsedTests: commonParsedTests,
    section
  });
}

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
        await parseHandler(test);
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
    .once(EVENT_RUN_END, () => {
      console.log(`end: ${stats.passes}/${stats.passes + stats.failures} ok`);
    });
}

module.exports = {
  parseWeb
};
