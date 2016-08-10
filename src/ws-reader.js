/* eslint-disable */

import {VizabiPromise} from './vizabi-promise';
import {QueryEncoder} from './query-encoder';
import {Utils} from './utils';
import {Unpack} from './unpack';
import cloneDeep from 'lodash/cloneDeep';
import isArray from 'lodash/isArray';

var FILE_CACHED = {}; //caches files from this reader
var FILE_REQUESTED = {}; //caches files from this reader

function getRandomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

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

        var encodedQuery = (typeof query.from != "undefined") ? this._encodeQueryDDFQL(query) : this._encodeQuery(query);
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

      /* private */

      _encodeQueryDDFQL: function(query) {

        /*

         // ?geo.cat=country,unstate&select=geo,geo.name,geo.world_4region
         // ?geo.is--country=1&key=geo&select=geo,name,world_4region

         query = {
          from: "entities",
          grouping: {
            geo: undefined,
            time: undefined
          },
          orderBy: null,
          key: [
            "geo",
            "time"
          ],
          select: {
            key: ["one", "two"],
            value: [
              "geo",
              "geo.name",
              "geo.world_4region"
            ]
          },
          where: {
            "geo.is--country": true
          }
        };

        */

        let resultObj = {};

        // parse WHERE

        if(typeof query.where != "undefined") {
          for (let whereKey in query.where) {
            if (query.where.hasOwnProperty(whereKey)) {
              let valueReady = typeof query.where[whereKey] == '' ? query.where[whereKey] : query.where[whereKey];
              resultObj[whereKey] = query.where[whereKey];
            }
          }
        }

        // parse SELECT

        if(typeof query.select != "undefined") {

          // parse SELECT values

          if(typeof query.select.value != "undefined") {
            let readySelect = [];
            query.select.value.forEach(function(item, index, arraySelect) {
              let selectParts = item.split(".");
              let ready = selectParts.length > 1 ? selectParts[1] : selectParts[0];
              readySelect.push(ready);
            });
            //resultObj["select"] = query.select.value.join(",");
            resultObj["select"] = readySelect.join(",");
          }

          // parse KEY

          if(typeof query.select.key != "undefined") {
            resultObj["key"] = query.key.join(",");
          }
        }

        // update path

        const pathOldKey = 'old_path';
        this._basepath = this._basepath
          .split(this._predefined_path[pathOldKey])
          .join(this._predefined_path[query.from]);

        // encode query

        let result = [];

        Object.keys(resultObj).map(function (key) {
          let value = QueryEncoder.encodeQuery(resultObj[key]);
          if (value) {
            result.push(key + '=' + value);
          }
        });

        return result.join('&');
      },

      _encodeQuery: function (query) {

        var params = cloneDeep(query);
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
          query.key = paramKey;
        }

        // END :: improvements


        _params.select = params.select;
        _params.gapfilling = params.gapfilling;

        // START :: test 3 type of Response Format

        // Checked :: Ok (array format)
        //_params.format = 'json';
        // Checked :: Ok (new format)
        //_params.format = 'ddfJson';
        // Checked :: Ok (old format)
        //_params.format = 'wsJson';
        //_params.force = true;

        // END :: test 3 type of Response Format

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

        if(this._isResponsePacked(resp)) {

          // convert with new strategy (Unpack module)
          this._parseResponsePacked(p, path, query, resp, this._readCallbackSuccessDone.bind(this));

        } else if (this._isResponseNotPacked(resp)) {

          // convert with old strategy (Uzip)
          this._parseResponseNotPacked(p, path, query, resp, this._readCallbackSuccessDone.bind(this));

        } else if (this._isResponseReadyArray(resp)) {

          // keep as is
          this._parseResponseArray(p, path, query, resp, this._readCallbackSuccessDone.bind(this));

        } else {

          Utils.error("Bad Response Format: " + path, resp);
          p.reject({
            'message' : ERROR_RESPONSE,
            'data': resp
          });
          return;
        }
      },

      // detect type of response

      _isResponsePacked: function(resp) {
        return typeof resp == 'object' && typeof resp.concepts != 'undefined' ? true : false;
      },
      _isResponseNotPacked: function(resp) {
        let readyResp = resp.data || resp;
        return typeof readyResp == 'object' && typeof readyResp.headers != 'undefined' ? true : false;
      },
      _isResponseReadyArray: function(resp) {
        return isArray(resp) && resp.length > 0 ? true : false;
      },

      // parse response with one of defined strategies

      _parseResponsePacked: function(p, path, query, resp, done) {

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

          if(path.indexOf('entities') > -1) {
            let prefixKey = query.key[0];
            unpackedJson.forEach(function(value, index){
              for(let keyEntity in value) {
                if (
                  keyEntity.indexOf("shape") == -1 &&
                  query.key.indexOf(keyEntity) == -1
                ) {
                  let currValue = value[keyEntity];
                  value[prefixKey + '.' + keyEntity] = currValue;
                  delete value[keyEntity];
                }
                if (keyEntity.indexOf("shape") > -1) {
                  let currValue = value[keyEntity];
                  value[keyEntity] = "<svg xmlns='http://www.w3.org/2000/svg' version='1.1' viewBox='0 0 584.5 364.5'><path id='" + value[prefixKey] + "' d='" + currValue + "'/></svg>";
                }
              }
            });
          }

          // clone partially uzip functionality

          unpackedJson.forEach(function(value){
            for(let objKey in value) {
              if(!(typeof value[objKey] == 'undefined' || value[objKey] === null)) {
                value[objKey] = value[objKey].toString();
              }
            }
          });

          let respReady = Utils.mapRows(unpackedJson, self._parsers);

          delete query.key;

          done(p, path, query, respReady);
        });
        // END :: improvements
      },

      _parseResponseNotPacked: function(p, path, query, resp, done) {

        let respReady = Utils.mapRows(this._uzip(resp.data || resp, query), this._parsers);

        /*
        if(path.indexOf('entities') > -1) {
          let prefixKey = query.key[0];
          respReady.forEach(function (value, index) {
            for (let keyEntity in value) {
              if (
                keyEntity.indexOf("shape") == -1 &&
                query.key.indexOf(keyEntity) == -1
              ) {
                let currValue = value[keyEntity];
                value[prefixKey + '.' + keyEntity] = currValue;
                delete value[keyEntity];
              }
              if (keyEntity.indexOf("shape") > -1) {
                let currValue = value[keyEntity] || 'M0,0 Z';
                value[keyEntity] = "<svg xmlns='http://www.w3.org/2000/svg' version='1.1' viewBox='0 0 584.5 364.5'><path id='" + value[prefixKey] + "' d='" + currValue + "'/></svg>";
              }
            }
          });
        }
        */

        done(p, path, query, respReady);
      },

      _parseResponseArray: function(p, path, query, resp, done) {

        if(path.indexOf('entities') > -1) {
          let prefixKey = query.key[0];
          resp.forEach(function (value, index) {
            for (let keyEntity in value) {
              if (
                keyEntity.indexOf("shape") == -1 &&
                query.key.indexOf(keyEntity) == -1
              ) {
                let currValue = value[keyEntity];
                value[prefixKey + '.' + keyEntity] = currValue;
                delete value[keyEntity];
              }
              if (keyEntity.indexOf("shape") > -1) {
                let currValue = value[keyEntity];
                value[keyEntity] = "<svg xmlns='http://www.w3.org/2000/svg' version='1.1' viewBox='0 0 584.5 364.5'><path id='" + value[prefixKey] + "' d='" + currValue + "'/></svg>";
              }
            }
          });
        }

        let respReady = Utils.mapRows(resp, this._parsers);

        // clone partially uzip functionality
        respReady.forEach(function(value){
          for(let objKey in value) {
            if(!(typeof value[objKey] == 'undefined' || value[objKey] === null)) {
              value[objKey] = value[objKey].toString();
            }
          }
        });

        done(p, path, query, respReady);
      },



      _readCallbackSuccessDone: function(p, path, query, resp) {
        //cache and resolve
        FILE_CACHED[path] = resp;
        this._parse(p, query, resp);
        FILE_REQUESTED[path] = void 0;
      },


      _parse: function (p, query, resp) {
        var data = resp;

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
      },

      _uzip: function (table, query) {
        var header;
        var rows = table.rows;
        var headers = table.headers;
        var result = new Array(rows.length);
        let isKeys = query.key || [];
        // unwrap compact data into json collection
        for (var i = 0; i < rows.length; i++) {
          result[i] = {};
          for (var headerIndex = 0; headerIndex < headers.length; headerIndex++) {
            header = headers[headerIndex];
            result[i][header] = '';
            if (!(typeof rows[i][headerIndex] == 'undefined' || rows[i][headerIndex] === null)) {
              result[i][header] = rows[i][headerIndex].toString();
            }
            /*
            if (isKeys.indexOf(header) !== -1) {
              result[i][header] = [result[i][header]];
            }
            */
          }
        }
        return result;
      },

      _readCallbackError: function (p, path, query, resp) {
        p.reject({
          'message' : ERROR_NETWORK,
          'data': path
        });
      }

    };
  }
}