const keys = require('lodash/keys');
const flatMap = require('lodash/flatMap');
const map = require('lodash/map');
const uniq = require('lodash/uniq');
const flatten = require('lodash/flatten');

const logger = require('../utils/logger');

const {
  getParsedTestCases,
  getPreparedParsedTestCases,
  getTestCases,
} = require('./runnerHelper');
const { deleteAllSuites, getAllTestrailSuites } = require('./suiteHelper');
const { createSuitesSections } = require('./commonHelper');
const { getProjects } = require('./testrailHelper');
const { createProjectCases } = require('./testCaseHelper');

const allDescribes = [];

const updateTestCases = async data => {
  const { projects, testCases } = data;
  const createSuiteSectionPromises = map(projects, project =>
    createSuitesSections({
      suiteNames: uniq(map(testCases[project], 'suiteName')),
      projectName: project,
    }),
  );

  let suitesSections = await Promise.all(createSuiteSectionPromises);
  suitesSections = flatten(suitesSections);

  const suites = map(suitesSections, 'suite');
  const sections = map(suitesSections, 'section');

  const createProjectCasePromises = map(projects, project => {
    const preparedParsedTestCases = getPreparedParsedTestCases({
      testCases: testCases[project],
      testrailProjectSuites: suites,
      testrailProjectSections: sections,
      projectName: project,
    });

    return createProjectCases(preparedParsedTestCases);
  });

  return Promise.all(createProjectCasePromises);
};

const deleteSuitesInProject = async projects => {
  const suites = await getAllTestrailSuites(projects);
  return deleteAllSuites(suites);
};

const parseHandler = async describes => {
  const projects = keys(getProjects());

  await deleteSuitesInProject(projects);

  const parsedTestCases = getParsedTestCases(describes);
  const testCases = getTestCases({ projects, parsedTestCases });

  await updateTestCases({
    testCases,
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
