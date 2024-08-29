const { deleteAllSuites, addSuite, addSection } = require("./testrailReportHelper");
const { extractAndParseCommentBlock } = require("./commonHelper");
const map = require("lodash/map");
const filter = require("lodash/filter");
const isNull = require("lodash/isNull");

let isDeletedSuites = false;
const addWebCaseHandler = async (data) => {
  const { currentTest, section } = data;

  return extractAndParseCommentBlock({
    content: currentTest.body,
    testName: currentTest.title,
    section
  });
};

const parseHandler = async (test) => {
  try {
    if (!isDeletedSuites) {
      console.log('START DELETE SUITES');
      await deleteAllSuites();
      isDeletedSuites = true;
    }

    console.log('START ADD SUITE');
    const suite = await addSuite({
      name: test.title
    });

    console.log('CREATED SUITE: ', suite);

    console.log('START ADD SECTION');
    const section = await addSection({
      name: test.title
    }, suite.id);

    console.log('CREATED SECTION: ', section);

    console.log('START ADD CASES');

    const promises = map(test.tests, async currentTest => addWebCaseHandler({currentTest, section}));
    const cases = await Promise.all(promises);

    console.log('CREATED CASES: ', filter(cases, testCase => !isNull(testCase)));
    console.log('______________________________________________');
  } catch (error) {
    console.error(error.message);
  }
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
