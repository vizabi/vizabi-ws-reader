/* eslint-disable */

function queryEncoder() {

  return {
    encodeQuery: encodeQuery
  };

  function encodeQuery(param) {
    return mapParams()(param);
  }

  function mapParams(depth) {
    if (!depth) {
      return _map;
    }

    return _mapRange;
  }

  function _map(v, i) {
    // if falsy value
    if (!v) {
      return v;
    }

    // if value is string or number
    if (v.toString() === v || _isNumber(v)) {
      return v;
    }

    // if value is array
    if (Array.isArray(v)) {
      return v.map(mapParams(1)).join();
    }

    if (typeof v === 'object') {
      return _toArray(v).map(mapParams(1)).join();
    }

    return v;
  }

  function _mapRange(v) {
    return encodeURI(v).replace(/,/g, ':');
  }

  function _isNumber(value) {
    return parseInt(value, 10) == value;
  }

  function _toArray(object) {
    return Object.keys(object).map(function (key) {
      if (object[key] === true) {
        return [key];
      }

      return [key, object[key]];
    });
  }
}

let QueryEncoder = queryEncoder()
module.exports = {QueryEncoder};
