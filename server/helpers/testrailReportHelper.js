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
const flatten = require('lodash/flatten');

const getAxiosConfig = () => ({
  headers: {
    'Content-Type': 'application/json',
  },
  auth: {
    username: process.env.TESTRAIL_USERNAME,
    password: process.env.TESTRAIL_API_KEY,
  }
})

const addSection = async (sectionData, suiteId) => {
  try {
    const response = await axios.post(
      `${process.env.TESTRAIL_URL}index.php?/api/v2/add_section/${process.env.TESTRAIL_PROJECT_ID}`,
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

const addCase = async (testCase, sectionId) => {
  try {
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

const getCasesBySectionId = async (sectionId, suiteId) => {
  try {
    // Fetch all sections in the project
    const response = await axios.get(
      `${process.env.TESTRAIL_URL}index.php?/api/v2/get_cases/${process.env.TESTRAIL_PROJECT_ID}&suite_id=${suiteId}&section_id=${sectionId}`,
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

const addSuite = async data => {
  try {
    const response = await axios.post(
      `${process.env.TESTRAIL_URL}index.php?/api/v2/add_suite/${process.env.TESTRAIL_PROJECT_ID}`,
      data,
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

const getSuites = async () => {
  try {
    const response = await axios.get(
      `${process.env.TESTRAIL_URL}index.php?/api/v2/get_suites/${process.env.TESTRAIL_PROJECT_ID}`,
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

const deleteSuite = async suiteId => {
  try {
    return axios.post(
      `${process.env.TESTRAIL_URL}index.php?/api/v2/delete_suite/${suiteId}`,
      { soft: 0 },
      getAxiosConfig(),
    );
  } catch (error) {
    console.error(
      'Error deleting suite:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
};

const deleteAllSuites = async () => {
  try {
    const suites = await getSuites();
    return Promise.all(map(suites, suite => deleteSuite(suite.id)));
  } catch (error) {
    console.error(
      'Error deleting all suites:',
      error.response ? error.response.data : error.message,
    );
    throw error;
  }
};

const getSections = async suiteId => {
  try {
    const response = await axios.get(
      `${process.env.TESTRAIL_URL}index.php?/api/v2/get_sections/${process.env.TESTRAIL_PROJECT_ID}&suite_id=${suiteId}`,
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

const deleteSection = async sectionId => {
  try {
    return axios.post(
      `${process.env.TESTRAIL_URL}index.php?/api/v2/delete_section/${sectionId}`,
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

const deleteAllSections = async () => {
  try {
    const suites = await getSuites();
    const sectionsPromises = map(suites, suite => getSections(suite.id));
    const sections = flatten(await Promise.all(sectionsPromises));

    return map(sections, async section => {
      await deleteSection(section.id);
    });
  } catch (error) {
    console.error(
      'Error deleting all sections:',
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
    priority_id: result.priority_id || 1,
    type_id: result.type_id || 1,
    refs: result.refs ? result.refs[0] : null,
    steps: formatSteps(result) || null,
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
  getCasesBySectionId,
  getSections,
  deleteSection,
  deleteAllSections,
  deleteSuite,
  deleteAllSuites,
  parseComments,
  extractCommentBlock,
};
