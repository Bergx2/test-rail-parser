const includes = require('lodash/includes');
const forEach = require('lodash/forEach');
const trim = require('lodash/trim');
const find = require('lodash/find');
const startsWith = require('lodash/startsWith');
const replace = require('lodash/replace');
const split = require('lodash/split');
const get = require('lodash/get');
const logger = require('../utils/logger');

const keywords = [
  '@custom_is_common:',
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

const getCleanedTestCaseLine = line => trim(replace(trim(line), /^[\\*]+/, ''));
const getCurrentKeyOfLine = keyword => replace(keyword, /^@(\w+):.*/, '$1');

const parseTestCase = (commentBlock, title) => {
  const lines = split(commentBlock, '\n');
  const result = {
    custom_is_common: '',
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
  let currentStep = null;
  const stepKeys = ['step', 'expected'];

  forEach(lines, line => {
    if (trim(line) === '*/') {
      return null;
    }
    const cleanLine = getCleanedTestCaseLine(line);
    const keyword = find(keywords, kw => startsWith(cleanLine, kw));

    if (keyword) {
      currentKey = getCurrentKeyOfLine(keyword);
      const value = trim(cleanLine.slice(keyword.length));

      if (currentKey === 'step') {
        currentStep = { content: value, expected: null };
        return result.steps.push(currentStep);
      }
      if (currentKey === 'expected' && currentStep) {
        return (currentStep.expected = value);
      }

      return (result[currentKey] = value);
    }

    if (currentKey && cleanLine) {
      const value = `\n${trim(cleanLine)}`;

      if (includes(stepKeys, currentKey)) {
        return (currentStep[currentKey] += value);
      }

      return (result[currentKey] += value);
    }
    return null;
  });

  return {
    custom_preconds: get(result, 'custom_preconds', null),
    custom_expected: get(result, 'custom_expected', null),
    custom_execution_notes: get(result, 'custom_execution_notes', null),
    custom_severity: get(result, 'custom_severity', 1),
    custom_is_common:
      trim(get(result, 'custom_is_common', '')) === 'true' ? 'true' : null,
    priority_id: get(result, 'priority_id', 1),
    type_id: get(result, 'type_id', 1),
    refs: get(result, 'refs', null),
    custom_steps_separated: get(result, 'steps', null),
    template_id: 2,
    custom_id: null,
    title,
  };
};

const extractTestCase = (section, startTag) =>
  get(
    new RegExp(`/\\*[^]*?@${startTag}[^]*?\\*/`, 'gs').exec(section),
    '[0]',
    null,
  );

const getParsedTestCase = data => {
  const { content, testName } = data;
  const testCaseBlock = extractTestCase(content, 'test_case');

  if (!testCaseBlock) {
    logger.log('warn', `TEST CASE FOR IT BLOCK '${testName}' NOT FOUND`);
    return null;
  }

  return parseTestCase(testCaseBlock, testName);
};

module.exports = {
  extractTestCase,
  getParsedTestCase,
};
