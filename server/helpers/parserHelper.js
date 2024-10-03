const map = require('lodash/map');
const forEach = require('lodash/forEach');
const trim = require('lodash/trim');
const find = require('lodash/find');
const startsWith = require('lodash/startsWith');
const replace = require('lodash/replace');
const split = require('lodash/split');
const isArray = require('lodash/isArray');
const indexOf = require("lodash/indexOf");
const slice = require("lodash/slice");
const join = require("lodash/join");
const {
  TEST_CASE_TYPES
} = require("./testrailReportHelper");

const extractIdAndTitle = (title) => {

// Find the positions of 'id:' and 'title:'
  const idIndex = indexOf(title, 'uuid:');
  const titleIndex = indexOf(title,'title:');
  const endOfIdKeyPosition = 3;
  const endOfTitleKeyPosition = 6;

// Extract the values by slicing the string
  const idValue = trim(replace(join(slice(title, idIndex + endOfIdKeyPosition, titleIndex), ''), ';', ''));
  const titleValue = trim(join(slice(title, titleIndex + endOfTitleKeyPosition), ''));

// Create the object
  const result = {
    uuid: idValue,
    title: titleValue,
  };

  return result;
}

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

  let preparedCustomType = null;

  if (result.custom_type) {
    const formatedCustomType = replace(result.custom_type[0], /(\r\n|\n|\r)/gm, "");
    preparedCustomType = TEST_CASE_TYPES[formatedCustomType]
  }

  return {
    custom_preconds: result.custom_preconds ? result.custom_preconds[0] : null,
    custom_expected: result.custom_expected ? result.custom_expected[0] : null,
    custom_execution_notes: result.custom_execution_notes[0] || null,
    custom_severity: result.custom_severity || 1,
    custom_type: preparedCustomType,
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
  parseComments,
  extractCommentBlock,
  extractIdAndTitle
};
