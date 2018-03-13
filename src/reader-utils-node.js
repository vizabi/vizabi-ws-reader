const fetch = require('node-fetch-polyfill');

function ajax(options = {}) {
  const { url = '', json = false } = options;

  const headers = {};

  if (json) {
    headers['Content-Type'] = 'text/plain; charset=UTF-8';
  }

  return fetch(url, { method: 'GET', headers })
    .then(response => {
      if (!response.ok) {
        throw Error(response.statusText);
      }
      return response;
    })
    .then(response => {
      if (json) {
        return response.json();
      }
      return response.text();
    });
}

export { ajax };
