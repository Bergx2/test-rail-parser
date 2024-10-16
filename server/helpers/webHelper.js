const map = require('lodash/map');
const filter = require('lodash/filter');
const find = require('lodash/find');
const flatten = require('lodash/flatten');
const compact = require('lodash/compact');
const replace = require('lodash/replace');

const {
  getSuites,
  getProjectPrefix,
  getProjectId,
} = require('./testrailReportHelper');
const {
  getParsedObject,
  getProjectName,
  getManipulationProjectCases,
  createProjectCases,
} = require('./commonHelper');

const getAllSuitesAndCases = async data => {
  const { webProject, appProject } = data;
  const testrailProjectWebSuites = await getSuites({ type: webProject });
  let testrailProjectNativeSuites = [];

  if (appProject) {
    testrailProjectNativeSuites = await getSuites({ type: appProject });
  }

  return {
    testrailProjectWebSuites,
    testrailProjectNativeSuites,
  };
};

const formateProjects = () => {
  const projectPrefix = getProjectPrefix();
  const webProject = `${projectPrefix}_WEB`;
  let appProject = null;

  if (!getProjectId(webProject)) {
    throw new Error('WEB project not found');
  }
  if (getProjectId(`${projectPrefix}_APP`)) {
    appProject = `${projectPrefix}_APP`;
  }

  return {
    webProject,
    appProject,
  };
};

const getRepoProjectCommonSuiteCases = data => {
  const { parsedTests, projects } = data;
  const { webProject, appProject } = projects;
  const commonParsedTests = filter(
    parsedTests,
    parsedTest => parsedTest && parsedTest.custom_is_common,
  );
  return map(commonParsedTests, commonParsedTest => {
    const regex = new RegExp(webProject, 'g');
    const suiteName = commonParsedTest.suiteName;
    return {
      ...commonParsedTest,
      suiteName: replace(suiteName, regex, appProject),
    };
  });
};

const getRepoProjectCommonSuiteNames = parsedTests =>
  map(parsedTests, 'suiteName');

const getParsedTests = data => {
  const { suites } = data;

  const tests = map(suites, suite =>
    map(suite.tests, test => ({ ...test, suiteName: suite.title })),
  );

  const parsedTests = map(flatten(tests), currentTest => {
    const parsedTest = getParsedObject({
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

const getPreparedParsedTests = data => {
  const { testrailProjectSuites, projectName, parsedTests } = data;
  const preparedParsedTests = map(parsedTests, currentTest => {
    const currentProjectName = getProjectName(currentTest.suiteName);
    if (
      !currentProjectName ||
      (currentProjectName && currentProjectName !== projectName)
    ) {
      return null;
    }

    const foundSuite = find(testrailProjectSuites, {
      name: currentTest.suiteName,
    });
    return {
      ...currentTest,
      custom_id: `${currentProjectName}:${Buffer.from(
        currentTest.title,
      ).toString('base64')}`,
      suite_id: foundSuite.id,
    };
  });

  return compact(flatten(preparedParsedTests));
};

const parseTest = async data => {
  const { parsedTests, projectName, testrailProjectSuites } = data;
  const preparedParsedTests = getPreparedParsedTests({
    parsedTests,
    testrailProjectSuites,
    projectName,
  });
  const { createProjectRepoCases } = getManipulationProjectCases({
    parsedTests: preparedParsedTests,
    projectName,
  });

  await createProjectCases({
    createProjectRepoCases,
    projectName,
  });
};

module.exports = {
  getRepoProjectCommonSuiteCases,
  getRepoProjectCommonSuiteNames,
  parseTest,
  formateProjects,
  getAllSuitesAndCases,
  getParsedTests,
};
