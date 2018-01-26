import { WsJsonReader } from './ws-reader-wsjson';
import { getBaseWsReader } from './ws-reader-base';
import * as ReaderUtils from './reader-utils-node';

export const WsReader = {
  getReader(... readerPlugins) {
    const backendRequestAdapter = { ajax: ReaderUtils.ajax };
    const backendHomepointAdapter = { getHref: () => null };
    const BaseWsReader = getBaseWsReader(backendRequestAdapter, backendHomepointAdapter);

    Object.assign(BaseWsReader, ... readerPlugins);

    return Object.assign({}, BaseWsReader, WsJsonReader);
  }
};
