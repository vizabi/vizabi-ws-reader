/* eslint-disable */

import {WsReaderBase} from './ws-reader-type-base';
import _map from 'lodash/map';
import _zipObject from 'lodash/zipObject';
import _isObject from 'lodash/isObject';
import _isNil from 'lodash/isNil';
import {VizabiUtils} from './vizabi-utils';

// Init Base Class
const WsReaderWsjson = WsReaderBase();

// Redefine Functionality

WsReaderWsjson._parseResponsePacked = function(resolve, reject, path, query, parsers, resp, done) {
  const respReady = VizabiUtils.mapRows(this._uzip(resp.data || resp), parsers);
  done(resolve, reject, path, query, respReady);
};

WsReaderWsjson._uzip = function (table) {
  const rows = table.rows;
  const headers = table.headers;
  return _map(rows, row => {
    return _zipObject(headers, _map(row, cell => {
      if(_isObject(cell)) {
        return JSON.stringify(cell);
      }
        return _isNil(cell) ? null : cell.toString();
    }));
  });
};

module.exports = {WsReaderWsjson};