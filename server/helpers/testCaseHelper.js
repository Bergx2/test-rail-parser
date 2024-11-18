const reduce = require('lodash/reduce');
const concat = require('lodash/concat');
const map = require('lodash/map');
const compact = require('lodash/compact');
const pick = require('lodash/pick');
const { addResource, deleteResource } = require('./testrailHelper');
const logger = require('../utils/logger');
const { getResources } = require('./testrailHelper');

const createCase = testCase =>
  addResource({
    resourceData: testCase,
    id: testCase.section_id,
    endpoint: 'add_case',
  });

const getCases = data =>
  getResources({
    resourceData: pick(data, ['suite_id']),
    id: data.project_id,
    endpoint: 'get_cases',
  });

const createProjectCases = async createRepoProjectCases => {
  logger.log('info', `START ADD CASES`);

  const createdCases = await reduce(
    createRepoProjectCases,
    async (accPromise, createRepoProjectCase) => {
      const acc = await accPromise;
      const currentCase = await createCase(createRepoProjectCase);
      return concat(acc, currentCase);
    },
    Promise.resolve([]),
  );

  logger.log(
    'info',
    `CREATED CASES: ${map(compact(createdCases), currentCase =>
      JSON.stringify(pick(currentCase, ['id', 'suite_id', 'title'])),
    )} `,
  );
  logger.log('info', '______________________________________________');
  return createdCases;
};

const deleteCases = cases => {
  const deleteCasePromises = map(cases, testCase =>
    deleteResource({ id: testCase.id, endpoint: 'delete_case' }),
  );
  return Promise.all(deleteCasePromises);
};

module.exports = {
  createCase,
  createProjectCases,
  getCases,
  deleteCases,
};
