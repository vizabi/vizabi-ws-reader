/* eslint-disable */
import _ from 'lodash';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as sinonTest from 'sinon-test';
import { VizabiUtils } from '../src/vizabi-utils';

import { WSReader } from '../src';

sinon.test = sinonTest.configureTest(sinon);

let wsReader;
let wsReaderInst;

describe('getAsset', () => {
  beforeEach(() => {
    wsReader = new WSReader();
    wsReaderInst = wsReader.getReader();
  });

  it('should serve asset from dataset given to init', sinon.test(function () {
    const wsReaderConfig = {
      path: 'http://localhost:3000/',
      reader: 'waffle',
      assetsPath: 'http://ws.gapminderdev.org/ddf/ql/assets',
      dataset: 'open-numbers/globalis#development'
    };

    wsReaderInst.init(wsReaderConfig);

    this.stub(VizabiUtils, 'getRequest').callsFake((...args) => {
      const resolve = args[2];
      const reject = args[3];

      const asset = {
        url: args[0],
        queryString: args[1],
        isJsonAsset: args[4]
      };

      resolve(asset);
    });

    return wsReaderInst.getAsset('/assets/world-50m.json', {}).then(asset => {
      expect(asset.url).to.equal('http://ws.gapminderdev.org/ddf/ql/assets/open-numbers/globalis/development/assets/world-50m.json');
      expect(asset.queryString).to.equal('');
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

    wsReaderInst.init(wsReaderConfig);

    this.stub(VizabiUtils, 'getRequest').callsFake((...args) => {
      const resolve = args[2];
      const reject = args[3];

      const asset = {
        url: args[0],
        queryString: args[1],
        isJsonAsset: args[4]
      };

      resolve(asset);
    });

    return wsReaderInst.getAsset('/assets/world-50m.jpg', {}).then(asset => {
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

    wsReaderInst.init(wsReaderConfig);

    this.stub(VizabiUtils, 'getRequest').callsFake((...args) => {
      const resolve = args[2];
      const reject = args[3];

      const asset = {
        url: args[0],
        queryString: args[1],
        isJsonAsset: args[4]
      };

      resolve(asset);
    });

    return wsReaderInst.getAsset('/assets/world-50m.json', {
      dataset: 'open-numbers/population#development'
    }).then(asset => {
      expect(asset.url).to.equal('http://ws.gapminderdev.org/ddf/ql/assets/open-numbers/population/development/assets/world-50m.json');
    });
  }));

  it('should use master branch in url path if no branch is specified for a dataset', sinon.test(function () {
    const wsReaderConfig = {
      path: 'http://localhost:3000/',
      reader: 'waffle',
      assetsPath: 'http://ws.gapminderdev.org/ddf/ql/assets',
      dataset: 'open-numbers/globalis#development'
    };

    wsReaderInst.init(wsReaderConfig);

    this.stub(VizabiUtils, 'getRequest').callsFake((...args) => {
      const resolve = args[2];
      const reject = args[3];

      const asset = {
        url: args[0],
        queryString: args[1],
        isJsonAsset: args[4]
      };

      resolve(asset);
    });

    return wsReaderInst.getAsset('/assets/world-50m.json', {
      dataset: 'open-numbers/population'
    }).then(asset => {
      expect(asset.url).to.equal('http://ws.gapminderdev.org/ddf/ql/assets/open-numbers/population/master/assets/world-50m.json');
    });
  }));

  it('should serve assets without starting slash', sinon.test(function () {
    const wsReaderConfig = {
      path: 'http://localhost:3000/',
      reader: 'waffle',
      assetsPath: 'http://ws.gapminderdev.org/ddf/ql/assets',
      dataset: 'open-numbers/globalis#development'
    };

    wsReaderInst.init(wsReaderConfig);

    this.stub(VizabiUtils, 'getRequest').callsFake((...args) => {
      const resolve = args[2];
      const reject = args[3];

      const asset = {
        url: args[0],
        queryString: args[1],
        isJsonAsset: args[4]
      };

      resolve(asset);
    });

    return wsReaderInst.getAsset('assets/world-50m.json', {
      dataset: 'open-numbers/population'
    }).then(asset => {
      expect(asset.url).to.equal('http://ws.gapminderdev.org/ddf/ql/assets/open-numbers/population/master/assets/world-50m.json');
    });
  }));

  it('should serve assets from default dataset', sinon.test(function () {
    const wsReaderConfig = {
      path: 'http://localhost:3000/',
      reader: 'waffle',
      assetsPath: 'http://ws.gapminderdev.org/ddf/ql/assets'
    };

    wsReaderInst.init(wsReaderConfig);

    this.stub(VizabiUtils, 'getRequest').callsFake((...args) => {
      const resolve = args[2];
      const reject = args[3];

      const asset = {
        url: args[0],
        queryString: args[1],
        isJsonAsset: args[4]
      };

      resolve(asset);
    });

    return wsReaderInst.getAsset('assets/world-50m.json').then(asset => {
      expect(asset.url).to.equal('http://ws.gapminderdev.org/ddf/ql/assets/default/assets/world-50m.json');
    });
  }));

  it('should serve assets from default dataset when only branch is given', sinon.test(function () {
    const wsReaderConfig = {
      path: 'http://localhost:3000/',
      reader: 'waffle',
      assetsPath: 'http://ws.gapminderdev.org/ddf/ql/assets'
    };

    wsReaderInst.init(wsReaderConfig);

    this.stub(VizabiUtils, 'getRequest').callsFake((...args) => {
      const resolve = args[2];
      const reject = args[3];

      const asset = {
        url: args[0],
        queryString: args[1],
        isJsonAsset: args[4]
      };

      resolve(asset);
    });

    return wsReaderInst.getAsset('assets/world-50m.json', {dataset: '#develop'}).then(asset => {
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

    wsReaderInst.init(wsReaderConfig);

    this.stub(VizabiUtils, 'getRequest').callsFake((...args) => {
      const resolve = args[2];
      const reject = args[3];

      const asset = {
        url: args[0],
        queryString: args[1],
        isJsonAsset: args[4]
      };

      resolve(asset);
    });

    const datasetAccessToken = '1111AAAABBBBFFFF';
    return wsReaderInst.getAsset('assets/world-50m.json', {
      dataset_access_token: datasetAccessToken
    }).then(asset => {
      expect(asset.queryString).to.equal(`dataset_access_token=${datasetAccessToken}`);
    });
  }));

  it('should correctly handle assets path with trailing /', sinon.test(function () {
    const wsReaderConfig = {
      path: 'http://localhost:3000/',
      reader: 'waffle',
      assetsPath: 'http://ws.gapminderdev.org/ddf/ql/assets/',
      dataset: 'open-numbers/globalis#development'
    };

    wsReaderInst.init(wsReaderConfig);

    this.stub(VizabiUtils, 'getRequest').callsFake((...args) => {
      const resolve = args[2];
      const reject = args[3];

      const asset = {
        url: args[0],
        queryString: args[1],
        isJsonAsset: args[4]
      };

      resolve(asset);
    });

    return wsReaderInst.getAsset('assets/world-50m.json').then(asset => {
      expect(asset.url).to.equal('http://ws.gapminderdev.org/ddf/ql/assets/open-numbers/globalis/development/assets/world-50m.json');
    });
  }));

  it('should explicitly say when there is no assetsPath provided', sinon.test(function () {
    const wsReaderConfig = {
      path: 'http://localhost:3000/',
      reader: 'waffle',
      dataset: 'open-numbers/globalis#development'
    };

    wsReaderInst.init(wsReaderConfig);

    this.stub(VizabiUtils, 'getRequest').callsFake((...args) => {
      const resolve = args[2];
      const reject = args[3];

      const asset = {
        url: args[0],
        queryString: args[1],
        isJsonAsset: args[4]
      };

      resolve(asset);
    });

    return wsReaderInst.getAsset('assets/world-50m.json').then(asset => {
      expect(asset.url).to.equal('/api/ddf/assets/open-numbers/globalis/development/assets/world-50m.json');
    });
  }));
});
