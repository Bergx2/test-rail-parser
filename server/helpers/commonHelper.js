const map = require('lodash/map');
const { createSection } = require('./sectionHelper');
const { createSuite } = require('./suiteHelper');
const { getProjectId } = require('./testrailHelper');

// in the future, we will detect not needed suites and remove them
const removeAndCreateSuiteSections = data => {
  const { projectName, repoProjectSuiteNames } = data;

  const suiteSectionPromises = map(
    repoProjectSuiteNames,
    createRepoProjectSuiteName =>
      createSuiteAndSection({
        id: getProjectId(projectName),
        name: createRepoProjectSuiteName,
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
  removeAndCreateSuiteSections,
};
