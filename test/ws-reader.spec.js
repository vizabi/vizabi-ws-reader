import { expect } from 'chai';
import * as sinon from 'sinon';
import * as sinonTest from 'sinon-test';
import * as ReaderUtils from '../src/reader-utils';

import { WsReader } from '../src';

sinon.test = sinonTest.configureTest(sinon);

let wsReader;

describe('WsReader', () => {
  beforeEach(() => {
    wsReader = WsReader.getReader();
  });

  describe('init', () => {
    it('sets up initial values when no reader info is given', sinon.test(function () {
      const logErrorSpy = this.stub(console, 'error');

      wsReader.init();

      expect(wsReader._name).to.equal('waffle');
      expect(wsReader._dataset).to.not.exist;
      expect(wsReader._assetsPath).to.equal('/api/ddf/assets');
      expect(wsReader._basepath).to.not.exist;

      sinon.assert.calledWith(logErrorSpy, 'There is no base path for waffle reader, please, consider to provide one');
    }));

    it('sets up reader\'s initial values from the reader info when it is given', sinon.test(function () {
      wsReader.init({
        dataset: 'myDataset',
        assetsPath: '/path/to/assets/',
        path: 'https://waffle.gapminder.org'
      });

      expect(wsReader._name).to.equal('waffle');
      expect(wsReader._dataset).to.equal('myDataset');
      expect(wsReader._assetsPath).to.equal('/path/to/assets');
      expect(wsReader._basepath).to.equal('https://waffle.gapminder.org');
    }));
  });

  describe('getAsset', () => {
    it('should serve asset from dataset given to init', sinon.test(function () {
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

  describe('read', () => {
    it('rejects response when request to the server failed', sinon.test(function () {
      const wsReaderConfig = {
        path: 'http://localhost:3000/',
        dataset: 'open-numbers/globalis#development'
      };

      wsReader.init(wsReaderConfig);

      this.stub(ReaderUtils, 'ajax').resolves(Promise.reject('Response is incorrect'));
      return wsReader.read({}).catch(error => {
        expect(error).to.deep.equal({
          error: 'Response is incorrect',
          data: {
            ddfql: {},
            endpoint: 'http://localhost:3000/'
          }
        });
      });
    }));

    it('reads data successfully', sinon.test(function () {
      const wsReaderConfig = {
        path: 'http://localhost:3000/',
        dataset: 'open-numbers/globalis#development'
      };

      wsReader.init(wsReaderConfig);

      const response = {
        headers: ['a', 'b', 'c'],
        rows: [
          ['a1', { hello: 'world' }, 'c1'],
          ['a2', null, 'c2'],
          ['a3', 'b3', undefined]
        ]
      };

      const parsedResponse = [
        {
          a: 'a1',
          b: '{"hello":"world"}',
          c: 'c1'
        },
        {
          a: 'a2',
          b: null,
          c: 'c2'
        },
        {
          a: 'a3',
          b: 'b3',
          c: null
        }
      ];

      const ajaxStub = this.stub(ReaderUtils, 'ajax').resolves(response);

      return wsReader.read({
        from: 'datapoints',
        select: {
          key: [
            'dimension1',
            'dimension2'
          ],
          value: [
            'indicator'
          ]
        }
      }).then(actualResponse => {
        expect(actualResponse).to.deep.equal(parsedResponse);

        sinon.assert.calledOnce(ajaxStub);
        sinon.assert.calledWith(ajaxStub, {
          url: 'http://localhost:3000/?_from=datapoints&select_key@=dimension1&=dimension2;&value@=indicator',
          json: true
        });
      });
    }));

    it('returns an error if response came in the incorrect format', sinon.test(function () {
      const wsReaderConfig = {
        path: 'http://localhost:3000/',
        dataset: 'open-numbers/globalis#development'
      };

      wsReader.init(wsReaderConfig);

      const response = 'incorrect';

      this.stub(ReaderUtils, 'ajax').resolves(response);

      return wsReader.read({ from: 'datapoints' }).catch(error => {
        expect(error).to.deep.equal({
          data: {
            ddfql: { from: 'datapoints' },
            endpoint: 'http://localhost:3000/'
          },
          error: {
            data: 'incorrect',
            message: 'Bad Response: incorrect'
          }
        });
      });
    }));

    it('encodes dataset provided in the ddfql query', sinon.test(function () {
      const wsReaderConfig = {
        path: 'http://localhost:3000/',
        dataset: 'open-numbers/globalis#development'
      };

      wsReader.init(wsReaderConfig);

      const ajaxStub = this.stub(ReaderUtils, 'ajax').resolves({});

      return wsReader.read({
        from: 'datapoints',
        dataset: 'open-numbers/globalis#development'
      }).then(() => {
        sinon.assert.calledOnce(ajaxStub);
        sinon.assert.calledWith(ajaxStub, {
          url: 'http://localhost:3000/?_from=datapoints&dataset=open-numbers%252Fglobalis%2523development',
          json: true
        });
      });
    }));
  });
});
