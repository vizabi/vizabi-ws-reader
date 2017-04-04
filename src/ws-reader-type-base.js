/* eslint-disable */

import {VizabiUtils} from './vizabi-utils';
import _isString from 'lodash/isString';
import _isObject from 'lodash/isObject';
import _extend from 'lodash/extend';

const Promise = require("bluebird");
const Urlon = require("urlon");

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
      this._basepath = reader_info.path;

      // TEMP :: Fix for Vizabi
      const correctPath = '/api/ddf/ql';
      const oldPath = '/api/ddf';

      this._basepath = this._basepath.indexOf(correctPath) === -1 ?
        this._basepath.replace(oldPath, correctPath) :
        this._basepath;

      if (!this._basepath) {
        VizabiUtils.error(this.CONST.ERROR_PARAM_PATH);
      }
    },

    read(query, parsers = {}) {
      var _this = this;

      if (_isString(query.dataset)) {
        query = _extend({}, query, {dataset: encodeURIComponent(query.dataset)});
      }

      return  new Promise(function (resolve, reject) {
        const path = _this._basepath;
        const queryGet = Urlon.stringify(query);

        if(queryGet.length > 4000) {
          VizabiUtils.postRequest(
            path,
            query,
            _this._readCallbackSuccess.bind(_this, resolve, reject, path, query, parsers),
            _this._readCallbackError.bind(_this, resolve, reject, path, query),
            true
          );
        } else {
          VizabiUtils.getRequest(
            path,
            queryGet,
            _this._readCallbackSuccess.bind(_this, resolve, reject, path, query, parsers),
            _this._readCallbackError.bind(_this, resolve, reject, path, query),
            true
          );
        }
      });
    },

    /* private */

    _encodeQueryDDFQLHook: function(encodedQuery) {
      return encodedQuery;
    },

    _readCallbackSuccess: function (resolve, reject, path, query, parsers, resp) {

      if(_isObject(resp)) {
        return this._parseResponsePacked(resolve, reject, path, query, parsers, resp, this._readCallbackSuccessDone.bind(this));
      }

      VizabiUtils.error("Bad Response Format: " + path, resp);
      reject({
        'message' : this.CONST.ERROR_RESPONSE,
        'data': resp
      });
    },

    // SHOULD BE IMPLEMENTED IN CHILD CLASS
    _parseResponsePacked: function(resolve, reject, path, query, parsers, resp, done) {
      done(resolve, reject, path, query, parsers, resp);
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

      resolve(data);
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
