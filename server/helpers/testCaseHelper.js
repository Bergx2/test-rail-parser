const get = require('lodash/get');
const filter = require('lodash/filter');
const map = require('lodash/map');
const compact = require('lodash/compact');
const pick = require('lodash/pick');
const { addResource, getProjectName } = require('./testrailHelper');
const logger = require('../utils/logger');

const createCase = testCase =>
  addResource({
    resourceData: testCase,
    id: testCase.section_id,
    endpoint: 'add_case',
  });

const createProjectCases = async data => {
  logger.log('info', `START ADD CASES`);
  const { createRepoProjectCases } = data;

  const promises = map(createRepoProjectCases, createRepoProjectCase =>
    createCase(createRepoProjectCase),
  );
  const cases = await Promise.all(promises);
  logger.log(
    'info',
    `CREATED CASES: ${map(compact(cases), currentCase =>
      JSON.stringify(pick(currentCase, ['id', 'suite_id', 'title'])),
    )} `,
  );
  logger.log('info', '______________________________________________');
  return cases;
};

const getProjectRepoCases = data =>
  filter(
    get(data, 'parsedTests', []),
    parsedTest =>
      get(data, 'projectName') === getProjectName(get(parsedTest, 'custom_id')),
  );

module.exports = {
  createCase,
  getProjectRepoCases,
  createProjectCases,
};
