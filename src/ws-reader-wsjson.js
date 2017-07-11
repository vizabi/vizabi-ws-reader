import map from 'lodash/map';
import zipObject from 'lodash/zipObject';
import isObject from 'lodash/isObject';
import isNil from 'lodash/isNil';
import * as ReaderUtils from './reader-utils';

export const WsJsonReader = {
  _parse(wsJson, parsers) {
    return Promise.resolve(ReaderUtils.mapRows(this._uzip(wsJson), parsers));
  },

  _uzip(wsJson) {
    const rows = wsJson.rows;
    const headers = wsJson.headers;

    return map(rows, row => zipObject(headers, map(row, cell => {
      if (isObject(cell)) {
        return JSON.stringify(cell);
      }
      return isNil(cell) ? null : cell.toString();
    })));
  }
};
