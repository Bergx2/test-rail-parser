const flatten = require('lodash/flatten');
const map = require('lodash/map');
const filter = require('lodash/filter');
const includes = require('lodash/includes');
const head = require('lodash/head');
const split = require('lodash/split');
const keys = require('lodash/keys');
const groupBy = require('lodash/groupBy');
const compact = require('lodash/compact');

const {
  addCase,
  getTestCases,
  addSuite,
  addSection,
  getProjects,
  getSections,
  deleteSuite,
} = require('./testrailReportHelper');

const { parseComments, extractCommentBlock } = require('./parserHelper');

const logger = require('../utils/logger');

const REPO_TYPES = {
  native: 'native',
  web: 'web',
};

const getParsedObject = data => {
  const { content, testName } = data;
  const commentBlock = extractCommentBlock(content, 'test_case');

  if (!commentBlock) {
    logger.log('warn', `TEST CASE FOR IT BLOCK '${testName}' NOT FOUND`);
    return null;
  }

  const extractedSections = parseComments(commentBlock);

  return {
    title: testName,
    template_id: 2,
    custom_steps_separated: extractedSections.steps,
    custom_preconds: extractedSections.custom_preconds,
    custom_expected: extractedSections.custom_expected,
    custom_execution_notes: extractedSections.custom_execution_notes,
    custom_automation_status: extractedSections.custom_automation_status,
    custom_severity: extractedSections.custom_severity,
    custom_is_common: extractedSections.custom_is_common,
    custom_id: null,
    priority_id: extractedSections.priority_id,
    type_id: extractedSections.type_id,
    refs: extractedSections.refs,
  };
};

const createCases = async data => {
  logger.log('info', `START ADD CASES`);
  const { parsedTests, section } = data;
  const promises = map(parsedTests, async currentTest =>
    addCase({
      testCase: currentTest,
      sectionId: section.id,
    }),
  );

  const cases = await Promise.all(promises);

  logger.log(
    'info',
    `CREATED CASES: ${map(compact(cases), currentCase =>
      JSON.stringify(currentCase),
    )} `,
  );
  logger.log('info', '______________________________________________');
};

const createSuiteAndSection = async data => {
  const { testName, type } = data;
  logger.log('info', 'START ADD SUITE');
  const suiteData = {
    suiteData: {
      name: testName,
    },
    type,
  };
  const suite = await addSuite(suiteData);

  logger.log('info', `CREATED SUITE: ${JSON.stringify(suite)}`);

  logger.log('info', 'START ADD SECTION');
  const sectionData = {
    sectionData: {
      name: testName,
    },
    suiteId: suite.id,
    type,
  };
  const section = await addSection(sectionData);

  logger.log('info', `CREATED SECTION: ${JSON.stringify(section)}`);

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

  const promises = map(
    groupedCreateProjectRepoSuiteCases,
    async (createProjectRepoSuiteCases, suiteId) => {
      const sections = await getSections({
        suiteId: suiteId,
        type: projectName,
      });

      const section = head(sections);

      await createCases({
        parsedTests: map(createProjectRepoSuiteCases, parsedTest => ({
          ...parsedTest,
          custom_id: `${projectName}:${Buffer.from(parsedTest.title).toString(
            'base64',
          )}`,
        })),
        section,
      });
    },
  );
  return Promise.all(promises);
};

const getSuiteName = data => {
  const { suite, repoType } = data;
  return repoType === REPO_TYPES.web ? suite.title : suite.test.parent.name;
};

// in the future, we will detect not needed suites and remove them
const removeAndCreateTestSuites = async data => {
  const {
    describes,
    projectName,
    repoProjectCommonSuiteNames,
    repoType = REPO_TYPES.web,
  } = data;
  const repoProjectSuites = filter(
    describes,
    describe =>
      projectName ===
      getProjectName(getSuiteName({ suite: describe, repoType })),
  );
  let repoProjectSuiteNames = map(repoProjectSuites, repoProjectSuite =>
    getSuiteName({ suite: repoProjectSuite, repoType }),
  );

  if (repoType === REPO_TYPES.web && repoProjectCommonSuiteNames) {
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
const getManipulationProjectCases = data => {
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
    getTestCases({ type, suiteId: suite.id }),
  );
  const testCases = await Promise.all(testCasesPromises);
  return flatten(testCases);
};

const getProjectName = testName => {
  const currentProjectName = head(split(testName, ':'));
  return includes(keys(getProjects()), currentProjectName)
    ? currentProjectName
    : null;
};

const deleteAllSuites = suites => {
  const deleteSuitePromises = map(suites, suite => deleteSuite(suite.id));
  return Promise.all(deleteSuitePromises);
};

module.exports = {
  getParsedObject,
  createCases,
  createSuiteAndSection,
  getAllExistingCases,
  getProjectName,
  removeAndCreateTestSuites,
  getManipulationProjectCases,
  createProjectCases,
  deleteAllSuites,
  REPO_TYPES,
};
