/* eslint-disable */

import {VizabiPromise} from './vizabi-promise';
import {QueryEncoder} from './query-encoder';
import {Utils} from './utils';
import {Unpack} from './unpack';
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

        // START :: improvements

        // encode query and check path
        var encodedQuery = this._encodeQuery(query);
        var path = this._basepath + '?' + encodedQuery;

        // END :: improvements

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

        var _params = cloneDeep(params.where);

        // START :: improvements

        // 1. detect additional where parameters

        if(params.where) {
          for(let whereKey in params.where) {
            if(whereKey.indexOf(".") != -1) {
              let whereKeyPart = whereKey.split(".");
              let whereKeyPrefix = whereKeyPart[0];
              let whereDataLength = params.where[whereKey].length;
              for(let whereKeyIndex = 0; whereKeyIndex < whereDataLength; whereKeyIndex++) {
                if(params.where[whereKey][whereKeyIndex] != 'unstate') {
                  let generatedKey = whereKeyPrefix + '.is--' + params.where[whereKey][whereKeyIndex];
                  _params[generatedKey] = 1;
                }
              }
              delete _params[whereKey];
            }
          }
        }

        // 2. detect destination

        let pathOldKey = 'old_path';
        let pathKey = 'datapoints';
        if(params.select) {
          let selectLength = params.select.length;
          for(let selectIndex = 0; selectIndex < selectLength; selectIndex++) {
            if(params.select[selectIndex].indexOf(".") != -1) {
              pathKey = 'entities';
              break;
            }
          }
        }

        // 3. update path with new one

        this._basepath = this._basepath
          .split(this._predefined_path[pathOldKey])
          .join(this._predefined_path[pathKey]);

        // 4. update select statement

        let paramKey = [];
        if(params.select) {
          let paramSelectNew = [];
          let selectLength = params.select.length;
          for(let selectIndex = 0; selectIndex < selectLength; selectIndex++) {
            if(params.select[selectIndex].indexOf(".") != -1) {
              let selectKeyPart = params.select[selectIndex].split(".");
              let selectKeyPrefix = selectKeyPart[0];
              let selectKeyCleared = selectKeyPart[1];
              // store select prefix into param Key
              if(paramKey.indexOf(selectKeyPrefix) == -1) {
                paramKey.push(selectKeyPrefix);
              }
              // update select statement
              paramSelectNew.push(selectKeyCleared);
              //params.select.splice(selectIndex, 1);
            } else {
              paramSelectNew.push(params.select[selectIndex]);
            }
          }
          params.select = paramSelectNew;

          // update parameter Key for DataPoints request
          if(pathKey == 'datapoints') {
            Array.prototype.push.apply(paramKey, paramSelectNew.slice(0, 2));
          }
        }

        // 5. add Key parameter

        if(paramKey.length) {
          _params.key = paramKey;
        }

        // END :: improvements

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

        return result.join('&');
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

        // START :: improvements

        let self = this;

        Unpack(resp, function (err, unpackedJson) {

          if(err) {
            Utils.error("Unpack error: ", err);
            p.reject({
              'message' : 'Unpack error',
              'data': err
            });
            return;
          }

          resp = Utils.mapRows(unpackedJson, self._parsers);

          //cache and resolve
          FILE_CACHED[path] = resp;

          self._parse(p, query, resp);
          FILE_REQUESTED[path] = void 0;
        });

        // END :: improvements
      },

      _readCallbackError: function (p, path, query, resp) {
        p.reject({
          'message' : ERROR_NETWORK,
          'data': path
        });
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