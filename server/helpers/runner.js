const keys = require('lodash/keys');
const flatMap = require('lodash/flatMap');
const map = require('lodash/map');
const uniq = require('lodash/uniq');
const flatten = require('lodash/flatten');
const includes = require('lodash/includes');
const filter = require('lodash/filter');
const concat = require('lodash/concat');
const get = require('lodash/get');

const logger = require('../utils/logger');

const {
  getParsedTestCases,
  getPreparedParsedTestCases,
  getTestCases,
  getTestrailTestCases,
  getUpdateCreateTestCases,
} = require('./runnerHelper');
const { deleteAllSuites, getAllTestrailSuites } = require('./suiteHelper');
const { createSuitesSections } = require('./commonHelper');
const { getProjects, addResource } = require('./testrailHelper');
const { createProjectCases } = require('./testCaseHelper');
const { getAllTestrailSections } = require('./sectionHelper');

const allDescribes = [];

const updateTestCases = data => {
  const { projects, updateTestrailTestCases } = data;
  const updateSuiteSectionPromises = map(projects, project =>
    map(get(updateTestrailTestCases, project, []), updateTestrailTestCase =>
      addResource({
        resourceData: updateTestrailTestCase,
        endpoint: 'update_case',
        id: get(updateTestrailTestCase, 'id'),
      }),
    ),
  );
  return Promise.all(updateSuiteSectionPromises);
};

const createTestCases = async data => {
  const { projects, createTestrailTestCases, suites, sections } = data;
  const createSuiteNames = uniq(flatMap(createTestrailTestCases, 'suiteName'));
  const testrailSuiteNames = uniq(map(suites, 'name'));
  const filteredCreateSuiteNames = filter(
    createSuiteNames,
    createSuiteName => !includes(testrailSuiteNames, createSuiteName),
  );

  const createSuiteSectionPromises = map(projects, project => {
    const projectSuiteNames = uniq(
      map(createTestrailTestCases[project], 'suiteName'),
    );
    return createSuitesSections({
      suiteNames: filter(projectSuiteNames, suiteName =>
        includes(filteredCreateSuiteNames, suiteName),
      ),
      projectName: project,
    });
  });

  let suitesSections = await Promise.all(createSuiteSectionPromises);
  suitesSections = flatten(suitesSections);

  const allSuites = concat(map(suitesSections, 'suite'), suites);
  const allSections = concat(map(suitesSections, 'section'), sections);

  const createProjectCasePromises = map(projects, project => {
    const preparedParsedTestCases = getPreparedParsedTestCases({
      testCases: createTestrailTestCases[project],
      testrailProjectSuites: allSuites,
      testrailProjectSections: allSections,
    });

    return createProjectCases(preparedParsedTestCases);
  });

  return Promise.all(createProjectCasePromises);
};

const deleteSuitesInProject = async projects => {
  const suites = await getAllTestrailSuites(projects);
  return deleteAllSuites(flatMap(suites));
};

const parseHandler = async describes => {
  const projects = keys(getProjects());

  // await deleteSuitesInProject(projects);

  const parsedTestCases = getParsedTestCases(describes);
  const testCases = getTestCases({ projects, parsedTestCases });

  const suites = await getAllTestrailSuites(projects);
  const testrailTestCases = await getTestrailTestCases({ projects, suites });
  const sections = await getAllTestrailSections(suites);

  const updateTestrailTestCases = getUpdateCreateTestCases({
    projects,
    testCases,
    testrailTestCases,
    isUpdate: true,
  });
  const createTestrailTestCases = getUpdateCreateTestCases({
    projects,
    testCases,
    testrailTestCases: updateTestrailTestCases,
    isUpdate: false,
  });

  await updateTestCases({
    updateTestrailTestCases,
    projects,
  });

  await createTestCases({
    createTestrailTestCases,
    projects,
    sections,
    suites,
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
