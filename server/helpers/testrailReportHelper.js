const axios = require('axios');
const logger = require('../utils/logger');

const getAxiosConfig = () => ({
  headers: {
    'Content-Type': 'application/json',
  },
  auth: {
    username: process.env.TESTRAIL_USERNAME,
    password: process.env.TESTRAIL_API_KEY,
  },
});

const getProjectPrefix = () => {
  return process.env.TESTRAIL_PROJECT_PREFIX;
};
const getProjects = () => JSON.parse(process.env.TESTRAIL_PROJECTS);
const getProjectId = type => {
  return getProjects()[type];
};

const addSection = async data => {
  const { sectionData, suiteId, type } = data;
  try {
    const response = await axios.post(
      `${process.env.TESTRAIL_URL}index.php?/api/v2/add_section/${getProjectId(
        type,
      )}`,
      { ...sectionData, suite_id: suiteId },
      getAxiosConfig(),
    );

    return response.data;
  } catch (error) {
    logger.log(
      'error',
      `Error creating section: ${
        error.response ? error.response.data : error.message
      }`,
    );
    throw error;
  }
};

const updateSection = async data => {
  try {
    const response = await axios.post(
      `${process.env.TESTRAIL_URL}index.php?/api/v2/update_section/${data.id}`,
      data,
      getAxiosConfig(),
    );

    return response.data;
  } catch (error) {
    logger.log(
      'error',
      `Error updating section: ${
        error.response ? error.response.data : error.message
      }`,
    );
    throw error;
  }
};

const addCase = async data => {
  try {
    const { testCase, sectionId } = data;
    const response = await axios.post(
      `${process.env.TESTRAIL_URL}index.php?/api/v2/add_case/${sectionId}`,
      testCase,
      getAxiosConfig(),
    );

    return response.data;
  } catch (error) {
    logger.log(
      'error',
      `Error creating case: ${
        error.response ? error.response.data : error.message
      }`,
    );
    throw error;
  }
};

const updateCase = async data => {
  try {
    const response = await axios.post(
      `${process.env.TESTRAIL_URL}index.php?/api/v2/update_case/${data.id}`,
      data,
      getAxiosConfig(),
    );

    return response.data;
  } catch (error) {
    logger.log(
      'error',
      `Error updating case: ${
        error.response ? error.response.data : error.message
      }`,
    );
    throw error;
  }
};

const getTestCases = async data => {
  try {
    const { sectionId, suiteId, type } = data;
    const baseUrl = `${
      process.env.TESTRAIL_URL
    }index.php?/api/v2/get_cases/${getProjectId(type)}`;
    const sectionUrlParam = `&section_id=${sectionId}`;
    const caseUrl = `${baseUrl}&suite_id=${suiteId}${
      sectionId ? sectionUrlParam : ''
    }`;
    const response = await axios.get(caseUrl, getAxiosConfig());

    return response.data.cases;
  } catch (error) {
    logger.log(
      'error',
      `Error fetching cases: ${
        error.response ? error.response.data : error.message
      }`,
    );
    throw error;
  }
};

const addSuite = async data => {
  const { suiteData, type } = data;
  try {
    const response = await axios.post(
      `${process.env.TESTRAIL_URL}index.php?/api/v2/add_suite/${getProjectId(
        type,
      )}`,
      suiteData,
      getAxiosConfig(),
    );

    return response.data;
  } catch (error) {
    logger.log(
      'error',
      `Error creating suite: ${
        error.response ? error.response.data : error.message
      }`,
    );
    throw error;
  }
};

const updateSuite = async data => {
  try {
    const response = await axios.post(
      `${process.env.TESTRAIL_URL}index.php?/api/v2/update_suite/${data.id}`,
      data,
      getAxiosConfig(),
    );

    return response.data;
  } catch (error) {
    logger.log(
      'error',
      `Error updating suite: ${
        error.response ? error.response.data : error.message
      }`,
    );
    throw error;
  }
};

const getSuites = async params => {
  try {
    const { type } = params;
    const response = await axios.get(
      `${process.env.TESTRAIL_URL}index.php?/api/v2/get_suites/${getProjectId(
        type,
      )}`,
      getAxiosConfig(),
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

const getSections = async params => {
  try {
    const { suiteId, type } = params;
    const response = await axios.get(
      `${process.env.TESTRAIL_URL}index.php?/api/v2/get_sections/${getProjectId(
        type,
      )}&suite_id=${suiteId}`,
      getAxiosConfig(),
    );
    return response.data.sections;
  } catch (error) {
    logger.log(
      'error',
      `Error fetching sections: ${
        error.response ? error.response.data : error.message
      }`,
    );
    throw error;
  }
};

const deleteSuite = async suiteId => {
  try {
    return axios.post(
      `${process.env.TESTRAIL_URL}index.php?/api/v2/delete_suite/${suiteId}`,
      {},
      getAxiosConfig(),
    );
  } catch (error) {
    logger.log(
      'error',
      `Error deleting section: ${
        error.response ? error.response.data : error.message
      }`,
    );
    throw error;
  }
};

const deleteTestCase = async caseId => {
  try {
    return axios.post(
      `${process.env.TESTRAIL_URL}index.php?/api/v2/delete_case/${caseId}`,
      {},
      getAxiosConfig(),
    );
  } catch (error) {
    logger.log(
      'error',
      `Error deleting section: ${
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
      `${
        process.env.TESTRAIL_URL
      }index.php?/api/v2/get_case_types/${getProjectId(type)}`,
      getAxiosConfig(),
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
  getSuites,
  addSuite,
  updateSuite,
  deleteSuite,
  addSection,
  updateSection,
  getSections,
  addCase,
  updateCase,
  getTestCases,
  deleteTestCase,
  getProjectPrefix,
  getProjects,
  getProjectId,
};
