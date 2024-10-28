const map = require('lodash/map');
const set = require('lodash/set');
const reduce = require('lodash/reduce');
const find = require('lodash/find');
const compact = require('lodash/compact');
const replace = require('lodash/replace');

const { getProjectName } = require('./testrailHelper');
const { getParsedTest } = require('./parserHelper');
const { getSuiteName } = require('./suiteHelper');

const getProjectTestCases = data => {
  const { testCases, project } = data;
  return reduce(
    testCases,
    (sum, testCase) => {
      if (
        project === getProjectName(testCase.suiteName) ||
        testCase.custom_is_common
      ) {
        sum.push({
          ...testCase,
          suiteName: replace(
            testCase.suiteName,
            new RegExp(getProjectName(testCase.suiteName), 'g'),
            project,
          ),
        });
      }
      return sum;
    },
    [],
  );
};

const getTestCases = data =>
  reduce(
    data.projects,
    (acc, project) => {
      const projectTestCases = getProjectTestCases({
        testCases: data.parsedTestCases,
        project,
      });
      return set(acc, project, projectTestCases);
    },
    {},
  );

const getParsedTestCases = describes => {
  return compact(
    reduce(
      describes,
      (acc, describe) =>
        acc.concat(
          map(describe.tests, it => {
            const parsedTest = getParsedTest({
              content: it.body,
              testName: it.title,
            });
            if (!parsedTest) {
              return null;
            }
            return { ...parsedTest, suiteName: getSuiteName(describe) };
          }),
        ),
      [],
    ),
  );
};

const getPreparedParsedTestCases = data => {
  const {
    testrailProjectSuites,
    testrailProjectSections,
    testCases,
    projectName,
  } = data;
  return map(testCases, testCase => {
    const foundSuite = find(testrailProjectSuites, {
      name: testCase.suiteName,
    });

    const foundSection = find(testrailProjectSections, {
      suite_id: foundSuite.id,
    });

    return {
      ...testCase,
      custom_id: `${projectName}:${Buffer.from(testCase.title).toString(
        'base64',
      )}`,
      suite_id: foundSuite.id,
      section_id: foundSection.id,
    };
  });
};

module.exports = {
  getPreparedParsedTestCases,
  getTestCases,
  getParsedTestCases,
};
