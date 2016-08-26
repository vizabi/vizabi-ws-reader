/* eslint-disable */

import {VizabiPromise} from './vizabi-promise';
import {QueryEncoder} from './query-encoder';
import {VizabiUtils} from './vizabi-utils';
import * as _ from 'lodash';

const FILE_CACHED = {}; //caches files from this reader
const FILE_REQUESTED = {}; //caches files from this reader

function WsReaderBase () {

  return {

    init(reader_info) {

      this.CONST = {
        ERROR_NETWORK: 'Connection Problem',
        ERROR_RESPONSE: 'Bad Response',
        ERROR_ORDERING: 'Cannot sort response. Column does not exist in result.',
        ERROR_PARAM_PATH: 'Missing base path for waffle reader'
      };

      this._name = 'waffle';
      this._data = [];
      this._basepath = reader_info.path;
      this._parsers = reader_info.parsers;

      if (!this._basepath) {
        VizabiUtils.error(this.CONST.ERROR_PARAM_PATH);
      }

      this._data = [];
    },

    // /api/ddf/ql

    read(query, language) {

      const path = this._basepath + '?format=wsJson';

      const vPromise = new VizabiPromise();
      this._data = [];

      //if cached, retrieve and parse
      if (FILE_CACHED.hasOwnProperty(path)) {
        this._parse(vPromise, query, FILE_CACHED[path]);
        return vPromise;
      }
      //if requested by another hook, wait for the response
      if (FILE_REQUESTED.hasOwnProperty(path)) {
        return FILE_REQUESTED[path];
      }
      //if not, request and parse
      FILE_REQUESTED[path] = vPromise;

      VizabiUtils.postRequest(
        path,
        query,
        this._readCallbackSuccess.bind(this, vPromise, path, query),
        this._readCallbackError.bind(this, vPromise, path, query),
        true
      );

      return vPromise;
    },

    /*
      @deprecated

    read(query, language) {

      const vPromise = new VizabiPromise();

      let encodedQuery = this._encodeQueryDDFQL(query);
      encodedQuery = this._encodeQueryDDFQLHook(encodedQuery);

      const path = this._basepath + '?' + encodedQuery;

      this._data = [];

      //if cached, retrieve and parse
      if (FILE_CACHED.hasOwnProperty(path)) {
        this._parse(vPromise, query, FILE_CACHED[path]);
        return vPromise;
      }
      //if requested by another hook, wait for the response
      if (FILE_REQUESTED.hasOwnProperty(path)) {
        return FILE_REQUESTED[path];
      }
      //if not, request and parse
      FILE_REQUESTED[path] = vPromise;

      VizabiUtils.getRequest(
        path,
        [],
        this._readCallbackSuccess.bind(this, vPromise, path, query),
        this._readCallbackError.bind(this, vPromise, path, query),
        true
      );

      return vPromise;
    },
    */

    getData() {
      return this._data;
    },

    /* private */

    _encodeQueryDDFQLHook: function(encodedQuery) {
      return encodedQuery;
    },

    _encodeQueryDDFQL: function(query) {

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
          resultObj["select"] = readySelect.join(",");
        }

        // parse KEY

        if(typeof query.select.key != "undefined") {
          resultObj["key"] = query.select.key.join(",");
        }
      }

      // update path

      this._basepath += query.from;

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

    _readCallbackSuccess: function (vPromise, path, query, resp) {

      if(typeof resp == 'object') {
        return this._parseResponsePacked(vPromise, path, query, resp, this._readCallbackSuccessDone.bind(this));
      }

      VizabiUtils.error("Bad Response Format: " + path, resp);
      vPromise.reject({
        'message' : this.CONST.ERROR_RESPONSE,
        'data': resp
      });
    },

    // SHOULD BE IMPLEMENTED IN CHILD CLASS
    _parseResponsePacked: function(vPromise, path, query, resp, done) {
      done(vPromise, path, query, resp);
    },

    _readCallbackSuccessDone: function(vPromise, path, query, resp) {
      //cache and resolve
      this._addShapes(path, query, resp);
      FILE_CACHED[path] = resp;
      this._parse(vPromise, query, resp);
      FILE_REQUESTED[path] = void 0;
    },

    _parse: function (vPromise, query, resp) {
      var data = resp;

      if(query.orderBy && data[0]) {
        if (data[0][query.orderBy]) {
          data.sort(function(a, b) {
            return a[query.orderBy] - b[query.orderBy];
          });
        } else {
          return vPromise.reject({
            'message' : this.CONST.ERROR_ORDERING,
            'data': query.orderBy
          });
        }
      }

      this._data = data;
      vPromise.resolve();
    },

    _readCallbackError: function (vPromise, path, query, resp) {
      vPromise.reject({
        'message' : this.CONST.ERROR_NETWORK,
        'data': path
      });
    },

    _addShapes: function(path, query, respReady) {
      if(path.indexOf('entities') > -1) {
        let keyHolder = query.key ? query.key : query.select.key;
        let prefixKey = keyHolder[0];
        _.map(respReady, row => {
          for(let keyEntity in row) {
            if (keyEntity.indexOf("shape") > -1) {
              let currValue = row[keyEntity];
              row[keyEntity] = "<svg xmlns='http://www.w3.org/2000/svg' version='1.1' viewBox='0 0 584.5 364.5'><path id='" + row[prefixKey] + "' d='" + currValue + "'/></svg>";
            }
          }
        });
      }
    }

  };
}

module.exports = {WsReaderBase};
