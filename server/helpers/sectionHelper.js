const pick = require('lodash/pick');
const map = require('lodash/map');
const get = require('lodash/get');
const find = require('lodash/find');
const flatMap = require('lodash/flatMap');
const reduce = require('lodash/reduce');
const filter = require('lodash/filter');
const flatten = require('lodash/flatten');
const logger = require('../utils/logger');
const { getProjectId, addResource, getResources } = require('./testrailHelper');

const createSection = async data => {
  logger.log('info', 'START ADD SECTION');

  const sectionData = {
    resourceData: data,
    endpoint: 'add_section',
    id: get(data, 'id'),
  };

  const section = await addResource(sectionData);

  logger.log(
    'info',
    `CREATED SECTION: ${JSON.stringify(
      pick(section, ['id', 'suite_id', 'name']),
    )}`,
  );

  return section;
};

const getRepoProjectSections = async data => {
  const { suiteIds, projectName } = data;
  const sectionPromises = map(suiteIds, suiteId =>
    getResources({
      id: getProjectId(projectName),
      resourceData: {
        suite_id: suiteId,
      },
      endpoint: 'get_sections',
    }),
  );
  const sectionsData = await Promise.all(sectionPromises);
  return flatMap(sectionsData, 'sections');
};

const isIncludedSuiteToProject = data => {
  const { suites, projectName } = data;
  const suite = find(get(suites, projectName), { id: get(data, 'suiteId') });
  return get(suite, 'project_id') === getProjectId(get(data, 'projectName'));
};

const getformattedProjectsSections = data =>
  reduce(
    get(data, 'projects'),
    (result, projectName) => {
      const relatedSections = filter(
        flatten(get(data, 'sections')),
        section => {
          return isIncludedSuiteToProject({
            suites: get(data, 'suites'),
            projectName,
            suiteId: section.suite_id,
          });
        },
      );

      result[projectName] = relatedSections;
      return result;
    },
    {},
  );

const getRepoProjectsSections = async data => {
  const { suites, projects } = data;
  const sectionPromises = map(projects, async project =>
    getRepoProjectSections({
      suiteIds: map(suites[project], 'id'),
      projectName: project,
    }),
  );

  const sections = await Promise.all(sectionPromises);
  return getformattedProjectsSections({ projects, sections, suites });
};

module.exports = {
  createSection,
  getRepoProjectsSections,
};
