const includes = require('lodash/includes');
const keys = require('lodash/keys');
const head = require('lodash/head');
const split = require('lodash/split');

const axios = require('../utils/axios');
const logger = require('../utils/logger');

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
        error.response ? JSON.stringify(error.response.data) : error.message
      }`,
    );
    throw error;
  }
};

const getResources = async ({ resourceData, id, endpoint }) => {
  try {
    const url = `index.php?/api/v2/${endpoint}/${id}`;
    const { data } = await axios.get(url, { params: resourceData });
    return data;
  } catch (error) {
    const errorMessage = error.response
      ? JSON.stringify(error.response.data)
      : error.message;
    logger.log(
      'error',
      `Error getting resource(endpoint: ${endpoint}, id: ${id}, resourceData: ${JSON.stringify(
        resourceData,
      )}): ${errorMessage}`,
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

module.exports = {
  getProjects,
  getProjectId,
  getProjectName,
  getResources,
  addResource,
  deleteResource,
};
