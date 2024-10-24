const map = require('lodash/map');
const forEach = require('lodash/forEach');
const get = require('lodash/get');
const includes = require('lodash/includes');
const filter = require('lodash/filter');
const find = require('lodash/find');
const flatten = require('lodash/flatten');
const compact = require('lodash/compact');
const replace = require('lodash/replace');

const { getProjectName } = require('./testrailHelper');
const { getParsedTestCase } = require('./parserHelper');

const getProjectsCommonParsedTests = data => {
  const { projects, commonParsedTest } = data;
  const suiteName = get(commonParsedTest, 'suiteName');
  const currentProjectName = getProjectName(suiteName);
  if (!includes(projects, currentProjectName)) {
    return [];
  }
  const filteredProjects = filter(
    projects,
    project => project !== currentProjectName,
  );
  return map(filteredProjects, project => ({
    ...commonParsedTest,
    suiteName: replace(suiteName, new RegExp(currentProjectName, 'g'), project),
  }));
};

const getRepoProjectCommonSuiteCases = data => {
  const { parsedTests, projects } = data;
  const commonParsedTests = filter(parsedTests, parsedTest =>
    get(parsedTest, 'custom_is_common'),
  );

  const projectsCommonParsedTests = map(commonParsedTests, commonParsedTest =>
    getProjectsCommonParsedTests({ commonParsedTest, projects }),
  );
  return flatten(projectsCommonParsedTests);
};

const getRepoProjectCommonSuiteNames = parsedTests =>
  map(parsedTests, 'suiteName');

const getParsedTests = data => {
  const { suites } = data;

  const tests = map(suites, suite =>
    map(suite.tests, test => ({ ...test, suiteName: suite.title })),
  );

  const parsedTests = map(flatten(tests), currentTest => {
    const parsedTest = getParsedTestCase({
      content: currentTest.body,
      testName: currentTest.title,
    });

    if (!parsedTest) {
      return null;
    }

    return { ...parsedTest, suiteName: currentTest.suiteName };
  });

  return compact(parsedTests);
};

const getAllParsedTests = data => {
  const { parsedTests, projects } = data;
  const commonParsedTests = getRepoProjectCommonSuiteCases({
    parsedTests,
    projects,
  });

  return [...parsedTests, ...commonParsedTests];
};

const getPreparedParsedTests = data => {
  const { testrailProjectSuites, testrailProjectSections, parsedTests } = data;
  return map(parsedTests, currentTest => {
    const currentProjectName = getProjectName(currentTest.suiteName);
    const foundSuite = find(testrailProjectSuites, {
      name: currentTest.suiteName,
    });

    const foundSection = find(testrailProjectSections, {
      suite_id: foundSuite.id,
    });

    return {
      ...currentTest,
      custom_id: `${currentProjectName}:${Buffer.from(
        currentTest.title,
      ).toString('base64')}`,
      suite_id: foundSuite.id,
      section_id: foundSection.id,
    };
  });
};

const getPreparedProjectTests = data => {
  const { projects, parsedTests } = data;
  const preparedProjectTests = {};
  forEach(projects, project => {
    preparedProjectTests[project] = filter(
      parsedTests,
      parsedTest => project === getProjectName(get(parsedTest, 'suiteName')),
    );
  });

  return preparedProjectTests;
};

module.exports = {
  getPreparedParsedTests,
  getRepoProjectCommonSuiteCases,
  getRepoProjectCommonSuiteNames,
  getParsedTests,
  getAllParsedTests,
  getPreparedProjectTests,
};
