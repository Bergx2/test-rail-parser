const keys = require('lodash/keys');
const flatMap = require('lodash/flatMap');
const map = require('lodash/map');
const get = require('lodash/get');
const filter = require('lodash/filter');
const uniq = require('lodash/uniq');
const logger = require('../utils/logger');

const {
  getParsedTests,
  getPreparedParsedTests,
  getAllParsedTests,
  getPreparedProjectTests,
} = require('./runnerHelper');
const { deleteAllSuites, getAllTestrailSuites } = require('./suiteHelper');
const { removeAndCreateSuiteSections } = require('./commonHelper');
const { getProjects, getProjectName } = require('./testrailHelper');
const { getRepoProjectsSections } = require('./sectionHelper');
const { createProjectCases } = require('./testCaseHelper');

const allTests = [];

const handleSuiteCases = async data => {
  const { projects } = data;

  const allParsedTests = getAllParsedTests(data);
  const repoProjectSuiteNames = uniq(map(allParsedTests, 'suiteName'));
  const preparedProjectTests = getPreparedProjectTests({
    projects,
    parsedTests: allParsedTests,
  });
  const createSuiteSectionPromises = map(projects, project =>
    removeAndCreateSuiteSections({
      repoProjectSuiteNames: filter(
        repoProjectSuiteNames,
        repoProjectSuiteName =>
          project === getProjectName(repoProjectSuiteName),
      ),
      projectName: project,
    }),
  );

  await Promise.all(createSuiteSectionPromises);

  const suites = await getAllTestrailSuites(projects);
  const sections = await getRepoProjectsSections({ suites, projects });

  const createProjectCasePromises = map(projects, project => {
    const preparedParsedTests = getPreparedParsedTests({
      parsedTests: get(preparedProjectTests, project, []),
      testrailProjectSuites: suites[project],
      testrailProjectSections: sections[project],
    });

    return createProjectCases({
      createRepoProjectCases: preparedParsedTests,
      project,
    });
  });

  return Promise.all(createProjectCasePromises);
};

const deleteSuitesInProject = async projects => {
  const projectsSuites = await getAllTestrailSuites(projects);
  return deleteAllSuites(flatMap(projectsSuites));
};

const parseHandler = async describes => {
  const projects = keys(getProjects());

  await deleteSuitesInProject(projects);

  const parsedTests = getParsedTests({
    suites: describes,
  });
  await handleSuiteCases({
    parsedTests,
    projects,
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
    .on(EVENT_SUITE_BEGIN, async test => {
      if (
        process.env.IS_TESTRAIL &&
        !(test.suites.length && !test.title.length)
      ) {
        logger.log('info', 'START TESTS');
        allTests.push(test);
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
        await parseHandler(allTests);
      } catch (error) {
        logger.log('error', error);
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
