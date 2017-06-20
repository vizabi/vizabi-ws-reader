/* eslint-disable */

import { VizabiUtils } from './vizabi-utils';
import _isString from 'lodash/isString';
import _isObject from 'lodash/isObject';
import _extend from 'lodash/extend';
import _trimStart from 'lodash/trimStart';
import _trimEnd from 'lodash/trimEnd';
import _endsWith from 'lodash/endsWith';
import _split from 'lodash/split';

const Promise = require("bluebird");
const Urlon = require("urlon");

function WsReaderBase() {

  return {

    init(reader_info) {

      this.CONST = {
        ERROR_NETWORK: 'Connection Problem',
        ERROR_RESPONSE: 'Bad Response',
        ERROR_ORDERING: 'Cannot sort response. Column does not exist in result.',
        ERROR_PARAM_PATH: 'Missing base path for waffle reader'
      };

      this._assetsPath = _trimEnd(reader_info.assetsPath || '/api/ddf/assets', '/');
      this._dataset = reader_info.dataset;
      
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

    _toDatasetPath(dataset = 'default') {
      if (dataset === 'default') {
         return dataset;
      }

      const [path, branch = 'master'] = _split(dataset, '#');
      return path ? `${path}/${branch}` : 'default';
    },

      /**
       * 
       * @param {string} asset - asset that needs to be requested.
       * @param {object} options - might contain "dataset" (in a format GITHUB_ACCOUNT_NAME/REPOSITORY#BRANCH) and "dataset_access_token" (for private repos) properties.
       * @returns {Promise} - once resolved - asset in a json or text format will be available via this Promise. Actual data depends on requested asset extension (@see asset)
       */
    getAsset(asset, options = {}) {
      const datasetPath = this._toDatasetPath(options.dataset || this._dataset);
      const trimmedAsset = _trimStart(asset, '/');
      const isJsonAsset = _endsWith(trimmedAsset, '.json');
      const queryString = options.dataset_access_token ? `dataset_access_token=${options.dataset_access_token}` : '';
      const url = `${this._assetsPath}/${datasetPath}/${trimmedAsset}`;

      return new Promise((resolve, reject) =>
        VizabiUtils.getRequest(url, queryString, resolve, reject, isJsonAsset));
    },

    read(query, parsers = {}) {
      const _this = this;

      if (_isString(query.dataset)) {
        query = _extend({}, query, { dataset: encodeURIComponent(query.dataset) });
      }

      return new Promise(function (resolve, reject) {
        const path = _this._basepath;
        const queryGet = Urlon.stringify(query);

        if (queryGet.length > 4000) {
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

    _encodeQueryDDFQLHook: function (encodedQuery) {
      return encodedQuery;
    },

    _readCallbackSuccess: function (resolve, reject, path, query, parsers, resp) {

      if (_isObject(resp)) {
        return this._parseResponsePacked(resolve, reject, path, query, parsers, resp, this._readCallbackSuccessDone.bind(this));
      }

      VizabiUtils.error("Bad Response Format: " + path, resp);
      reject({
        'message': this.CONST.ERROR_RESPONSE,
        'data': resp
      });
    },

    // SHOULD BE IMPLEMENTED IN CHILD CLASS
    _parseResponsePacked: function (resolve, reject, path, query, parsers, resp, done) {
      done(resolve, reject, path, query, parsers, resp);
    },

    _readCallbackSuccessDone: function (resolve, reject, path, query, resp) {
      this._parse(resolve, reject, query, resp);
    },

    _parse: function (resolve, reject, query, resp) {
      const data = resp;

      if (query.orderBy && data[0]) {
        if (data[0][query.orderBy]) {
          data.sort(function (a, b) {
            return a[query.orderBy] - b[query.orderBy];
          });
        } else {
          return reject({
            'message': this.CONST.ERROR_ORDERING,
            'data': query.orderBy
          });
        }
      }

      resolve(data);
    },

    _readCallbackError: function (resolve, reject, path, query, resp) {
      reject({
        'message': this.CONST.ERROR_NETWORK,
        'data': path
      });
    },

  };
}

module.exports = { WsReaderBase };
