const includes = require('lodash/includes');
const trim = require('lodash/trim');
const reduce = require('lodash/reduce');
const replace = require('lodash/replace');
const last = require('lodash/last');
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

const getDefaultResult = data => ({
  custom_is_common: null,
  custom_preconds: '',
  custom_expected: '',
  custom_execution_notes: '',
  custom_automation_status: '',
  custom_severity: 1,
  priority_id: 1,
  type_id: 1,
  refs: '',
  custom_steps_separated: [],
  template_id: 2,
  custom_id: null,
  ...data,
});

const parseTestCase = commentBlock => {
  const regex = new RegExp(
    `(${keywords.join('|')})\\s*(.*?)(?=${keywords.join('|')}|$)`,
    'gs',
  );
  const result = [];

  let match = regex.exec(commentBlock); // Get the first match

  while (match) {
    result.push({
      key: replace(trim(match[1]), /^@|:$/g, ''),
      value: trim(match[2]),
    });
    match = regex.exec(commentBlock); // Get the next match
  }

  return result;
};

const prepareParseTestCase = (parsedTestCase, defaultData) =>
  reduce(
    parsedTestCase,
    (acc, { key, value }) => {
      if (key === 'step') {
        acc.custom_steps_separated = acc.custom_steps_separated || [];
        acc.custom_steps_separated.push({ content: value });
      } else if (key === 'expected' && acc.custom_steps_separated) {
        const lastStep = last(acc.custom_steps_separated);
        if (lastStep) {
          lastStep.expected = value;
        }
      }

      if (!includes(['step', 'expected'], key)) {
        acc[key] = value;
      }

      return acc;
    },
    { ...getDefaultResult(defaultData) },
  );

// remove leading asterisks and any whitespace after them
const removeEmptyLines = testCaseBlock => {
  const regex = /^\s*\*\s*/gm;
  const clearedTestCaseBlock = replace(testCaseBlock, regex, '');
  return replace(trim(clearedTestCaseBlock), regex, '');
};

const getParsedTest = data => {
  const { content, testName, custom_status } = data;
  let testCaseBlock = new RegExp('@test_case([\\s\\S]*?)\\*/', 'gs').exec(
    content,
  );

  if (!testCaseBlock) {
    logger.log('warn', `TEST CASE FOR IT BLOCK '${testName}' NOT FOUND`);
    return null;
  }

  testCaseBlock = removeEmptyLines(testCaseBlock[1]);

  const parsedTestCase = parseTestCase(testCaseBlock);
  return prepareParseTestCase(parsedTestCase, {
    title: testName,
    custom_status,
  });
};

module.exports = {
  getParsedTest,
};
