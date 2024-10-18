const logger = require('../utils/logger');
const {
  removeAndCreateTestSuites,
  deleteAllSuites,
} = require('./commonHelper');
const {
  getRepoProjectCommonSuiteCases,
  getRepoProjectCommonSuiteNames,
  getAllSuitesAndCases,
  parseTest,
  formateProjects,
  getParsedTests,
} = require('./webHelper');

let allTests = [];

const handleWebSuiteCases = async data => {
  const { describes, parsedTests, projects } = data;
  const { webProject } = projects;

  let suitesCases = await getAllSuitesAndCases(projects);

  await removeAndCreateTestSuites({
    describes,
    projectName: webProject,
    testrailProjectSuites: suitesCases.testrailProjectWebSuites,
  });

  suitesCases = await getAllSuitesAndCases(projects);

  await parseTest({
    parsedTests,
    projectName: webProject,
    testrailProjectSuites: suitesCases.testrailProjectWebSuites,
  });
};

const handleNativeSuiteCases = async data => {
  const { describes, parsedTests, projects } = data;
  const commonParsedTests = getRepoProjectCommonSuiteCases({
    parsedTests,
    projects,
  });

  const { appProject } = projects;

  let suitesCases = await getAllSuitesAndCases(projects);

  await removeAndCreateTestSuites({
    describes,
    projectName: appProject,
    testrailProjectSuites: suitesCases.testrailProjectNativeSuites,
    repoProjectCommonSuiteNames: getRepoProjectCommonSuiteNames(
      commonParsedTests,
    ),
  });

  suitesCases = await getAllSuitesAndCases(projects);

  // for appProject
  await parseTest({
    parsedTests: [...parsedTests, ...commonParsedTests],
    projectName: appProject,
    testrailProjectSuites: suitesCases.testrailProjectNativeSuites,
  });
};

const deleteSuitesInProject = async projects => {
  const {
    testrailProjectWebSuites,
    testrailProjectNativeSuites,
  } = await getAllSuitesAndCases(projects);
  return deleteAllSuites([
    ...testrailProjectWebSuites,
    ...testrailProjectNativeSuites,
  ]);
};

const parseHandler = async describes => {
  const projects = formateProjects();

  await deleteSuitesInProject(projects);

  const parsedTests = getParsedTests({
    suites: describes,
  });
  await handleWebSuiteCases({
    describes,
    parsedTests,
    projects,
  });

  if (!projects.appProject) {
    return;
  }

  await handleNativeSuiteCases({
    describes,
    parsedTests,
    projects,
  });

  process.exit();
};

const parseWeb = async params => {
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
        logger.log('error', error.toString());
      }
      logger.log(
        'info',
        `end: ${stats.passes}/${stats.passes + stats.failures} ok`,
      );
    });
};

module.exports = {
  parseWeb,
};
