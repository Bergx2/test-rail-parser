const map = require('lodash/map');
const set = require('lodash/set');
const reduce = require('lodash/reduce');
const concat = require('lodash/concat');
const compact = require('lodash/compact');
const replace = require('lodash/replace');

const { getProjectName } = require('./testrailHelper');
const { getParsedTest } = require('./parserHelper');
const { getSuiteName } = require('./suiteHelper');
const { getCases } = require('./testCaseHelper');
const { formateObjectsByKey } = require('./baseHelper');

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

const getProjectsSuitesTestCases = data => {
  const { projects, testCases } = data;
  return reduce(
    projects,
    (acc, project) => {
      const projectTestCases = getProjectTestCases({
        testCases: map(testCases, parsedTestCase => ({
          ...parsedTestCase,
          custom_id: `${project}:${parsedTestCase.title}`,
        })),
        project,
      });

      // Set the suites and testCases in the accumulated object
      set(
        acc,
        `projectsSuites.${project}`,
        formateObjectsByKey(projectTestCases, 'suiteName'),
      );
      set(
        acc,
        `projectsTestCases.${project}`,
        formateObjectsByKey(projectTestCases, 'custom_id'),
      );

      return acc;
    },
    { projectSuites: {}, projectTestCases: {} },
  );
};

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

const getTestrailTestCases = async suites =>
  reduce(
    suites,
    async (projectSuiteAccPromise, projectSuites, project) => {
      const projectSuiteAcc = await projectSuiteAccPromise;
      const testCases = await reduce(
        projectSuites,
        async (accPromise, suite) => {
          const acc = await accPromise;
          const suiteCases = await getCases({
            suite_id: suite.id,
            project_id: suite.project_id,
          });
          const mappedCases = map(suiteCases.cases, testCase => ({
            ...testCase,
            suiteName: suite.name,
            projectId: suite.project_id,
          }));
          return concat(acc, mappedCases);
        },
        Promise.resolve([]),
      );

      return {
        ...projectSuiteAcc,
        [project]: formateObjectsByKey(testCases, 'custom_id'),
      };
    },
    Promise.resolve({}),
  );

module.exports = {
  getProjectsSuitesTestCases,
  getParsedTestCases,
  getTestrailTestCases,
};
