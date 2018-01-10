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
    const homepoint = this._getWindowLocationHref();

    if (this.onTrackRequest) {
      this.onTrackRequest(query);
    }

    return ReaderUtils.ajax({ url, json: true })
      .then(response => {
        const options = {
          query,
          response,
          parsers,
          endpoint: url,
          homepoint
        };

        return this._onReadSuccess(options);
      })
      .catch(error => {
        const options = {
          query,
          error,
          ddfql,
          endpoint: url,
          homepoint
        };

        return this._onReadError(options);
      });
  },

  _wrapError(error) {
    return `status: ${error.status || '(empty)'}; message: ${error.message || '(empty)'}; stack: ${error.stack || '(empty)'}`;
  },

  _onReadError(options) {
    const { homepoint, endpoint, ddfql, error } = options;

    const event = {
      homepoint,
      endpoint,
      error: this._wrapError(error),
      message: this._wrapError(error)
    };

    if (error.type === 'message') {
      if (this.onTrackMessage) {
        this.onTrackMessage(event);
      }
    } else if (this.onTrackException) {
      this.onTrackException(event);
    }

    return Promise.reject({
      error,
      data: {
        endpoint,
        homepoint,
        ddfql
      }
    });
  },

  _onReadSuccess(options) {
    const { homepoint, endpoint, query, parsers, response } = options;

    if (!isObject(response) || (response.error || response.message)) {
      const errorDescription = {
        type: 'message',
        status: ERRORS.RESPONSE,
        message: response.message || response,
        stack: response.error
      };

      return Promise.reject(errorDescription);
    }

    const event = { responseData: response.rows.length, endpoint, homepoint };

    if (this.onTrackResponse) {
      this.onTrackResponse(query, event);
    }

    return this._parse(response, parsers);
  },

  _parse(response, parsers) {
    return ReaderUtils.mapRows(this._toPojo(response), parsers);
  },

  _getWindowLocationHref() {
    return window.location.href;
  },

  _toPojo(response) {
    return response;
  }
};
