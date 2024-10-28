const axios = require('axios');

axios.defaults.timeout = 30000;
axios.defaults.responseType = 'json';
axios.defaults.headers.common['Content-Type'] = 'application/json';
axios.defaults.withCredentials = false;

axios.interceptors.request.use(config => {
  config.baseURL = process.env.TESTRAIL_URL;

  config.auth = {
    username: process.env.TESTRAIL_USERNAME,
    password: process.env.TESTRAIL_API_KEY,
  };

  return config;
});

module.exports = axios;
