/* eslint-disable */

import isArray from 'lodash/isArray';
import forEach from 'lodash/forEach';

// from Vizabi Lib ...

function utils() {
  return {
    error,
    mapRows,
    getRequest,
    postRequest,
    ajax
  };

  function error(message) {
    message = Array.prototype.slice.call(arguments).join(' ');
    if (console && typeof console.error === 'function') {
      console.error(message);
    }
  }

  function mapRows(original, formatters) {
    function mapRow(value, fmt) {
      if (!isArray(value)) {
        return fmt(value);
      } else {
        var res = [];
        for (var i = 0; i < value.length; i++) {
          res[i] = mapRow(value[i], fmt);
        }
        return res;
      }
    }

    // default formatter turns empty strings in null and converts numeric values into number
    //TODO: default formatter is moved to utils. need to return it to hook prototype class, but retest #1212 #1230 #1253
    var defaultFormatter = function (val) {
      var newVal = val;
      if (val === '') {
        newVal = null;
      } else {
        // check for numberic
        var numericVal = parseFloat(val);
        if (!isNaN(numericVal) && isFinite(val)) {
          newVal = numericVal;
        }
      }
      return newVal;
    };

    original = original.map(function (row) {
      var columns = Object.keys(row);

      for (var i = 0; i < columns.length; i++) {
        var col = columns[i];
        row[col] = mapRow(row[col], formatters[col] || defaultFormatter);
      }
      return row;
    });

    return original;
  }

  function getRequest(url, pars, success, error, json) {
    pars = pars || [];

    forEach(pars, function (value, key) {
      pars.push(key + '=' + value);
    });

    url += url.indexOf("?") == -1 ? '?' : '';
    url += pars.length > 0 ? '&' + pars.join('&') : '';

    ajax({
      method: 'GET',
      url,
      success,
      error,
      json
    });
  }

  function postRequest(url, query, success, error, json) {
    query = query || {};
    const data = JSON.stringify(query);

    ajax({
      method: 'POST',
      url,
      success,
      error,
      json,
      data
    });
  }

  /* private */

  function ajax (options) {
    var request = new XMLHttpRequest();
    request.open(options.method, options.url, true);
    if (options.method === 'POST' && !options.json) {
      request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
    } else if (options.method === 'POST' && options.json) {
      request.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
    }
    request.onload = function () {
      if (request.status >= 200 && request.status < 400) {
        // Success!
        var data = options.json ? JSON.parse(request.responseText) : request.responseText;
        if (options.success) {
          options.success(data);
        }
      } else {
        if (options.error) {
          options.error();
        }
      }
    };
    request.onerror = function () {
      if (options.error) {
        options.error();
      }
    };
    request.send(options.data);
  };
}

let VizabiUtils = new utils();
module.exports = {VizabiUtils};
