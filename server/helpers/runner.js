const keys = require('lodash/keys');
const flatMap = require('lodash/flatMap');
const map = require('lodash/map');
const concat = require('lodash/concat');
const flatten = require('lodash/flatten');
const get = require('lodash/get');
const difference = require('lodash/difference');

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
const { createProjectCases, deleteCases } = require('./testCaseHelper');
const { getAllTestrailSections } = require('./sectionHelper');

const allDescribes = [];

const updateTestCases = async data => {
  const {
    projectsTestCases,
    projectsTestrailTestCases,
    suiteNameObjects,
    suites,
    sections,
  } = data;
  let allSuites = suites;
  let allSections = sections;
  const deleteTestrailSuites = [];
  const deleteTestrailCases = [];
  const projectPromises = map(
    projectsTestCases,
    async (projectTestCases, project) => {
      // delete suites
      const projectTestrailSuiteNames = keys(
        get(projectsTestrailTestCases, project),
      );
      const projectSuiteNames = keys(projectTestCases);
      const deleteSuiteNames = difference(
        projectTestrailSuiteNames,
        projectSuiteNames,
      );
      deleteTestrailSuites.push(
        map(
          deleteSuiteNames,
          deleteSuiteName => suiteNameObjects[deleteSuiteName],
        ),
      );

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
          } else {
            // delete test cases
            // eslint-disable-next-line lodash/path-style
            const projectsTestrailSuiteTestCases = get(
              projectsTestrailTestCases,
              [project, suiteName], // eslint-disable-line lodash/path-style
            );
            const projectTestrailCaseNames = keys(
              projectsTestrailSuiteTestCases,
            );
            const projectCaseNames = keys(suiteTestCases);
            const deleteCaseNames = difference(
              projectTestrailCaseNames,
              projectCaseNames,
            );
            deleteTestrailCases.push(
              map(
                deleteCaseNames,
                deleteCaseName =>
                  projectsTestrailSuiteTestCases[deleteCaseName],
              ),
            );
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
      await Promise.all(suitePromises);
    },
  );

  await Promise.all(projectPromises);
  await deleteCases(flatten(deleteTestrailCases));
  await deleteSuites(flatten(deleteTestrailSuites));
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

  await updateTestCases({
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
};
