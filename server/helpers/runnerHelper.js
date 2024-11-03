const map = require('lodash/map');
const set = require('lodash/set');
const reduce = require('lodash/reduce');
const find = require('lodash/find');
const mapValues = require('lodash/mapValues');
const assign = require('lodash/assign');
const forEach = require('lodash/forEach');
const filter = require('lodash/filter');
const pickBy = require('lodash/pickBy');
const flatMap = require('lodash/flatMap');
const compact = require('lodash/compact');
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

const getTestCases = data => {
  const { projects, testCases } = data;
  return reduce(
    projects,
    (acc, project) => {
      const projectTestCases = getProjectTestCases({
        testCases: map(testCases, parsedTestCase => ({
          ...parsedTestCase,
          custom_id: `${project}:${Buffer.from(parsedTestCase.title).toString(
            'base64',
          )}`,
        })),
        project,
      });

      const suiteTestCases = reduce(
        projectTestCases,
        (result, item) => {
          const { suiteName } = item;
          const customId = item.custom_id;

          if (!result[suiteName]) {
            result[suiteName] = {};
          }

          result[suiteName][customId] = item;

          return result;
        },
        {},
      );

      return set(acc, project, suiteTestCases);
    },
    {},
  );
};

const getPreparedTestrailTestCases = data => {
  const { projects, testCases, suiteNameObjects } = data;
  return reduce(
    projects,
    (acc, project) => {
      const projectTestCases = filter(testCases, {
        projectId: getProjectId(project),
      });
      const groupedObject = mapValues(
        pickBy(suiteNameObjects, { projectId: getProjectId(project) }),
        () => ({}),
      );

      if (projectTestCases.length > 0) {
        forEach(projectTestCases, item => {
          const { suiteName } = item;
          const customId = item.custom_id;

          if (groupedObject[suiteName]) {
            assign(groupedObject[suiteName], {
              ...groupedObject[suiteName],
              [customId]: item,
            });
          }
        });
      }
      return set(acc, project, groupedObject);
    },
    {},
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
  const { suiteIdObjects } = data;
  const testrailTestCasePromises = map(suiteIdObjects, (suiteIdObject, id) =>
    getCases({ id, project_id: suiteIdObject.projectId }),
  );

  const testrailTestSuiteCases = await Promise.all(testrailTestCasePromises);
  return map(flatMap(testrailTestSuiteCases, 'cases'), testCase => {
    return {
      ...testCase,
      ...suiteIdObjects[testCase.suite_id],
    };
  });
};

module.exports = {
  getPreparedParsedTestCases,
  getTestCases,
  getParsedTestCases,
  getTestrailTestCases,
  getPreparedTestrailTestCases,
};
