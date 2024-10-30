const map = require('lodash/map');
const set = require('lodash/set');
const reduce = require('lodash/reduce');
const find = require('lodash/find');
const filter = require('lodash/filter');
const keyBy = require('lodash/keyBy');
const pick = require('lodash/pick');
const flatMap = require('lodash/flatMap');
const includes = require('lodash/includes');
const compact = require('lodash/compact');
const get = require('lodash/get');
const replace = require('lodash/replace');

const { getProjectName, getProjectId } = require('./testrailHelper');
const { getParsedTest } = require('./parserHelper');
const { getSuiteName } = require('./suiteHelper');
const { getCases } = require('./testCaseHelper');

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
        testCases: map(data.parsedTestCases, parsedTestCase => ({
          ...parsedTestCase,
          custom_id: `${project}:${Buffer.from(parsedTestCase.title).toString(
            'base64',
          )}`,
        })),
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
  const { testrailProjectSuites, testrailProjectSections, testCases } = data;
  return map(testCases, testCase => {
    const foundSuite = find(testrailProjectSuites, {
      name: testCase.suiteName,
    });

    const foundSection = find(testrailProjectSections, {
      suite_id: foundSuite.id,
    });

    return {
      ...testCase,
      suite_id: foundSuite.id,
      section_id: foundSection.id,
    };
  });
};

const getTestrailTestCases = async data => {
  const { suites, projects } = data;
  const testrailTestCasePromises = map(suites, suite =>
    getCases(pick(suite, ['id', 'project_id'])),
  );
  const testrailTestSuiteCases = await Promise.all(testrailTestCasePromises);
  const testrailTestCases = flatMap(testrailTestSuiteCases, 'cases');

  return reduce(
    projects,
    (acc, project) => {
      const projectId = getProjectId(project);
      const suiteIds = map(filter(suites, { project_id: projectId }), 'id');
      set(
        acc,
        project,
        filter(testrailTestCases, testrailTestCase =>
          includes(suiteIds, testrailTestCase.suite_id),
        ),
      );
      return acc;
    },
    {},
  );
};

const getUpdateCreateTestCases = data => {
  const { testrailTestCases, testCases, projects, isUpdate } = data;
  return reduce(
    projects,
    (acc, project) => {
      const testrailCasesById = keyBy(
        get(testrailTestCases, project, []),
        'custom_id',
      );
      const filteredCases = compact(
        map(get(testCases, project, []), projectTestCase => {
          const matchingTestrailCase =
            testrailCasesById[projectTestCase.custom_id];
          if (isUpdate && matchingTestrailCase) {
            return { ...projectTestCase, id: matchingTestrailCase.id };
          }
          if (!isUpdate && !matchingTestrailCase) {
            return projectTestCase;
          }
          return null;
        }),
      );
      return set(acc, project, filteredCases);
    },
    {},
  );
};

module.exports = {
  getPreparedParsedTestCases,
  getTestCases,
  getParsedTestCases,
  getTestrailTestCases,
  getUpdateCreateTestCases,
};
