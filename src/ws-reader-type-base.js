/* eslint-disable */


import {QueryEncoder} from './query-encoder';
import {VizabiUtils} from './vizabi-utils';

const Promise = require("bluebird");

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

      // TEMP :: Fix for Vizabi
      const correctPath = '/api/ddf/ql';
      const oldPath = '/api/ddf';

      this._basepath = this._basepath.indexOf(correctPath) === -1 ?
        this._basepath.replace(oldPath, correctPath) :
        this._basepath;

      if (!this._basepath) {
        VizabiUtils.error(this.CONST.ERROR_PARAM_PATH);
      }

      this._data = [];
    },

    read(query, language) {
      var _this = this;
      return  new Promise(function (resolve, reject) {
        const path = _this._basepath + '?format=wsJson';
        _this._data = [];

        VizabiUtils.postRequest(
          path,
          query,
          _this._readCallbackSuccess.bind(_this, resolve, reject, path, query),
          _this._readCallbackError.bind(_this, resolve, reject, path, query),
          true
        );
      });
    },

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

    _readCallbackSuccess: function (resolve, reject, path, query, resp) {

      if(typeof resp == 'object') {
        return this._parseResponsePacked(resolve, reject, path, query, resp, this._readCallbackSuccessDone.bind(this));
      }

      VizabiUtils.error("Bad Response Format: " + path, resp);
      reject({
        'message' : this.CONST.ERROR_RESPONSE,
        'data': resp
      });
    },

    // SHOULD BE IMPLEMENTED IN CHILD CLASS
    _parseResponsePacked: function(resolve, reject, path, query, resp, done) {
      done(resolve, reject, path, query, resp);
    },

    _readCallbackSuccessDone: function(resolve, reject, path, query, resp) {
      this._parse(resolve, reject, query, resp);
    },

    _parse: function (resolve, reject, query, resp) {
      var data = resp;

      if(query.orderBy && data[0]) {
        if (data[0][query.orderBy]) {
          data.sort(function(a, b) {
            return a[query.orderBy] - b[query.orderBy];
          });
        } else {
          return reject({
            'message' : this.CONST.ERROR_ORDERING,
            'data': query.orderBy
          });
        }
      }

      this._data = data;
      resolve();
    },

    _readCallbackError: function (resolve, reject, path, query, resp) {
      reject({
        'message' : this.CONST.ERROR_NETWORK,
        'data': path
      });
    },

  };
}

module.exports = {WsReaderBase};
