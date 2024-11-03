const keys = require('lodash/keys');
const flatMap = require('lodash/flatMap');
const map = require('lodash/map');
const concat = require('lodash/concat');
const get = require('lodash/get');

const logger = require('../utils/logger');

const {
  getParsedTestCases,
  getPreparedParsedTestCases,
  getTestCases,
  getTestrailTestCases,
  getPreparedTestrailTestCases,
} = require('./runnerHelper');
const {
  getAllTestrailSuites,
  deleteSuites,
  getSuiteObjects,
} = require('./suiteHelper');
const { createSuiteAndSection } = require('./commonHelper');
const { getProjects, addResource, getProjectId } = require('./testrailHelper');
const { createProjectCases } = require('./testCaseHelper');
const { getAllTestrailSections } = require('./sectionHelper');

const allDescribes = [];

const updateTestCasesTemp = async data => {
  const {
    projectsTestCases,
    projectsTestrailTestCases,
    suiteNameObjects,
    suites,
    sections,
  } = data;
  let allSuites = suites;
  let allSections = sections;
  const projectPromises = map(
    projectsTestCases,
    (projectTestCases, project) => {
      const suitePromises = map(
        projectTestCases,
        async (suiteTestCases, suiteName) => {
          // eslint-disable-next-line lodash/path-style
          if (!get(projectsTestrailTestCases, [project, suiteName])) {
            const suiteSection = await createSuiteAndSection({
              id: getProjectId(project),
              name: suiteName,
            });
            allSuites = concat(allSuites, suiteSection.suite);
            allSections = concat(allSections, suiteSection.section);
          }

          const casePromises = map(
            suiteTestCases,
            async (suiteTestCase, customId) => {
              const projectsTestrailTestCase = get(
                projectsTestrailTestCases,
                [project, suiteName, customId], // eslint-disable-line lodash/path-style
                null,
              );
              if (projectsTestrailTestCase) {
                // update test case
                return addResource({
                  resourceData: suiteTestCase,
                  endpoint: 'update_case',
                  id: get(projectsTestrailTestCase, 'id'),
                });
              }
              // create test case with suiteTestCase
              const preparedParsedTestCases = getPreparedParsedTestCases({
                testCases: [suiteTestCase],
                testrailProjectSuites: allSuites,
                testrailProjectSections: allSections,
              });

              return createProjectCases(preparedParsedTestCases);
            },
          );
          return Promise.all(casePromises);
        },
      );
      return Promise.all(suitePromises);
    },
  );

  await Promise.all(projectPromises);
};

const deleteSuitesInProject = async projects => {
  const suites = await getAllTestrailSuites(projects);
  return deleteSuites(flatMap(suites));
};

const parseHandler = async describes => {
  const projects = keys(getProjects());
  // await deleteSuitesInProject(projects);

  const parsedTestCases = getParsedTestCases(describes);

  const { suites, suiteIdObjects, suiteNameObjects } = await getSuiteObjects(
    projects,
  );
  const testrailTestCases = await getTestrailTestCases({
    projects,
    suiteIdObjects,
  });
  const sections = await getAllTestrailSections(suites);

  const projectsTestCases = getTestCases({
    projects,
    testCases: parsedTestCases,
  });
  const projectsTestrailTestCases = getPreparedTestrailTestCases({
    projects,
    testCases: testrailTestCases,
    isTestrail: true,
    suiteNameObjects,
  });

  await updateTestCasesTemp({
    projectsTestCases,
    projectsTestrailTestCases,
    suiteNameObjects,
    suites,
    sections,
  });

  process.exit();
};

const runner = async params => {
  let indents = 0;
  const { runner, runnerConstants } = params;
  const { stats } = runner;
  const {
    EVENT_RUN_BEGIN,
    EVENT_RUN_END,
    EVENT_TEST_FAIL,
    EVENT_TEST_PASS,
    EVENT_SUITE_BEGIN,
    EVENT_SUITE_END,
  } = runnerConstants;
  runner
    .once(EVENT_RUN_BEGIN, async () => {
      logger.log('info', 'START RUNNER');
    })
    .on(EVENT_SUITE_BEGIN, async describe => {
      if (
        process.env.IS_TESTRAIL &&
        !(describe.suites.length && !describe.title.length)
      ) {
        logger.log('info', 'START TESTS');
        allDescribes.push(describe);
      }

      indents++;
    })
    .on(EVENT_SUITE_END, () => {
      indents--;
    })
    .on(EVENT_TEST_PASS, test => {
      logger.log(
        'info',
        `${Array(indents).join('  ')}pass parse here: ${test.fullTitle()}`,
      );
    })
    .on(EVENT_TEST_FAIL, (test, err) => {
      logger.log(
        'error',
        `${Array(indents).join(
          '  ',
        )}fail parse here: ${test.fullTitle()} - error: ${err.message}`,
      );
    })
    .once(EVENT_RUN_END, async () => {
      try {
        await parseHandler(allDescribes);
      } catch (error) {
        logger.log('error', error);
        process.exit();
      }
      logger.log(
        'info',
        `end: ${stats.passes}/${stats.passes + stats.failures} ok`,
      );
    });
};

module.exports = {
  runner,
  parseHandler,
};
