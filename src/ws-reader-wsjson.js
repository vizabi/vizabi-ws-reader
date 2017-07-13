import map from 'lodash/map';
import zipObject from 'lodash/zipObject';
import isObject from 'lodash/isObject';
import isNil from 'lodash/isNil';

export const WsJsonReader = {
  _toPojo(wsJson) {
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
