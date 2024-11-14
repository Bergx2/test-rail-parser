const get = require('lodash/get');
const pick = require('lodash/pick');

const {
  addResource,
  getResources,
  deleteResource,
} = require('./testrailHelper');
const logger = require('../utils/logger');

const STATUSES = {
  passed: 1,
  blocked: 2,
  untested: 3,
  retest: 4,
  failed: 5,
};

const createRun = async data => {
  const runData = {
    id: get(data, 'projectId'),
    endpoint: 'add_run',
    resourceData: data,
  };
  const suite = await addResource(runData);

  logger.log(
    'info',
    `CREATED RUN: ${JSON.stringify(pick(suite, ['id', 'name', 'case_ids']))}`,
  );
  return suite;
};

const deleteRun = async data => {
  const runData = {
    id: get(data, 'runId'),
    endpoint: 'delete_run',
  };
  return deleteResource(runData);
};

const getRuns = async data => {
  const runData = {
    id: get(data, 'projectId'),
    endpoint: 'get_runs',
  };
  return getResources(runData);
};

const addCasesResults = async data => {
  const runData = {
    id: get(data, 'runId'),
    endpoint: 'add_results_for_cases',
    resourceData: data,
  };
  return addResource(runData);
};

const getRunResults = async data => {
  const runData = {
    id: get(data, 'projectId'),
    endpoint: 'get_results_for_run',
  };
  return getResources(runData);
};

module.exports = {
  createRun,
  deleteRun,
  getRuns,
  addCasesResults,
  getRunResults,
  STATUSES,
};
