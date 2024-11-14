const keys = require('lodash/keys');
const map = require('lodash/map');
const reduce = require('lodash/reduce');
const get = require('lodash/get');
const uniq = require('lodash/uniq');
const intersection = require('lodash/intersection');
const difference = require('lodash/difference');
const filter = require('lodash/filter');
const includes = require('lodash/includes');
const set = require('lodash/set');
const assign = require('lodash/assign');
const concat = require('lodash/concat');
const logger = require('../utils/logger');

const {
  getTestrailTestCases,
  getProjectsSuitesTestCases,
  getParsedTestCases,
  getRawTestCasesWithStatus,
} = require('./runnerHelper');
const { getAllTestrailSuites, deleteSuites } = require('./suiteHelper');
const { createSuiteAndSection } = require('./commonHelper');
const {
  getProjects,
  addResource,
  getProjectId,
  getProjectName,
} = require('./testrailHelper');
const { createProjectCases, deleteCases } = require('./testCaseHelper');
const { getAllTestrailSections } = require('./sectionHelper');
const { formateObjectsByKey } = require('./baseHelper');
const { STATUSES } = require('./runHelper');

const allDescribes = [];
const allTests = {};

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
      const updateCustomIds = intersection(customIds, testrailCustomIds);
      const createCustomIds = difference(customIds, testrailCustomIds);

      const existingSuiteNames = map(
        [...createCustomIds, ...updateCustomIds],
        customId => projectTestCases[customId].suiteName,
      );
      const projectSuiteNames = keys(suites[project]);
      const deleteSuiteNames = difference(
        projectSuiteNames,
        existingSuiteNames,
      );
      const deleteCustomIds = difference(testrailCustomIds, updateCustomIds);

      const deleteTestCases = map(
        deleteCustomIds,
        deleteCustomId => projectsTestrailTestCases[project][deleteCustomId],
      );
      const deleteTestrailSuites = filter(suites[project], projectSuite =>
        includes(deleteSuiteNames, projectSuite.name),
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

      const updatedTestCases = await Promise.all(updatePromises);
      const createdTestCases = await createProjectCases(
        map(createCustomIds, createCustomId => {
          const { suiteName } = projectTestCases[createCustomId];
          return {
            ...projectTestCases[createCustomId],
            suite_id: suites[project][suiteName].id,
            section_id: sections[project][suiteName].id,
          };
        }),
      );
      return [...createdTestCases, ...updatedTestCases];
    },
  );
  const testCases = await Promise.all(projectPromises);
  return reduce(testCases, (acc, item) => concat(acc, item), []);
};

const createSuitesAndSections = async data => {
  const { projectsSuites, testrailSuites, testrailSections } = data;
  return reduce(
    projectsSuites,
    async (accPromise, suites, project) => {
      const acc = await accPromise;
      const missingSuiteNames = uniq(
        difference(keys(suites), keys(testrailSuites[project])),
      );
      const createdSuitesSectionsPromises = map(missingSuiteNames, suiteName =>
        createSuiteAndSection({
          id: getProjectId(project),
          name: suiteName,
        }),
      );
      const suitesSections = await Promise.all(createdSuitesSectionsPromises);
      set(acc, `suites.${project}`, {
        ...formateObjectsByKey(map(suitesSections, 'suite'), 'name'),
        ...testrailSuites[project],
      });
      set(acc, `sections.${project}`, {
        ...formateObjectsByKey(map(suitesSections, 'section'), 'name'),
        ...testrailSections[project],
      });

      return acc;
    },
    Promise.resolve({ suites: {}, sections: {} }),
  );
};

const deleteSuitesInProject = async projects => {
  const suites = await getAllTestrailSuites(projects);
  return deleteSuites(
    reduce(suites, (acc, projectSuites) => assign(acc, projectSuites), {}),
  );
};

const parseHandler = async describes => {
  const projects = keys(getProjects());
  // await deleteSuitesInProject(projects);

  const parsedTestCases = getParsedTestCases(describes);

  const testrailSuites = await getAllTestrailSuites(projects);
  const testrailSections = await getAllTestrailSections(testrailSuites);
  const projectsTestrailTestCases = await getTestrailTestCases(testrailSuites);
  const { projectsSuites, projectsTestCases } = getProjectsSuitesTestCases({
    projects,
    testCases: parsedTestCases,
  });

  const { suites, sections } = await createSuitesAndSections({
    projectsSuites,
    testrailSuites,
    testrailSections,
  });

  await updateTestCases({
    projectsTestCases,
    projectsTestrailTestCases,
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
      set(allTests, [test.parent.title, test.title], STATUSES.passed); // eslint-disable-line lodash/path-style

      logger.log(
        'info',
        `${Array(indents).join('  ')}pass parse here: ${test.fullTitle()}`,
      );
    })
    .on(EVENT_TEST_FAIL, (test, err) => {
      set(allTests, [test.parent.title, test.title], STATUSES.failed); // eslint-disable-line lodash/path-style
      logger.log(
        'error',
        `${Array(indents).join(
          '  ',
        )}fail parse here: ${test.fullTitle()} - error: ${err.message}`,
      );
    })
    .once(EVENT_RUN_END, async () => {
      try {
        await parseHandler(
          getRawTestCasesWithStatus({
            describes: allDescribes,
            tests: allTests,
          }),
        );
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
