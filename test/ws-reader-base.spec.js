/*eslint no-magic-numbers: ["error", { "ignoreArrayIndexes": true }]*/

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as sinonTest from 'sinon-test';
import * as ReaderUtils from '../src/reader-utils';

import { WsReader } from '../src';

sinon.test = sinonTest.configureTest(sinon);

describe('getAsset', () => {
  it('should serve asset from dataset given to init', sinon.test(function () {
    const wsReader = WsReader.getReader();

    const wsReaderConfig = {
      path: 'http://localhost:3000/',
      reader: 'waffle',
      assetsPath: 'http://ws.gapminderdev.org/ddf/ql/assets',
      dataset: 'open-numbers/globalis#development'
    };

    wsReader.init(wsReaderConfig);

    const expectedUrl =
      'http://ws.gapminderdev.org/ddf/ql/assets/open-numbers/globalis/development/assets/world-50m.json';

    this.stub(ReaderUtils, 'ajax').callsFake(options => Promise.resolve({
      url: options.url,
      isJsonAsset: options.json
    }));

    return wsReader.getAsset('/assets/world-50m.json', {}).then(asset => {
      expect(asset.url).to.equal(expectedUrl);
      expect(asset.isJsonAsset).to.equal(true);
    });
  }));

  it('should properly detect non json assets', sinon.test(function () {
    const wsReader = WsReader.getReader();

    const wsReaderConfig = {
      path: 'http://localhost:3000/',
      reader: 'waffle',
      assetsPath: 'http://ws.gapminderdev.org/ddf/ql/assets',
      dataset: 'open-numbers/globalis#development'
    };

    wsReader.init(wsReaderConfig);

    this.stub(ReaderUtils, 'ajax').callsFake(options => Promise.resolve({
      url: options.url,
      isJsonAsset: options.json
    }));


    return wsReader.getAsset('/assets/world-50m.jpg', {}).then(asset => {
      expect(asset.isJsonAsset).to.equal(false);
    });
  }));

  it('should use dataset given in options rather than in init', sinon.test(function () {
    const wsReader = WsReader.getReader();

    const wsReaderConfig = {
      path: 'http://localhost:3000/',
      reader: 'waffle',
      assetsPath: 'http://ws.gapminderdev.org/ddf/ql/assets',
      dataset: 'open-numbers/globalis#development'
    };

    wsReader.init(wsReaderConfig);

    const expectedUrl =
      'http://ws.gapminderdev.org/ddf/ql/assets/open-numbers/population/development/assets/world-50m.json';

    this.stub(ReaderUtils, 'ajax').callsFake(options => Promise.resolve({
      url: options.url,
      isJsonAsset: options.json
    }));

    return wsReader.getAsset('/assets/world-50m.json', { dataset: 'open-numbers/population#development' })
      .then(asset => expect(asset.url).to.equal(expectedUrl));
  }));

  it('should use master branch in url path if no branch is specified for a dataset', sinon.test(function () {
    const wsReader = WsReader.getReader();

    const wsReaderConfig = {
      path: 'http://localhost:3000/',
      reader: 'waffle',
      assetsPath: 'http://ws.gapminderdev.org/ddf/ql/assets',
      dataset: 'open-numbers/globalis#development'
    };

    wsReader.init(wsReaderConfig);

    const expectedUrl =
      'http://ws.gapminderdev.org/ddf/ql/assets/open-numbers/population/master/assets/world-50m.json';

    this.stub(ReaderUtils, 'ajax').callsFake(options => Promise.resolve({
      url: options.url,
      isJsonAsset: options.json
    }));

    return wsReader.getAsset('/assets/world-50m.json', { dataset: 'open-numbers/population' }).then(asset => {
      expect(asset.url).to.equal(expectedUrl);
    });
  }));

  it('should serve assets without starting slash', sinon.test(function () {
    const wsReader = WsReader.getReader();

    const wsReaderConfig = {
      path: 'http://localhost:3000/',
      reader: 'waffle',
      assetsPath: 'http://ws.gapminderdev.org/ddf/ql/assets',
      dataset: 'open-numbers/globalis#development'
    };

    wsReader.init(wsReaderConfig);

    const expectedUrl =
      'http://ws.gapminderdev.org/ddf/ql/assets/open-numbers/population/master/assets/world-50m.json';

    this.stub(ReaderUtils, 'ajax').callsFake(options => Promise.resolve({
      url: options.url,
      isJsonAsset: options.json
    }));

    return wsReader.getAsset('assets/world-50m.json', { dataset: 'open-numbers/population' }).then(asset => {
      expect(asset.url).to.equal(expectedUrl);
    });
  }));

  it('should serve assets from default dataset', sinon.test(function () {
    const wsReader = WsReader.getReader();

    const wsReaderConfig = {
      path: 'http://localhost:3000/',
      reader: 'waffle',
      assetsPath: 'http://ws.gapminderdev.org/ddf/ql/assets'
    };

    wsReader.init(wsReaderConfig);

    this.stub(ReaderUtils, 'ajax').callsFake(options => Promise.resolve({
      url: options.url,
      isJsonAsset: options.json
    }));

    return wsReader.getAsset('assets/world-50m.json').then(asset => {
      expect(asset.url).to.equal('http://ws.gapminderdev.org/ddf/ql/assets/default/assets/world-50m.json');
    });
  }));

  it('should serve assets from default dataset when only branch is given', sinon.test(function () {
    const wsReader = WsReader.getReader();

    const wsReaderConfig = {
      path: 'http://localhost:3000/',
      reader: 'waffle',
      assetsPath: 'http://ws.gapminderdev.org/ddf/ql/assets'
    };

    wsReader.init(wsReaderConfig);

    this.stub(ReaderUtils, 'ajax').callsFake(options => Promise.resolve({
      url: options.url,
      isJsonAsset: options.json
    }));

    return wsReader.getAsset('assets/world-50m.json', { dataset: '#develop' }).then(asset => {
      expect(asset.url).to.equal('http://ws.gapminderdev.org/ddf/ql/assets/default/assets/world-50m.json');
    });
  }));

  it('should put a dataset_access_token in a query string', sinon.test(function () {
    const wsReader = WsReader.getReader();

    const wsReaderConfig = {
      path: 'http://localhost:3000/',
      reader: 'waffle',
      assetsPath: 'http://ws.gapminderdev.org/ddf/ql/assets',
      dataset: 'open-numbers/globalis#development'
    };

    wsReader.init(wsReaderConfig);

    const expectedUrl =
      'http://ws.gapminderdev.org/ddf/ql/assets/open-numbers/globalis/development/assets/world-50m.json?dataset_access_token=1111AAAABBBBFFFF';

    this.stub(ReaderUtils, 'ajax').callsFake(options => Promise.resolve({
      url: options.url,
      isJsonAsset: options.json
    }));

    const datasetAccessToken = '1111AAAABBBBFFFF';

    return wsReader.getAsset('assets/world-50m.json', { dataset_access_token: datasetAccessToken }).then(asset => {
      expect(asset.url).to.equal(expectedUrl);
    });
  }));

  it('should correctly handle assets path with trailing /', sinon.test(function () {
    const wsReader = WsReader.getReader();

    const wsReaderConfig = {
      path: 'http://localhost:3000/',
      reader: 'waffle',
      assetsPath: 'http://ws.gapminderdev.org/ddf/ql/assets/',
      dataset: 'open-numbers/globalis#development'
    };

    wsReader.init(wsReaderConfig);

    const expectedUrl =
      'http://ws.gapminderdev.org/ddf/ql/assets/open-numbers/globalis/development/assets/world-50m.json';

    this.stub(ReaderUtils, 'ajax').callsFake(options => Promise.resolve({
      url: options.url,
      isJsonAsset: options.json
    }));

    return wsReader.getAsset('assets/world-50m.json').then(asset => {
      expect(asset.url).to.equal(expectedUrl);
    });
  }));

  it('should explicitly say when there is no assetsPath provided', sinon.test(function () {
    const wsReader = WsReader.getReader();

    const wsReaderConfig = {
      path: 'http://localhost:3000/',
      reader: 'waffle',
      dataset: 'open-numbers/globalis#development'
    };

    wsReader.init(wsReaderConfig);

    this.stub(ReaderUtils, 'ajax').callsFake(options => Promise.resolve({
      url: options.url,
      isJsonAsset: options.json
    }));

    return wsReader.getAsset('assets/world-50m.json').then(asset => {
      expect(asset.url).to.equal('/api/ddf/assets/open-numbers/globalis/development/assets/world-50m.json');
    });
  }));
});
