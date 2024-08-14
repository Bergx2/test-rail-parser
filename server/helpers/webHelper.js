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

const parseWeb = async (params) => {
  try {
    const { test } = params;

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

module.exports = {
  addWebCaseHandler,
  parseWeb
};
