/* eslint-disable */

import {VizabiPromise} from './vizabi-promise';
import {QueryEncoder} from './query-encoder';
import {Utils} from './utils';
import cloneDeep from 'lodash/cloneDeep';

var FILE_CACHED = {}; //caches files from this reader
var FILE_REQUESTED = {}; //caches files from this reader

export class WSReader {

  getReader() {

    const ERROR_NETWORK = 'Connection Problem';
    const ERROR_RESPONSE = 'Bad Response';
    const ERROR_ORDERING = 'Cannot sort response. Column does not exist in result.';
    const ERROR_PARAM_PATH = 'Missing base path for waffle reader';

    return {

      init(reader_info) {

        this._name = 'waffle';
        this._data = [];
        this._basepath = reader_info.path;
        this._parsers = reader_info.parsers;

        if (!this._basepath) {
          Utils.error(ERROR_PARAM_PATH);
        }

        // UPDATE
        // http://localhost:3000/api/graphs/stats/vizabi-tools"

        // *** /api/graphs/stats/vizabi-tools
        // *** /api/ddf/entities

        // *** /api/graphs/stats/vizabi-tools
        // *** /api/ddf/datapoints

        this._predefined_path = {
          'old_path':'/api/graphs/stats/vizabi-tools',
          'datapoints':'/api/ddf/datapoints',
          'entities':'/api/ddf/entities'
        };

        this._data = [];
      },

      read(query, language) {

        var p = new VizabiPromise();
        var path = this._basepath;

        // detect new path for new WS
        // path

        path += '?' + this._encodeQuery(query);

        this._data = [];

        //if cached, retrieve and parse
        if (FILE_CACHED.hasOwnProperty(path)) {
          this._parse(p, query, FILE_CACHED[path]);
          return p;
        }
        //if requested by another hook, wait for the response
        if (FILE_REQUESTED.hasOwnProperty(path)) {
          return FILE_REQUESTED[path];
        }
        //if not, request and parse
        FILE_REQUESTED[path] = p;

        Utils.getRequest(
          path,
          [],
          this._readCallbackSuccess.bind(this, p, path, query),
          this._readCallbackError.bind(this, p, path, query),
          true
        );

        return p;
      },

      getData() {
        return this._data;
      },







      _encodeQuery: function (params) {
        console.log("WSReader, params", params);
        var _params = cloneDeep({}, params.where);
        _params.select = params.select;
        _params.gapfilling = params.gapfilling;

        // todo: WS doesn't support value `*` for geo parameter
        // remove this condition when geo will be removed from params.where (when you need all geo props)
        if (_params.geo && _params.geo.length === 1 && _params.geo[0] === '*') {
          delete _params.geo;
        }

        var result = [];

        // create `key=value` pairs for url query string
        Object.keys(_params).map(function (key) {
          var value = QueryEncoder.encodeQuery(_params[key]);
          if (value) {
            result.push(key + '=' + value);
          }
        });

        var resultPath = result.join('&');
        console.log("WSReader, result", resultPath);
        return resultPath;
      },

      _readCallbackSuccess: function (p, path, query, resp) {

        if (!resp) {
          Utils.error("Empty json: " + path);
          p.reject({
            'message' : ERROR_RESPONSE,
            'data': path
          });
          return;
        }

        // unpack response
        // resp = resp;

        //format data
        resp = Utils.mapRows(this._uzip(resp.data || resp), this._parsers);

        //cache and resolve
        FILE_CACHED[path] = resp;

        this._parse(p, query, resp);
        FILE_REQUESTED[path] = void 0;
      },

      _readCallbackError: function (p, path, query, resp) {
        p.reject({
          'message' : ERROR_NETWORK,
          'data': path
        });
      },

      _uzip: function (table) {
        var header;
        var rows = table.rows;
        var headers = table.headers;
        var result = new Array(rows.length);
        // unwrap compact data into json collection
        for (var i = 0; i < rows.length; i++) {
          result[i] = {};
          for (var headerIndex = 0; headerIndex < headers.length; headerIndex++) {
            header = headers[headerIndex];
            result[i][header] = '';
            if (!(typeof rows[i][headerIndex] == 'undefined' || rows[i][headerIndex] === null)) {
              result[i][header] = rows[i][headerIndex].toString();
            }
            if (header === 'geo.cat') {
              result[i][header] = [result[i][header]];
            }
          }
        }
        return result;
      },

      _parse: function (p, query, resp) {
        var data = resp;
        // sorting
        // one column, one direction (ascending) for now
        if(query.orderBy && data[0]) {
          if (data[0][query.orderBy]) {
            data.sort(function(a, b) {
              return a[query.orderBy] - b[query.orderBy];
            });
          } else {
            return p.reject({
              'message' : ERROR_ORDERING,
              'data': query.orderBy
            });
          }
        }

        this._data = data;
        p.resolve();
      }      

    };
  }
}