const get = require('lodash/get');
const map = require('lodash/map');
const pick = require('lodash/pick');
const reduce = require('lodash/reduce');
const flatten = require('lodash/flatten');
const assign = require('lodash/assign');
const {
  deleteResource,
  getProjectId,
  addResource,
  getResources,
} = require('./testrailHelper');
const logger = require('../utils/logger');
const { formateObjectsByKey } = require('./baseHelper');

const deleteSuites = suites => {
  const deleteSuitePromises = map(suites, suite =>
    deleteResource({ id: suite.id, endpoint: 'delete_suite' }),
  );
  return Promise.all(deleteSuitePromises);
};

const getSuiteName = suite =>
  get(suite, 'title') || get(suite, 'test.parent.name');

const createSuite = async data => {
  const suiteData = {
    resourceData: data,
    id: get(data, 'id'),
    endpoint: 'add_suite',
  };
  const suite = await addResource(suiteData);

  logger.log(
    'info',
    `CREATED SUITE: ${JSON.stringify(pick(suite, ['id', 'name']))}`,
  );
  return suite;
};

const getAllTestrailSuites = async projects =>
  reduce(
    projects,
    async (accPromise, project) => {
      const acc = await accPromise;
      const projectSuites = await getResources({
        id: getProjectId(project),
        endpoint: 'get_suites',
      });
      return assign(
        acc,
        { [project]: formateObjectsByKey(projectSuites, 'name') },
        {},
      );
    },
    Promise.resolve({}),
  );

module.exports = {
  deleteSuites,
  getSuiteName,
  createSuite,
  getAllTestrailSuites,
};
