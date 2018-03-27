import 'whatwg-fetch';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as sinonTest from 'sinon-test';
import * as RowUtils from '../src/row-utils';
import * as ReaderUtils from '../src/reader-utils-web';

import noop from 'lodash/noop';

sinon.test = sinonTest.configureTest(sinon);

describe('RowUtils', () => {
  describe('mapRows', () => {
    it('formats cells with identity as a default formatter', sinon.test(function () {
      const input = [
        {
          a: 'a1',
          b: 'b1',
          c: 'c1'
        },
        {
          a: 'a2',
          b: 'b2',
          c: 'c2'
        },
        {
          a: 'a3',
          b: ['b3.1', 'b3.2', 'b3.3'],
          c: 'c3'
        }
      ];

      const actual = RowUtils.mapRows(input);

      expect(actual).to.deep.equal(input);
    }));

    it('formats cells with the formatter given per key', sinon.test(function () {
      const input = [
        {
          a: Infinity,
          b: '1b',
          c: 'c1'
        },
        {
          a: NaN,
          b: '2',
          c: 'c2'
        },
        {
          a: 'Hello',
          b: 'b3',
          c: ['c3.1', 'c3.2', 'c3.3']
        }
      ];

      const actual = RowUtils.mapRows(input, { c: val => 'Foo!' });

      const expected = [
        {
          a: Infinity,
          b: '1b',
          c: 'Foo!'
        },
        {
          a: NaN,
          b: 2,
          c: 'Foo!'
        },
        {
          a: 'Hello',
          b: 'b3',
          c: [
            'Foo!',
            'Foo!',
            'Foo!'
          ]
        }
      ];

      expect(actual).to.deep.equal(expected);
    }));
  });

  describe('ajax', () => {
    const fetchOriginal = global.fetch;

    afterEach(() => {
      global.fetch = fetchOriginal;
    });

    it('makes request using default values for url, http method and json when they are not given', sinon.test(function () {
      global.fetch = sinon.stub().resolves({
        ok: true,
        text: noop
      });

      return ReaderUtils.ajax().then(() => {
        sinon.assert.calledOnce(global.fetch);
        sinon.assert.calledWith(global.fetch, '', { method: 'GET', headers: {} });
      });
    }));

    it('rejects request when response is not ok', sinon.test(function () {
      const errorMsg = 'You choose select column(s) \'FAKEFAKEFAKEFAKEFAKEFAKE\' which aren\'t present in choosen dataset';

      global.fetch = sinon.stub().resolves({
        ok: false,
        error: errorMsg
      });

      return ReaderUtils.ajax().catch(error => {
        expect(error.name).to.equal('WaffleServerError');
        expect(error.message).to.equal('WS response error');
        expect(error.details).to.equal(errorMsg);
      });
    }));

    it('rejects request by external reason (connection lost)', sinon.test(function () {
      global.fetch = sinon.stub().rejects(new Error('lost connection'));

      return ReaderUtils.ajax().catch(error => {
        expect(error.name).to.equal('WaffleServerError');
        expect(error.message).to.equal('Network error with status code 500');
      });
    }));

    it('knows how to handle json requests', sinon.test(function () {
      global.fetch = sinon.stub().resolves({
        ok: true,
        json: () => ({ hello: 'world!' })
      });

      return ReaderUtils.ajax({ url: '/server', json: true }).then(response => {
        sinon.assert.calledWithExactly(global.fetch, '/server', {
          method: 'GET',
          headers: { 'Content-Type': 'text/plain; charset=UTF-8' }
        });

        expect(response).to.deep.equal({ hello: 'world!' });
      });
    }));

    it('treats response as a simple text by default', sinon.test(function () {
      global.fetch = sinon.stub().resolves({
        ok: true,
        text: () => 'Hello from server!'
      });

      return ReaderUtils.ajax({ url: '/server' }).then(response => {
        sinon.assert.calledWithExactly(global.fetch, '/server', {
          method: 'GET',
          headers: { }
        });

        expect(response).to.equal('Hello from server!');
      });
    }));
  });
});
