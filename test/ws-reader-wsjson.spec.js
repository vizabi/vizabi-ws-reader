import { expect } from 'chai';
import * as sinon from 'sinon';
import * as sinonTest from 'sinon-test';
import * as ReaderUtils from '../src/reader-utils';

import { WsJsonReader } from '../src/ws-reader-wsjson';

sinon.test = sinonTest.configureTest(sinon);

let wsReader;

describe('WsJsonReader', () => {
  beforeEach(() => {
    wsReader = Object.assign({}, WsJsonReader);
  });

  describe('_parse', () => {
    it('transforms WsJson into POJO', sinon.test(function () {
      const mapRowsSpy = this.spy(ReaderUtils, 'mapRows');

      const wsJson = {
        headers: ['a', 'b', 'c'],
        rows: [
          ['a1', { hello: 'world' }, 'c1'],
          ['a2', null, 'c2'],
          ['a3', 'b3', undefined]
        ]
      };

      const parsers = { stub: true };

      return wsReader._parse(wsJson, parsers).then(pojo => {
        expect(pojo).to.deep.equal([
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
        ]);

        sinon.assert.calledWith(mapRowsSpy, pojo, parsers);
      });
    }));
  });
});
