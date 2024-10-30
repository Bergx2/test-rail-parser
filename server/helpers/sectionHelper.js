const pick = require('lodash/pick');
const get = require('lodash/get');
const map = require('lodash/map');
const flatMap = require('lodash/flatMap');
const logger = require('../utils/logger');
const { addResource, getResources } = require('./testrailHelper');

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

const getAllTestrailSections = async suites => {
  const resourcePromises = map(suites, suite =>
    getResources({
      id: suite.project_id,
      endpoint: 'get_sections',
      resourceData: { suite_id: suite.id },
    }),
  );

  const sections = await Promise.all(resourcePromises);
  return flatMap(sections, 'sections');
};

module.exports = {
  createSection,
  getAllTestrailSections,
};
