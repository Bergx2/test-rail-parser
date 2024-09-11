const flatten = require("lodash/flatten");
const map = require("lodash/map");
const filter = require("lodash/filter");
const includes = require("lodash/includes");

const {
  extractCommentBlock,
  parseComments,
  addCase,
  getSuites,
  getTestCases,
  deleteSuite,
  deleteTestCase,
  TEST_CASE_TYPES,
  addSuite,
  addSection
} = require("./testrailReportHelper");
const isNull = require("lodash/isNull");


const getParsedObject = (data) => {
  const { content, testName } = data;
  const commentBlock = extractCommentBlock(content, 'test_case');

  if (!commentBlock) {
    console.log(`TEST CASE FOR IT BLOCK '${testName}' NOT FOUND`);
    return null;
  }

  const extractedSections = parseComments(commentBlock);

  return {
    title: testName,
    template_id: 2,
    custom_steps_separated: extractedSections.steps,
    custom_preconds: extractedSections.custom_preconds,
    custom_expected: extractedSections.custom_expected,
    custom_execution_notes: extractedSections.custom_execution_notes,
    custom_automation_status: extractedSections.custom_automation_status,
    custom_severity: extractedSections.custom_severity,
    custom_type: extractedSections.custom_type,
    priority_id: extractedSections.priority_id,
    type_id: extractedSections.type_id,
    refs: extractedSections.refs
  };
}

const extractAndParseCommentBlock = (data) => {
  const { section } = data;

  const testCase = getParsedObject(data);

  if (!testCase) {
    return Promise.resolve(null);
  }

  console.log('START ADD CASE: ', data);
  return addCase({
    testCase,
    sectionId: section.id
  });
}

// Method to delete test suites by type
const deleteTestSuitesByType = async (type) => {
  const testSuites = await getSuites({ type });
  const deleteSuitePromises = testSuites.map(suite => deleteSuite(suite.id));
  await Promise.all(deleteSuitePromises);
};

// Method to get all test cases by type
const getAllTestCasesByType = async (type) => {
  const testSuites = await getSuites({ type });
  const testCasePromises = map(testSuites, suite => getTestCases({ type, suiteId: suite.id }));
  const testCases = await Promise.all(testCasePromises);
  return flatten(testCases);
};

// Method to delete test cases based on type
const deleteTestCasesByType = async (testCases, types) => {
  const filteredTestCases = filter(testCases, testCase => includes(types, testCase.custom_type));

  const deleteTestCasePromises = map(filteredTestCases, testCase => deleteTestCase(testCase.id));
  await Promise.all(deleteTestCasePromises);
  return filteredTestCases;
};

// Method to delete orphaned test suites that only contain specific types of test cases
const deleteOrphanedNativeSuites = async (possibleDeletedTestSuiteIds, testSuiteIds) => {
  const deleteSuiteIds = filter(
    possibleDeletedTestSuiteIds,
    possibleDeletedTestSuiteId => !includes(testSuiteIds, possibleDeletedTestSuiteId)
  );

  const deleteOrphanedSuitePromises = map(flatten(deleteSuiteIds), suiteId => deleteSuite(suiteId));
  await Promise.all(deleteOrphanedSuitePromises);
};

// Main function to delete web test cases and related suites
const deleteWebTestCases = async () => {
  // Delete all web test suites
  await deleteTestSuitesByType('web');

  // Get all native test cases and suites
  const allNativeTestCases = await getAllTestCasesByType('native');

  // Delete common native test cases
  const deletedCommonTestCases = await deleteTestCasesByType(allNativeTestCases, [TEST_CASE_TYPES.common]);
  const possibleDeletedTestSuiteIds = map(deletedCommonTestCases, deletedCommonTestCase => deletedCommonTestCase.suite_id);

  const notCommonTestCases = filter(
    allNativeTestCases,
    nativeTestCase => nativeTestCase.custom_type !== TEST_CASE_TYPES.common
  );

  const notCommonTestSuiteIds = map(
    notCommonTestCases, notCommonTestCase => notCommonTestCase.suite_id);

  // Delete orphaned native test suites
  await deleteOrphanedNativeSuites(possibleDeletedTestSuiteIds, notCommonTestSuiteIds);
};

const deleteNativeTestCases = async () => {
  const allNativeTestCases = await getAllTestCasesByType('native');
  const deletedNativeTestCases = await deleteTestCasesByType(allNativeTestCases, [TEST_CASE_TYPES.native, null]);
  const possibleDeletedTestSuiteIds = map(deletedNativeTestCases, deletedNativeTestCase => deletedNativeTestCase.suite_id);

  const сommonTestCases = filter(
    allNativeTestCases,
    nativeTestCase => includes([TEST_CASE_TYPES.common], nativeTestCase.custom_type)
  );
  const commonTestSuiteIds = map(
    сommonTestCases, commonTestCase => commonTestCase.suite_id);

  await deleteOrphanedNativeSuites(possibleDeletedTestSuiteIds, commonTestSuiteIds);
}

const createCases = async (data) => {
  console.log('START ADD CASES');
  const { parsedTests, section } = data;
  const promises = map(parsedTests, async currentTest => addCase({
    testCase: currentTest,
    sectionId: section.id
  }));

  const cases = await Promise.all(promises);

  console.log('CREATED CASES: ', filter(cases, testCase => !isNull(testCase)));

  console.log('______________________________________________');
};

const createSuiteAndSection = async (data) => {
  const { testName, type } = data;
  console.log('START ADD SUITE');
  const suiteData = {
    suiteData: {
      name: testName
    },
    type
  };
  const suite = await addSuite(suiteData);

  console.log('CREATED SUITE: ', suite);

  console.log('START ADD SECTION');
  const sectionData = {
    sectionData: {
      name: testName
    },
    suiteId: suite.id,
    type
  };
  const section = await addSection(sectionData);

  console.log('CREATED SECTION: ', section);

  return {
    section,
    suite
  }
}


module.exports = {
  extractAndParseCommentBlock,
  getParsedObject,
  getAllTestCasesByType,
  deleteWebTestCases,
  deleteNativeTestCases,
  createCases,
  createSuiteAndSection
};
