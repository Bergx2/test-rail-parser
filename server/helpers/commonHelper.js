const flatten = require('lodash/flatten');
const map = require('lodash/map');
const filter = require('lodash/filter');
const includes = require('lodash/includes');
const head = require('lodash/head');
const split = require('lodash/split');
const keys = require('lodash/keys');
const groupBy = require('lodash/groupBy');
const compact = require('lodash/compact');
const get = require('lodash/get');
const pick = require('lodash/pick');

const {
  getProjects,
  deleteResource,
  getProjectId,
  addResource,
  getResources,
} = require('./testrailReportHelper');

const { parseTestCase, extractTestCase } = require('./parserHelper');

const logger = require('../utils/logger');

const getParsedTestCase = data => {
  const { content, testName } = data;
  const commentBlock = extractTestCase(content, 'test_case');

  if (!commentBlock) {
    logger.log('warn', `TEST CASE FOR IT BLOCK '${testName}' NOT FOUND`);
    return null;
  }

  return parseTestCase(commentBlock, testName);
};

const createCases = async data => {
  logger.log('info', `START ADD CASES`);
  const { parsedTests, section } = data;

  const promises = map(parsedTests, currentTest => addResource({
    resourceData: currentTest,
    id: section.id,
    endpoint: 'add_case'
  }));

  const cases = await Promise.all(promises);

  logger.log(
    'info',
    `CREATED CASES: ${map(compact(cases), currentCase => JSON.stringify(pick(currentCase, ['id', 'suite_id', 'title'])))} `,
  );
  logger.log('info', '______________________________________________');
};

const createSuiteAndSection = async data => {
  const { testName, type } = data;
  logger.log('info', 'START ADD SUITE');

  const suiteData = {
    resourceData: {
      name: testName
    },
    id: getProjectId(type),
    endpoint: 'add_suite'
  };
  const suite = await addResource(suiteData);

  logger.log('info', `CREATED SUITE: ${JSON.stringify(pick(suite, ['id', 'name']))}`);

  logger.log('info', 'START ADD SECTION');

  const sectionData = {
    resourceData: {
      name: testName,
      suite_id: suite.id,
    },
    endpoint: 'add_section',
    id: getProjectId(type),
  };

  const section = await addResource(sectionData);

  logger.log('info', `CREATED SECTION: ${JSON.stringify(pick(section, ['id', 'suite_id', 'name']))}`);

  return {
    section,
    suite,
  };
};

const createProjectCases = async data => {
  const { createProjectRepoCases, projectName } = data;
  const groupedCreateProjectRepoSuiteCases = groupBy(
    createProjectRepoCases,
    'suite_id',
  );

  const sectionPromises = map(groupedCreateProjectRepoSuiteCases, (createProjectRepoSuiteCases, suiteId) => getResources({
    id: getProjectId(projectName),
    resourceData: {
      suite_id: suiteId
    },
    endpoint: 'get_sections'
  }));

  let sectionsData = await Promise.all(sectionPromises);
  let sections = get(head(sectionsData), 'sections', []);

  sections = groupBy(
    sections,
    'suite_id',
  );

  const promises = map(
    groupedCreateProjectRepoSuiteCases,
    (createProjectRepoSuiteCases, suiteId) => createCases({
      parsedTests: map(createProjectRepoSuiteCases, parsedTest => ({
        ...parsedTest,
        custom_id: `${projectName}:${Buffer.from(parsedTest.title).toString(
          'base64',
        )}`,
      })),
      section: head(sections[suiteId]),
    }));
  return Promise.all(promises);
};

const getSuiteName = data => {
  const { suite } = data;
  return get(suite, 'title') || get(suite, 'test.parent.name');
};

// in the future, we will detect not needed suites and remove them
const removeAndCreateTestSuites = async data => {
  const {
    describes,
    projectName,
    repoProjectCommonSuiteNames,
  } = data;
  const repoProjectSuites = filter(
    describes,
    describe =>
      projectName ===
      getProjectName(getSuiteName({ suite: describe })),
  );
  let repoProjectSuiteNames = map(repoProjectSuites, repoProjectSuite =>
    getSuiteName({ suite: repoProjectSuite }),
  );

  if (repoProjectCommonSuiteNames) {
    repoProjectSuiteNames = [
      ...repoProjectSuiteNames,
      ...repoProjectCommonSuiteNames,
    ];
  }

  const suiteSectionPromises = map(
    repoProjectSuiteNames,
    createRepoProjectSuiteName =>
      createSuiteAndSection({
        testName: createRepoProjectSuiteName,
        type: projectName,
      }),
  );

  await Promise.all(suiteSectionPromises);
};

// in the future, we will prepare test cases for removing, updating and creating
const getPreparedProjectRepoCases = data => {
  const { parsedTests, projectName } = data;
  const projectRepoCases = filter(
    parsedTests,
    parsedTest => projectName === getProjectName(parsedTest.custom_id),
  );

  return {
    createProjectRepoCases: projectRepoCases,
  };
};

const getAllExistingCases = async data => {
  const { suites, type } = data;
  const testCasesPromises = map(suites, suite =>
    getResources({
      id: getProjectId(type),
      resourceData: {
        suite_id: suite.id
      },
      endpoint: 'get_cases'
    })
  );
  const testCasesData = await Promise.all(testCasesPromises);
  return flatten(get(head(testCasesData), 'cases', []));
};

const getProjectName = testName => {
  const currentProjectName = head(split(testName, ':'));
  return includes(keys(getProjects()), currentProjectName)
    ? currentProjectName
    : null;
};

const deleteAllSuites = suites => {
  const deleteSuitePromises = map(suites, suite => deleteResource({id: suite.id, endpoint: 'delete_suite'}));
  return Promise.all(deleteSuitePromises);
};

module.exports = {
  getParsedTestCase,
  createCases,
  createSuiteAndSection,
  getAllExistingCases,
  getProjectName,
  removeAndCreateTestSuites,
  getPreparedProjectRepoCases,
  createProjectCases,
  deleteAllSuites,
};
