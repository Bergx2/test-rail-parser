const map = require('lodash/map');
const { createSection } = require('./sectionHelper');
const { createSuite } = require('./suiteHelper');
const { getProjectId } = require('./testrailHelper');

const createSuitesSections = data => {
  const { projectName, suiteNames } = data;
  const suiteSectionPromises = map(suiteNames, suiteName =>
    createSuiteAndSection({
      id: getProjectId(projectName),
      name: suiteName,
    }),
  );

  return Promise.all(suiteSectionPromises);
};

const createSuiteAndSection = async data => {
  const suite = await createSuite(data);

  const section = await createSection({
    ...data,
    suite_id: suite.id,
  });

  return {
    section,
    suite,
  };
};

module.exports = {
  createSuiteAndSection,
  createSuitesSections,
};
