import { expect } from 'chai';

import { WsJsonReader } from '../src/ws-reader-wsjson';
import { BaseWsReader } from '../src/ws-reader-base';
import { WsReader } from '../src';

let wsReader;

describe('WsReader', () => {
  beforeEach(() => {
    wsReader = WsReader.getReader();
  });

  it('produces a reader out of Base and WsJson readers', () => {
    const props = new Set(Object.keys(WsJsonReader).concat(Object.keys(BaseWsReader)));

    const containsAllRequiredProps = [... props].every(prop => prop in wsReader);

    expect(containsAllRequiredProps).to.be.true;
  });
});
