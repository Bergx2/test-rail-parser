const {extractCommentBlock, parseComments, addCase} = require("./testrailReportHelper");
const extractAndParseCommentBlock = (data) => {
  const { content, testName, section } = data;
  const commentBlock = extractCommentBlock(content, 'test_case');

  if (!commentBlock) {
    console.log(`TEST CASE FOR IT BLOCK '${testName}' NOT FOUND`);
    return null;
  }

  const extractedSections = parseComments(commentBlock);

  const preparedObject = {
    title: testName,
    template_id: 2,
    custom_steps_separated: extractedSections.steps,
    custom_preconds: extractedSections.custom_preconds,
    custom_expected: extractedSections.custom_expected,
    custom_execution_notes: extractedSections.custom_execution_notes,
    custom_automation_status: extractedSections.custom_automation_status,
    custom_severity: extractedSections.custom_severity,
    priority_id: extractedSections.priority_id,
    type_id: extractedSections.type_id,
    refs: extractedSections.refs
  };

  if (preparedObject) {
    console.log('START ADD CASE: ', preparedObject);
    return addCase(preparedObject, section.id);
  }
  return Promise.resolve(null);
}


module.exports = {
  extractAndParseCommentBlock
};
