import { expect } from 'chai';
import * as sinon from 'sinon';
import * as urlon from 'urlon';
import { WsReader } from '../src/index-web';
import * as ReaderUtils from '../src/reader-utils-web';

const sandbox = sinon.createSandbox();

describe('WsReader', () => {
  describe('init', () => {
    let wsReader;

    beforeEach(() => {
      wsReader = WsReader.getReader();
    });

    afterEach(() => sandbox.restore());

    it('sets up initial values when no reader info is given', () => {
      const logErrorSpy = sandbox.stub(console, 'error');

      wsReader.init();

      expect(wsReader._name).to.equal('waffle');
      expect(wsReader._dataset).to.not.exist;
      expect(wsReader._assetsPath).to.equal('/api/ddf/assets');
      expect(wsReader._basepath).to.not.exist;

      sinon.assert.calledWith(logErrorSpy, 'There is no base path for waffle reader, please, consider to provide one');
    });

    it('sets up reader\'s initial values from the reader info when it is given', () => {
      wsReader.init({
        dataset: 'myDataset',
        assetsPath: '/path/to/assets/',
        path: 'https://waffle.gapminder.org'
      });

      expect(wsReader._name).to.equal('waffle');
      expect(wsReader._dataset).to.equal('myDataset');
      expect(wsReader._assetsPath).to.equal('/path/to/assets');
      expect(wsReader._basepath).to.equal('https://waffle.gapminder.org');
    });

    it('populates versionInfo property with build info', () => {
      global.READER_VERSION = '1.0-custom';
      global.READER_BUILD_TIMESTAMP = 12121212;

      wsReader.init({
        dataset: 'myDataset',
        assetsPath: '/path/to/assets/',
        path: 'https://waffle.gapminder.org'
      });

      expect(wsReader.versionInfo).to.deep.equal({
        version: '1.0-custom',
        build: 12121212
      });

      Reflect.deleteProperty(global, 'READER_VERSION');
      Reflect.deleteProperty(global, 'READER_BUILD_TIMESTAMP');
    });

    it('populates versionInfo property with build info: uses fallback values if given globals are not defined', () => {
      wsReader.init({
        dataset: 'myDataset',
        assetsPath: '/path/to/assets/',
        path: 'https://waffle.gapminder.org'
      });

      expect(wsReader.versionInfo).to.deep.equal({
        version: 'development',
        build: 7777777777777
      });
    });
  });

  describe('getAsset', () => {
    let wsReader;

    beforeEach(() => {
      sandbox.stub(ReaderUtils, 'ajax').callsFake(options => Promise.resolve({
        url: options.url,
        isJsonAsset: options.json
      }));

      wsReader = WsReader.getReader();
    });

    afterEach(() => sandbox.restore());

    it('should serve asset from dataset given to init', () => {
      const wsReaderConfig = {
        path: 'http://localhost:3000/',
        reader: 'waffle',
        assetsPath: 'http://ws.gapminderdev.org/ddf/ql/assets',
        dataset: 'open-numbers/globalis#development'
      };

      wsReader.init(wsReaderConfig);

      const expectedUrl =
        'http://ws.gapminderdev.org/ddf/ql/assets/open-numbers/globalis/development/assets/world-50m.json';

      return wsReader.getAsset('/assets/world-50m.json', {}).then(asset => {
        expect(asset.url).to.equal(expectedUrl);
        expect(asset.isJsonAsset).to.equal(true);
      });
    });

    it('should properly detect non json assets', () => {
      const wsReaderConfig = {
        path: 'http://localhost:3000/',
        reader: 'waffle',
        assetsPath: 'http://ws.gapminderdev.org/ddf/ql/assets',
        dataset: 'open-numbers/globalis#development'
      };

      wsReader.init(wsReaderConfig);

      return wsReader.getAsset('/assets/world-50m.jpg', {}).then(asset => {
        expect(asset.isJsonAsset).to.equal(false);
      });
    });

    it('should use dataset given in options rather than in init', () => {
      const wsReaderConfig = {
        path: 'http://localhost:3000/',
        reader: 'waffle',
        assetsPath: 'http://ws.gapminderdev.org/ddf/ql/assets',
        dataset: 'open-numbers/globalis#development'
      };

      wsReader.init(wsReaderConfig);

      const expectedUrl =
        'http://ws.gapminderdev.org/ddf/ql/assets/open-numbers/population/development/assets/world-50m.json';

      return wsReader.getAsset('/assets/world-50m.json', { dataset: 'open-numbers/population#development' })
        .then(asset => expect(asset.url).to.equal(expectedUrl));
    });

    it('should use master branch in url path if no branch is specified for a dataset', () => {
      const wsReaderConfig = {
        path: 'http://localhost:3000/',
        reader: 'waffle',
        assetsPath: 'http://ws.gapminderdev.org/ddf/ql/assets',
        dataset: 'open-numbers/globalis#development'
      };

      wsReader.init(wsReaderConfig);

      const expectedUrl =
        'http://ws.gapminderdev.org/ddf/ql/assets/open-numbers/population/master/assets/world-50m.json';

      return wsReader.getAsset('/assets/world-50m.json', { dataset: 'open-numbers/population' }).then(asset => {
        expect(asset.url).to.equal(expectedUrl);
      });
    });

    it('should serve assets without starting slash', () => {
      const wsReaderConfig = {
        path: 'http://localhost:3000/',
        reader: 'waffle',
        assetsPath: 'http://ws.gapminderdev.org/ddf/ql/assets',
        dataset: 'open-numbers/globalis#development'
      };

      wsReader.init(wsReaderConfig);

      const expectedUrl =
        'http://ws.gapminderdev.org/ddf/ql/assets/open-numbers/population/master/assets/world-50m.json';

      return wsReader.getAsset('assets/world-50m.json', { dataset: 'open-numbers/population' }).then(asset => {
        expect(asset.url).to.equal(expectedUrl);
      });
    });

    it('should serve assets from default dataset', () => {
      const wsReaderConfig = {
        path: 'http://localhost:3000/',
        reader: 'waffle',
        assetsPath: 'http://ws.gapminderdev.org/ddf/ql/assets'
      };

      wsReader.init(wsReaderConfig);

      return wsReader.getAsset('assets/world-50m.json').then(asset => {
        expect(asset.url).to.equal('http://ws.gapminderdev.org/ddf/ql/assets/default/assets/world-50m.json');
      });
    });

    it('should serve assets from default dataset when only branch is given', () => {
      const wsReaderConfig = {
        path: 'http://localhost:3000/',
        reader: 'waffle',
        assetsPath: 'http://ws.gapminderdev.org/ddf/ql/assets'
      };

      wsReader.init(wsReaderConfig);

      return wsReader.getAsset('assets/world-50m.json', { dataset: '#develop' }).then(asset => {
        expect(asset.url).to.equal('http://ws.gapminderdev.org/ddf/ql/assets/default/assets/world-50m.json');
      });
    });

    it('should put a dataset_access_token in a query string', () => {
      const wsReaderConfig = {
        path: 'http://localhost:3000/',
        reader: 'waffle',
        assetsPath: 'http://ws.gapminderdev.org/ddf/ql/assets',
        dataset: 'open-numbers/globalis#development'
      };

      wsReader.init(wsReaderConfig);

      const expectedUrl =
        'http://ws.gapminderdev.org/ddf/ql/assets/open-numbers/globalis/development/assets/world-50m.json?dataset_access_token=1111AAAABBBBFFFF';
      const datasetAccessToken = '1111AAAABBBBFFFF';

      return wsReader.getAsset('assets/world-50m.json', { dataset_access_token: datasetAccessToken }).then(asset => {
        expect(asset.url).to.equal(expectedUrl);
      });
    });

    it('should correctly handle assets path with trailing /', () => {
      const wsReaderConfig = {
        path: 'http://localhost:3000/',
        reader: 'waffle',
        assetsPath: 'http://ws.gapminderdev.org/ddf/ql/assets/',
        dataset: 'open-numbers/globalis#development'
      };

      wsReader.init(wsReaderConfig);

      const expectedUrl =
        'http://ws.gapminderdev.org/ddf/ql/assets/open-numbers/globalis/development/assets/world-50m.json';

      return wsReader.getAsset('assets/world-50m.json').then(asset => {
        expect(asset.url).to.equal(expectedUrl);
      });
    });

    it('should explicitly say when there is no assetsPath provided', () => {
      const wsReaderConfig = {
        path: 'http://localhost:3000/',
        reader: 'waffle',
        dataset: 'open-numbers/globalis#development'
      };

      wsReader.init(wsReaderConfig);

      return wsReader.getAsset('assets/world-50m.json').then(asset => {
        expect(asset.url).to.equal('/api/ddf/assets/open-numbers/globalis/development/assets/world-50m.json');
      });
    });
  });

  describe('read', () => {
    afterEach(() => sandbox.restore());

    it('rejects response when request to the server failed', () => {
      const wsReaderConfig = {
        path: 'http://localhost:3000/',
        dataset: 'open-numbers/globalis#development'
      };

      sandbox.stub(ReaderUtils, 'ajax').resolves(Promise.reject('Response is incorrect'));

      const wsReader = WsReader.getReader();

      wsReader.init(wsReaderConfig);

      return wsReader.read({}).catch(error => {
        expect(error).to.deep.equal({
          error: 'Response is incorrect',
          data: {
            ddfql: { dataset: 'open-numbers%2Fglobalis%23development' },
            endpoint: `${wsReaderConfig.path}?_dataset=open-numbers%252Fglobalis%2523development`
          }
        });
      });
    });

    it('dataset from query have first priority', () => {
      const wsReaderConfig = {
        path: 'http://localhost:3000/',
        dataset: 'open-numbers/globalis#development'
      };

      sandbox.stub(ReaderUtils, 'ajax').resolves(Promise.reject('Response is incorrect'));

      const wsReader = WsReader.getReader();

      wsReader.init(wsReaderConfig);

      return wsReader.read({ dataset: 'other-open-numbers/globalis#development' }).catch(error => {
        expect(error).to.deep.equal({
          error: 'Response is incorrect',
          data: {
            ddfql: { dataset: 'other-open-numbers%2Fglobalis%23development' },
            endpoint: `${wsReaderConfig.path}?_dataset=other-open-numbers%252Fglobalis%2523development`
          }
        });
      });
    });

    it('query without token & reads data successfully', () => {
      const wsReaderConfig = {
        path: 'http://localhost:3000/',
        dataset: 'open-numbers/globalis#development'
      };

      const response = {
        dataset: 'open-numbers/globalis#development',
        headers: ['a', 'b', 'c'],
        rows: [
          ['a1', { hello: 'world' }, 'c1'],
          ['a2', null, 'c2'],
          ['a3', 'b3', undefined]
        ]
      };

      const ajaxStub = sandbox.stub(ReaderUtils, 'ajax').resolves(response);
      const wsReader = WsReader.getReader();

      wsReader.init(wsReaderConfig);

      const parsedResponse = [
        {
          a: 'a1',
          b: { hello: 'world' },
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
      const query = {
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
      };

      return wsReader.read(query).then(actualResponse => {
        expect(actualResponse).to.deep.equal(parsedResponse);

        sinon.assert.calledOnce(ajaxStub);
        sinon.assert.calledWith(ajaxStub, {
          url: `${wsReaderConfig.path}?_from=datapoints&select_key@=dimension1&=dimension2;&value@=indicator;;&dataset=open-numbers%252Fglobalis%2523development`,
          json: true
        });
      });
    });

    it('query with token & reads data successfully', () => {
      const wsReaderConfig = {
        dataset_access_token: '123',
        path: 'http://localhost:3000/',
        dataset: 'open-numbers/globalis#development'
      };
      const response = {
        dataset: 'open-numbers/globalis#development',
        headers: ['a', 'b', 'c'],
        rows: [
          ['a1', { hello: 'world' }, 'c1'],
          ['a2', null, 'c2'],
          ['a3', 'b3', undefined]
        ]
      };

      const ajaxStub = sandbox.stub(ReaderUtils, 'ajax').resolves(response);
      const wsReader = WsReader.getReader();

      wsReader.init(wsReaderConfig);

      const parsedResponse = [
        {
          a: 'a1',
          b: { hello: 'world' },
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
      const query = {
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
      };

      return wsReader.read(query).then(actualResponse => {
        expect(actualResponse).to.deep.equal(parsedResponse);

        sinon.assert.calledOnce(ajaxStub);
        sinon.assert.calledWith(ajaxStub, {
          url: `${wsReaderConfig.path}?_from=datapoints&select_key@=dimension1&=dimension2;&value@=indicator;;&dataset=open-numbers%252Fglobalis%2523development&dataset/_access/_token=123`,
          json: true
        });
      });
    });

    it('returns an error if response came in the incorrect format', () => {
      const wsReaderConfig = {
        path: 'http://localhost:3000/',
        dataset: 'open-numbers/globalis#development'
      };
      const response = 'incorrect';

      sandbox.stub(ReaderUtils, 'ajax').resolves(response);

      const wsReader = WsReader.getReader();

      wsReader.init(wsReaderConfig);

      return wsReader.read({ from: 'datapoints' }).catch(error => {
        expect(error).to.deep.equal({
          data: {
            ddfql: {
              from: 'datapoints',
              dataset: 'open-numbers%2Fglobalis%23development'
            },
            endpoint: `${wsReaderConfig.path}?_from=datapoints&dataset=open-numbers%252Fglobalis%2523development`
          },
          error: { error: 'WS bad response: "incorrect"' }
        });
      });
    });

    it('encodes dataset provided in the ddfql query', () => {
      const wsReaderConfig = {
        path: 'http://localhost:3000/',
        dataset: 'open-numbers/globalis#development'
      };
      const query = {
        from: 'datapoints',
        dataset: 'open-numbers/globalis#development'
      };
      const subQuery = {
        from: 'datapoints',
        dataset: encodeURIComponent(query.dataset)
      };

      const ajaxStub = sandbox.stub(ReaderUtils, 'ajax').resolves({});
      const wsReader = WsReader.getReader();

      wsReader.init(wsReaderConfig);

      return wsReader.read(query).then(() => {
        sinon.assert.calledOnce(ajaxStub);
        sinon.assert.calledWith(ajaxStub, {
          url: `${wsReaderConfig.path}?${urlon.stringify(subQuery)}`,
          json: true
        });
      });
    });
  });
});
