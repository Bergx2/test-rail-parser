const pick = require('lodash/pick');
const get = require('lodash/get');
const logger = require('../utils/logger');
const { addResource } = require('./testrailHelper');

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

module.exports = {
  createSection,
};
