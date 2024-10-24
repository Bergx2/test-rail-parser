const get = require('lodash/get');
const map = require('lodash/map');
const filter = require('lodash/filter');
const pick = require('lodash/pick');
const reduce = require('lodash/reduce');
const flatten = require('lodash/flatten');
const {
  deleteResource,
  getProjectId,
  addResource,
  getProjectName,
  getResources,
} = require('./testrailHelper');
const logger = require('../utils/logger');

const deleteAllSuites = suites => {
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

const getProjectSuites = data =>
  filter(
    get(data, 'suites', []),
    suite => get(data, 'projectName') === getProjectName(getSuiteName(suite)),
  );

const getAllTestrailSuites = async projects => {
  const projectIds = map(projects, getProjectId);
  const resourcePromises = map(projectIds, id =>
    getResources({ id, endpoint: 'get_suites' }),
  );

  const suites = await Promise.all(resourcePromises);

  return getformattedProjectsSuites({ projects, suites });
};

const getformattedProjectsSuites = data =>
  reduce(
    get(data, 'projects'),
    (result, projectName) => {
      const relatedSuites = filter(flatten(get(data, 'suites')), {
        project_id: getProjectId(projectName),
      });

      result[projectName] = relatedSuites;
      return result;
    },
    {},
  );

module.exports = {
  deleteAllSuites,
  getSuiteName,
  createSuite,
  getProjectSuites,
  getAllTestrailSuites,
};
