import { WsJsonReader } from './ws-reader-wsjson';
import { getBaseWsReader } from './ws-reader-base';
import * as ReaderUtils from './reader-utils-web';

export const WsReader = {
  getReader(... readerPlugins) {
    const webRequestAdapter = { ajax: ReaderUtils.ajax };
    const BaseWsReader = getBaseWsReader(webRequestAdapter);

    Object.assign(BaseWsReader, ... readerPlugins);

    return Object.assign({}, BaseWsReader, WsJsonReader);
  }
};
