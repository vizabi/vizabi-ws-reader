import isArray from 'lodash/isArray';
import identity from 'lodash/identity';
import 'whatwg-fetch';

function mapRow(value, fmt = identity) {
  if (!isArray(value)) {
    return fmt(value);
  }
  return value.map(current => mapRow(current, fmt));
}

function mapRows(original, formatters = {}) {
  return original.map(row => {
    Object.keys(row).forEach(column => {
      row[column] = mapRow(row[column], formatters[column]);
    });

    return row;
  });
}

function ajax(options = {}) {
  const { url = '', json = false } = options;

  const headers = {};

  if (json) {
    headers['Content-Type'] = 'application/json; charset=UTF-8';
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

export {
  mapRows,
  ajax
};
