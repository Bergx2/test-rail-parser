/* eslint-disable @typescript-eslint/no-var-requires,import/no-extraneous-dependencies */

const axios = require('axios');
const map = require('lodash/map');
const forEach = require('lodash/forEach');
const trim = require('lodash/trim');
const find = require('lodash/find');
const startsWith = require('lodash/startsWith');
const replace = require('lodash/replace');
const split = require('lodash/split');
const isArray = require('lodash/isArray');

const TEST_CASE_TYPES = {
  common: 1,
  web: 2,
  native: 3,
};

const getAxiosConfig = () => ({
  headers: {
    'Content-Type': 'application/json',
  },
  auth: {
    username: process.env.TESTRAIL_USERNAME,
    password: process.env.TESTRAIL_API_KEY,
  }
})

const getProjectId = (type) => type === "native" ? process.env.TESTRAIL_NATIVE_PROJECT_ID : process.env.TESTRAIL_PROJECT_ID;

const addSection = async (data) => {
  const  { sectionData, suiteId, type } = data;
  try {
    const response = await axios.post(
      `${process.env.TESTRAIL_URL}index.php?/api/v2/add_section/${getProjectId(type)}`,
      { ...sectionData, suite_id: suiteId },
      getAxiosConfig(),
    );

    return response.data;
  } catch (error) {
    console.error(
      'Error creating section:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
};

const addCase = async (data) => {
  try {
    const { testCase, sectionId } = data;
    const response = await axios.post(
      `${process.env.TESTRAIL_URL}index.php?/api/v2/add_case/${sectionId}`,
      testCase,
      getAxiosConfig(),
    );

    return response.data;
  } catch (error) {
    console.error(
      'Error creating case:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
};

const getTestCases = async (data) => {
  try {
    const { sectionId, suiteId, type } = data;
    const baseUrl = `${process.env.TESTRAIL_URL}index.php?/api/v2/get_cases/${getProjectId(type)}`;
    const sectionUrlParam = `&section_id=${sectionId}`;
    const caseUrl = `${baseUrl}&suite_id=${suiteId}${sectionId ? sectionUrlParam : ''}`;
    const response = await axios.get(
      caseUrl,
      getAxiosConfig(),
    );

    return response.data.cases;
  } catch (error) {
    console.error(
      'Error fetching cases:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
};

const addSuite = async (data) => {
  const { suiteData, type } = data;
  try {
    const response = await axios.post(
      `${process.env.TESTRAIL_URL}index.php?/api/v2/add_suite/${getProjectId(type)}`,
      suiteData,
      getAxiosConfig(),
    );

    return response.data;
  } catch (error) {
    console.error(
      'Error creating suite:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
};

const getSuites = async (params) => {
  try {
    const { type } = params;
    const response = await axios.get(
      `${process.env.TESTRAIL_URL}index.php?/api/v2/get_suites/${getProjectId(type)}`,
      getAxiosConfig(),
    );

    return response.data;
  } catch (error) {
    console.error(
      'Error fetching suites:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
};

const getSections = async (params) => {
  try {
    const { suiteId, type } = params;
    const response = await axios.get(
      `${process.env.TESTRAIL_URL}index.php?/api/v2/get_sections/${getProjectId(type)}&suite_id=${suiteId}`,
      getAxiosConfig(),
    );

    return response.data.sections;
  } catch (error) {
    console.error(
      'Error fetching sections:',
      error.response ? error.response.data : error.message,
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
    console.error(
      'Error deleting section:',
      error.response ? error.response.data : error.message,
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
    console.error(
      'Error deleting section:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
};

const formatSteps = parsedData => {
  const steps = parsedData.step || [];
  const expected = parsedData.expected || [];

  return map(steps, (step, index) => ({
    content: step,
    expected: expected[index] || '',
  }));
};

const numberKeywords = ['@priority_id:', '@type_id:'];

const keywords = [
  '@custom_type:',
  '@custom_preconds:',
  '@custom_expected:',
  '@step:',
  '@expected:',
  '@custom_execution_notes:',
  '@custom_automation_status:',
  '@custom_severity:',
  '@priority_id:',
  '@type_id:',
  '@refs:',
];

const parseComments = commentBlock => {
  // Split the comment into lines
  const lines = split(commentBlock, '\n');
  const result = {
    custom_type: '',
    custom_preconds: '',
    custom_expected: '',
    custom_execution_notes: '',
    custom_automation_status: '',
    custom_severity: 1,
    priority_id: 1,
    type_id: 1,
    refs: '',
    steps: [],
  };
  let currentKey = null;

  forEach(lines, line => {
    // Clean the line
    const cleanLine = trim(replace(trim(line), /^[\\*]+/, ''));
    // Check if the line starts with any keyword
    const keyword = find(keywords, kw => startsWith(cleanLine, kw));
    const numberKeyword = find(numberKeywords, kw => startsWith(cleanLine, kw));

    if (keyword) {
      currentKey = keyword.slice(1, -1); // Remove "@" and ":" for the key
      if (!result[currentKey]) {
        result[currentKey] = [];
      }

      if (isArray(result[currentKey])) {
        return result[currentKey].push(trim(cleanLine.slice(keyword.length)));
      }
      return (result[currentKey] = trim(cleanLine.slice(keyword.length)));
    }

    if (currentKey && cleanLine && !numberKeyword) {
      // If it's a continuation of the previous key
      result[currentKey][result[currentKey].length - 1] += replace(
        `\n${cleanLine}`,
        /(\*\/|\/)$/g,
        '',
      );
    }
    return null;
  });

  return {
    custom_preconds: result.custom_preconds ? result.custom_preconds[0] : null,
    custom_expected: result.custom_expected ? result.custom_expected[0] : null,
    custom_execution_notes: result.custom_execution_notes[0] || null,
    custom_severity: result.custom_severity || 1,
    custom_type: result.custom_type ? TEST_CASE_TYPES[result.custom_type[0]] : null,
    priority_id: result.priority_id || 1,
    type_id: result.type_id || 1,
    refs: result.refs ? result.refs[0] : null,
    steps: formatSteps(result) || null
  };
};

const extractCommentBlock = (section, startTag) => {
  const startRegex = new RegExp(`/\\*[^]*?@${startTag}[^]*?\\*/`, 'gs');
  const match = section.match(startRegex);
  if (match) {
    return match[0];
  }
  return null;
};

module.exports = {
  addSuite,
  addSection,
  addCase,
  getSuites,
  getTestCases,
  getSections,
  deleteSuite,
  parseComments,
  extractCommentBlock,
  deleteTestCase,
  TEST_CASE_TYPES,
};
