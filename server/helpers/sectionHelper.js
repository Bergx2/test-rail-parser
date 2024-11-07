const pick = require('lodash/pick');
const get = require('lodash/get');
const map = require('lodash/map');
const reduce = require('lodash/reduce');
const assign = require('lodash/assign');
const concat = require('lodash/concat');
const { addResource, getResources } = require('./testrailHelper');
const { formateObjectsByKey } = require('./baseHelper');
const logger = require('../utils/logger');

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

const getAllTestrailSections = async suites =>
  reduce(
    suites,
    async (accPromise, projectSuites, project) => {
      const acc = await accPromise;
      const sections = await Promise.all(
        map(projectSuites, async projectSuite =>
          getResources({
            id: projectSuite.project_id,
            endpoint: 'get_sections',
            resourceData: { suite_id: projectSuite.id },
          }),
        ),
      );
      return assign({}, acc, {
        [project]: formateObjectsByKey(
          concat([], ...map(sections, 'sections')),
          'name',
        ),
      });
    },
    Promise.resolve({}),
  );

module.exports = {
  createSection,
  getAllTestrailSections,
};
