import * as ReaderUtils from './reader-utils';
import * as Urlon from 'urlon';
import isString from 'lodash/isString';
import isObject from 'lodash/isObject';
import trimStart from 'lodash/trimStart';
import trimEnd from 'lodash/trimEnd';
import endsWith from 'lodash/endsWith';
import split from 'lodash/split';

const ERRORS = {
  NETWORK: 'Server is not reachable',
  RESPONSE: 'Bad Response',
  PARAM_PATH: 'There is no base path for waffle reader, please, consider to provide one'
};

const READER_VERSION_FALLBACK = 'development';
const READER_BUILD_TIMESTAMP_FALLBACK = 7777777777777;

export const BaseWsReader = {
  init(readerInfo = {}) {
    this._name = 'waffle';
    this._dataset = readerInfo.dataset;
    this._assetsPath = trimEnd(readerInfo.assetsPath || '/api/ddf/assets', '/');
    this._basepath = readerInfo.path;

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
   *  - might contain 'dataset' (in a format GITHUB_ACCOUNT_NAME/REPOSITORY#BRANCH)
   *  and 'dataset_access_token' (for private repos) properties.
   *
   * @returns {Promise} - once resolved
   *  - asset in a json or text format will be available via this Promise.
   *  Actual data depends on requested asset extension (@see asset)
   */
  getAsset(asset, options = {}) {
    const datasetPath = this._toDatasetPath(options.dataset || this._dataset);

    const trimmedAsset = trimStart(asset, '/');

    const isJsonAsset = endsWith(trimmedAsset, '.json');

    const queryString = options.dataset_access_token ? `dataset_access_token=${options.dataset_access_token}` : '';

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

    return ReaderUtils.ajax({ url: `${this._basepath}?${Urlon.stringify(ddfql)}`, json: true })
      .then(response => {
        const options = {
          response,
          parsers,
          endpoint: this._basepath
        };

        return this._onReadSuccess(options);
      })
      .catch(error => {
        const options = {
          error,
          ddfql,
          endpoint: this._basepath
        };

        return this._onReadError(options);
      });
  },

  _onReadError({ endpoint, ddfql, error }) {
    return Promise.reject({
      error,
      data: {
        endpoint,
        ddfql
      }
    });
  },

  _onReadSuccess({ parsers, response }) {
    if (!isObject(response)) {
      const errorDescription = {
        message: `${ERRORS.RESPONSE}: ${response}`,
        data: response
      };

      return Promise.reject(errorDescription);
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
