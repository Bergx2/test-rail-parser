const axios = require('../utils/axios');
const logger = require('../utils/logger');
const map = require('lodash/map');
const isEmpty = require('lodash/isEmpty');

const getProjectPrefix = () => {
  return process.env.TESTRAIL_PROJECT_PREFIX;
};
const getProjects = () => JSON.parse(process.env.TESTRAIL_PROJECTS);
const getProjectId = type => {
  return getProjects()[type];
};

const addResource = async (data) => {
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
      `Error creating resource(endpoint: ${endpoint}, id: ${id}): ${
        error.response ? error.response.data : error.message
      }`,
    );
    throw error;
  }
}

const updateResource = async data => {
  const { resourceData, endpoint } = data;
  try {
    const response = await axios.post(
      `index.php?/api/v2/${endpoint}/${resourceData.id}`,
      resourceData,
    );

    return response.data;
  } catch (error) {
    logger.log(
      'error',
      `Error updating resource(endpoint: ${endpoint}, id: ${resourceData.id}): ${
        error.response ? error.response.data : error.message
      }`,
    );
    throw error;
  }
}

const getQueryStringByParams = (params) => map(
    params,
    (value, key) => `${key}=${encodeURIComponent(value)}`
  ).join('&');

const getResources = async (data) => {
  const { resourceData, id, endpoint } = data;
  try {
    const queryParams = !isEmpty(resourceData) ? `&${getQueryStringByParams(resourceData)}` : '';
    const response = await axios.get(
      `index.php?/api/v2/${endpoint}/${id}${queryParams}`,
    );
    return response.data;
  } catch (error) {
    logger.log(
      'error',
      `Error getting resource(endpoint: ${endpoint}, id: ${id}, resourceData: ${JSON.stringify(resourceData)}): ${
        error.response ? JSON.stringify(error.response.data) : error.message
      }`,
    );
    throw error;
  }
}

const deleteResource = async (data) => {
  const {id, endpoint} = data;
  try {
    return axios.post(
      `index.php?/api/v2/${endpoint}/${id}`,
      {},
    );
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
    const response = await axios.get(`index.php?/api/v2/get_case_types/${getProjectId(type)}`);

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
  getResources,
  updateResource,
  addResource,
  deleteResource,
};
