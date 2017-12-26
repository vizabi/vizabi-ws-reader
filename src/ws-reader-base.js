import endsWith from 'lodash/endsWith';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import split from 'lodash/split';
import trimEnd from 'lodash/trimEnd';
import trimStart from 'lodash/trimStart';
import * as Urlon from 'urlon';
import * as ReaderUtils from './reader-utils';

const ERRORS = {
  NETWORK: 'Server is not reachable',
  RESPONSE: 'Bad Response',
  PARAM_PATH: 'There is no base path for waffle reader, please, consider to provide one'
};

const READER_VERSION_FALLBACK = 'development';
const READER_BUILD_TIMESTAMP_FALLBACK = 7777777777777;

export const BaseWsReader = {

  /**
   * @param {object} readerInfo
   *  contains 'dataset' (in a format GITHUB_ACCOUNT_NAME/REPOSITORY#BRANCH)
   *  contains 'path' (in a format https://waffle-server-dev.gapminderdev.org/api/ddf/ql)
   *  contains 'assetsPath' (in a format https://import-waffle-server-dev.gapminderdev.org/api/ddf/assets/)
   *  may contain 'dataset_access_token' for private repos
   **/

  init(readerInfo = {}) {
    this._name = 'waffle';
    this._dataset = readerInfo.dataset;
    this._assetsPath = trimEnd(readerInfo.assetsPath || '/api/ddf/assets', '/');
    this._basepath = readerInfo.path;
    this._dataset_access_token = readerInfo.dataset_access_token;

    this.versionInfo = {
      version: typeof READER_VERSION === 'undefined' ? READER_VERSION_FALLBACK : READER_VERSION,
      build: typeof READER_BUILD_TIMESTAMP === 'undefined' ? READER_BUILD_TIMESTAMP_FALLBACK : READER_BUILD_TIMESTAMP
    };

    if (!this._basepath) {
      console.error(ERRORS.PARAM_PATH);
    }
  },

  /**
   *
   * @param {string} asset
   *  - asset that needs to be requested.
   *
   * @param {object} options
   *  - may contain 'dataset' (in a format GITHUB_ACCOUNT_NAME/REPOSITORY#BRANCH) if it wasn't defined on init
   *  - may contain 'dataset_access_token' for private repos
   *
   * @returns {Promise} - once resolved
   *  - asset in a json or text format will be available via this Promise.
   *  Actual data depends on requested asset extension (@see asset)
   */
  getAsset(asset, options = {}) {
    const datasetPath = this._toDatasetPath(options.dataset || this._dataset);

    const trimmedAsset = trimStart(asset, '/');

    const isJsonAsset = endsWith(trimmedAsset, '.json');

    const queryString = options.dataset_access_token || this._dataset_access_token ? `dataset_access_token=${options.dataset_access_token || this._dataset_access_token}` : '';

    const url = `${this._assetsPath}/${datasetPath}/${trimmedAsset}`;

    return ReaderUtils.ajax({
      url: queryString ? `${url}?${queryString}` : url,
      json: isJsonAsset
    });
  },

  _toDatasetPath(dataset = 'default') {
    if (dataset === 'default') {
      return dataset;
    }

    const [path, branch = 'master'] = split(dataset, '#');

    return path ? `${path}/${branch}` : 'default';
  },

  read(query, parsers = {}) {
    const ddfql = isString(query.dataset)
      ? Object.assign({}, query, { dataset: encodeURIComponent(query.dataset) })
      : query;

    if (this._dataset_access_token) {
      ddfql.dataset_access_token = this._dataset_access_token;
    }
    const url = `${this._basepath}?${Urlon.stringify(ddfql)}`;

    if (this.onReadHook) {
      this.onReadHook(query, 'request');
    }

    return ReaderUtils.ajax({ url, json: true })
      .then(response => {
        const options = {
          query,
          response,
          parsers,
          endpoint: url
        };

        return this._onReadSuccess(options);
      })
      .catch(error => {
        const options = {
          query,
          error,
          ddfql,
          endpoint: url
        };

        return this._onReadError(options);
      });
  },

  _onReadError({ endpoint, query, ddfql, error }) {
    if (this.onReadHook) {
      const { from, select } = query;

      this.onReadHook({
        from,
        select,
        responseData: {
          code: error.status || null,
          message: error.stack || error.message,
          metadata: { endpoint }
        }
      }, 'error');
    }

    return Promise.reject({
      error,
      data: {
        endpoint,
        ddfql
      }
    });
  },

  _onReadSuccess(options) {
    const { endpoint, query: { from, select }, parsers, response } = options;

    if (!isObject(response) || (response.error || response.message)) {
      const message = response.message || response.error || response;
      const errorDescription = {
        message: `${ERRORS.RESPONSE}: ${message}`,
        data: message
      };

      return Promise.reject(errorDescription);
    }

    if (this.onReadHook) {
      const { rows } = response;

      this.onReadHook({ from, select, responseData: { metadata: { endpoint }, data: rows.length } }, 'response');
    }

    return this._parse(response, parsers);
  },

  _parse(response, parsers) {
    return ReaderUtils.mapRows(this._toPojo(response), parsers);
  },

  _toPojo(response) {
    return response;
  }
};
