const fetch = require('node-fetch-polyfill');

import { WsError, WS_RESPONSE_ERROR, NETWORK_ERROR } from './ws-error';

const SERVER_ERROR_STATUS = 500;

function ajax(options = {}) {
  const { url = '', json = false } = options;

  const headers = {};

  if (json) {
    headers['Content-Type'] = 'text/plain; charset=UTF-8';
  }

  return fetch(url, { method: 'GET', headers })
    .then(response => {
      if (!response.ok) {
        throw new WsError(WS_RESPONSE_ERROR, response.error);
      }

      return response;
    })
    .then(response => {
      if (json) {
        return response.json();
      }
      return response.text();
    })
    .catch(error => {
      if (error.name === 'WaffleServerError') {
        throw error;
      } else {
        const status = error.response ? error.response.status : SERVER_ERROR_STATUS;

        throw new WsError(`${NETWORK_ERROR} with status code ${status}`, error);
      }
    });
}

export { ajax };
