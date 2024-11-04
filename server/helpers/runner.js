const keys = require('lodash/keys');
const flatMap = require('lodash/flatMap');
const map = require('lodash/map');
const concat = require('lodash/concat');
const get = require('lodash/get');
const flatten = require('lodash/flatten');
const uniq = require('lodash/uniq');
const has = require('lodash/has');
const filter = require('lodash/filter');
const includes = require('lodash/includes');

const logger = require('../utils/logger');

const {
  getParsedTestCases,
  getPreparedParsedTestCases,
  getTestrailTestCases,
  getProjectsTestCases,
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
    suites,
    sections,
  } = data;
  const projectPromises = map(
    projectsTestCases,
    async (projectTestCases, project) => {
      const testrailCustomIds = keys(projectsTestrailTestCases[project]);
      const customIds = keys(projectTestCases);
      const updateCustomIds = filter(customIds, customId =>
        includes(testrailCustomIds, customId),
      );
      const createCustomIds = filter(
        customIds,
        customId => !includes(testrailCustomIds, customId),
      );
      const deleteCustomIds = filter(
        testrailCustomIds,
        testrailCustomId => !includes(updateCustomIds, testrailCustomId),
      );
      const deleteTestCases = map(
        deleteCustomIds,
        deleteCustomId => projectsTestrailTestCases[project][deleteCustomId],
      );
      const existingSuiteNames = map(
        flatten([createCustomIds, updateCustomIds]),
        customId => get(projectTestCases, [customId, 'suiteName']), // eslint-disable-line lodash/path-style
      );
      const deleteSuiteNames = filter(
        map(deleteTestCases, 'suiteName'),
        deleteSuiteName => !includes(existingSuiteNames, deleteSuiteName),
      );
      const deleteTestrailSuites = filter(suites, suite =>
        includes(deleteSuiteNames, suite.name),
      );

      await deleteCases(deleteTestCases);
      await deleteSuites(deleteTestrailSuites);

      const updatePromises = map(updateCustomIds, updateCustomId => {
        return addResource({
          resourceData: get(projectTestCases, [updateCustomId]), // eslint-disable-line lodash/path-style
          endpoint: 'update_case',
          id: get(projectsTestrailTestCases, [project, updateCustomId, 'id']), // eslint-disable-line lodash/path-style
        });
      });

      await Promise.all(updatePromises);
      return createProjectCases(
        getPreparedParsedTestCases({
          testCases: map(
            createCustomIds,
            createCustomId => get(projectTestCases, [createCustomId]), // eslint-disable-line lodash/path-style
          ),
          testrailProjectSuites: suites,
          testrailProjectSections: sections,
        }),
      );
    },
  );
  return Promise.all(projectPromises);
};

const createSuitesAndSections = async data => {
  const { projectsTestCases, suiteNameObjects } = data;
  const promises = flatMap(projectsTestCases, (projectTestCases, project) => {
    const missingSuiteNames = uniq(
      filter(
        flatMap(projectTestCases, 'suiteName'),
        suiteName => !has(suiteNameObjects, suiteName),
      ),
    );
    return map(missingSuiteNames, suiteName =>
      createSuiteAndSection({
        id: getProjectId(project),
        name: suiteName,
      }),
    );
  });
  return Promise.all(promises);
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

  const projectsTestCases = getProjectsTestCases({
    projects,
    testCases: parsedTestCases,
  });

  const projectsTestrailTestCases = getProjectsTestCases({
    projects,
    testCases: testrailTestCases,
    isTestrail: true,
  });

  const suitesSections = await createSuitesAndSections({
    projectsTestCases,
    suiteNameObjects,
  });

  await updateTestCases({
    projectsTestCases,
    projectsTestrailTestCases,
    suites: concat(map(flatten(suitesSections), 'suite'), suites),
    sections: concat(map(flatten(suitesSections), 'section'), sections),
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
