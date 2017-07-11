import isArray from 'lodash/isArray';
import 'whatwg-fetch';

function logError(... message) {
  console.error(... message);
}

function mapRow(value, fmt) {
  if (!isArray(value)) {
    return fmt(value);
  }
  return value.map(current => mapRow(current, fmt));
}

function toErrorResponse({ message, data } = {}) {
  return {
    message,
    data,
    toString() {
      return this.message;
    }
  };
}

function mapRows(original, formatters) {
  // default formatter turns empty strings in null and converts numeric values into number
  const defaultFormatter = val => {
    let newVal = val;

    if (val === '') {
      newVal = null;
    } else {
      const numericVal = parseFloat(val);

      if (!isNaN(numericVal) && isFinite(val)) {
        newVal = numericVal;
      }
    }
    return newVal;
  };

  return original.map(row => {
    Object.keys(row).forEach(column => {
      row[column] = mapRow(row[column], formatters[column] || defaultFormatter);
    });

    return row;
  });
}

function ajax(options) {
  const { url = '', method = 'GET', json = false } = options;

  const headers = {};

  if (json) {
    headers['Content-Type'] = 'application/json; charset=UTF-8';
  }

  return fetch(url, { method, headers })
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
  logError,
  mapRows,
  ajax,
  toErrorResponse
};
