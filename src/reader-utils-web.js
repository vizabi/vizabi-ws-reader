import 'whatwg-fetch';

import { WsError, NETWORK_RESPONSE_ERROR, UNEXPECTED_ERROR } from './ws-error';

function ajax(options = {}) {
  const { url = '', json = false } = options;

  const headers = {};

  if (json) {
    headers['Content-Type'] = 'text/plain; charset=UTF-8';
  }

  return fetch(url, { method: 'GET', headers })
    .then(response => {
      if (!response.ok) {
        throw new WsError(NETWORK_RESPONSE_ERROR, response.statusText);
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
      if (error instanceof WsError) {
        throw error;
      } else {
        throw new WsError(UNEXPECTED_ERROR, error);
      }
    });
}

export { ajax };
