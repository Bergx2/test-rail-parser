const map = require('lodash/map');
const isEmpty = require('lodash/isEmpty');
const includes = require('lodash/includes');
const keys = require('lodash/keys');
const head = require('lodash/head');
const split = require('lodash/split');

const axios = require('../utils/axios');
const logger = require('../utils/logger');

const getProjectPrefix = () => {
  return process.env.TESTRAIL_PROJECT_PREFIX;
};
const getProjects = () => JSON.parse(process.env.TESTRAIL_PROJECTS);
const getProjectId = type => {
  return getProjects()[type];
};

const getProjectName = testName =>
  includes(keys(getProjects()), head(split(testName, ':')))
    ? head(split(testName, ':'))
    : null;

const addResource = async data => {
  const { resourceData, id, endpoint } = data;
  try {
    const response = await axios.post(
      `index.php?/api/v2/${endpoint}/${id}`,
      resourceData,
    );

    return response.data;
  } catch (error) {
    logger.log(
      'error',
      `Error creating / updating resource(endpoint: ${endpoint}, id: ${id}): ${
        error.response ? error.response.data : error.message
      }`,
    );
    throw error;
  }
};

const getQueryStringByParams = params =>
  map(params, (value, key) => `${key}=${encodeURIComponent(value)}`).join('&');

const getResources = async data => {
  const { resourceData, id, endpoint } = data;
  try {
    const queryParams = !isEmpty(resourceData)
      ? `&${getQueryStringByParams(resourceData)}`
      : '';
    const response = await axios.get(
      `index.php?/api/v2/${endpoint}/${id}${queryParams}`,
    );
    return response.data;
  } catch (error) {
    logger.log(
      'error',
      `Error getting resource(endpoint: ${endpoint}, id: ${id}, resourceData: ${JSON.stringify(
        resourceData,
      )}): ${
        error.response ? JSON.stringify(error.response.data) : error.message
      }`,
    );
    throw error;
  }
};

const deleteResource = async data => {
  const { id, endpoint } = data;
  try {
    return axios.post(`index.php?/api/v2/${endpoint}/${id}`, {});
  } catch (error) {
    logger.log(
      'error',
      `Error deleting resource (endpoint: ${endpoint}, id: ${id}): ${
        error.response ? error.response.data : error.message
      }`,
    );
    throw error;
  }
};

const getCaseTypes = async params => {
  try {
    const { type } = params;
    const response = await axios.get(
      `index.php?/api/v2/get_case_types/${getProjectId(type)}`,
    );

    return response.data;
  } catch (error) {
    logger.log(
      'error',
      `Error fetching suites: ${
        error.response ? error.response.data : error.message
      }`,
    );
    throw error;
  }
};

module.exports = {
  getCaseTypes,
  getProjectPrefix,
  getProjects,
  getProjectId,
  getProjectName,
  getResources,
  addResource,
  deleteResource,
};
