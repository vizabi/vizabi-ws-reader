import map from 'lodash/map';
import zipObject from 'lodash/zipObject';
import isNil from 'lodash/isNil';

export const WsJsonReader = {
  _toPojo(wsJson) {
    const rows = wsJson.rows;
    const headers = wsJson.headers;

    return map(rows, row => zipObject(headers, map(row, cell => {
      return isNil(cell) ? null : cell;
    })));
  }
};
