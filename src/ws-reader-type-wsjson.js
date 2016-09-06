/* eslint-disable */

import {WsReaderBase} from './ws-reader-type-base';
import * as _ from 'lodash';
import {VizabiUtils} from './vizabi-utils';

// Init Base Class
const WsReaderWsjson = WsReaderBase();

// Redefine Functionality
WsReaderWsjson._encodeQueryDDFQLHook = function (encodedQuery) {
  encodedQuery += '&format=wsJson';
  return encodedQuery;
};

WsReaderWsjson._parseResponsePacked = function(resolve, reject, path, query, resp, done) {
  const respReady = VizabiUtils.mapRows(this._uzip(resp.data || resp), this._parsers);
  done(resolve, reject, path, query, respReady);
};

WsReaderWsjson._uzip = function (table) {
  const rows = table.rows;
  const headers = table.headers;
  return _.map(rows, row => {
    return _.zipObject(headers, _.map(row, cell => {
      if(_.isObject(cell)) {
        return JSON.stringify(cell);
      }
      return !_.isNil(cell) ? cell.toString() : null;
    }));
  });
};

module.exports = {WsReaderWsjson};