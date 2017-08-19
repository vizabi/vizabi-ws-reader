import isArray from 'lodash/isArray';
import 'whatwg-fetch';

function mapRows(original, formatters = {}) {
  return original.map(row => {
    Object.keys(row).forEach(column => {
      row[column] = mapRow(row[column], formatters[column]);
    });

    return row;
  });
}

function mapRow(value, fmt = parseByDefault) {
  if (!isArray(value)) {
    return fmt(value);
  }
  return value.map(current => mapRow(current, fmt));
}

function parseByDefault(value) {
  if (value === '' || value === null) {
    return null;
  }
  if (!value.trim) {
    return value;
  }
  if (value.trim().match(/^[0-9.,]+$/) == null) {
    return value;
  }

  const parsedValue = parseFloat(value);

  return isNaN(parsedValue) || !isFinite(parsedValue) ? value : parsedValue;
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
