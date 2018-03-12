import { WsJsonReader } from './ws-reader-wsjson';
import { getBaseWsReader } from './ws-reader-base';
import * as ReaderUtils from './reader-utils-web';

export const WsReader = {
  getReader(... readerPlugins) {
    const webRequestAdapter = { ajax: ReaderUtils.ajax };
    const webHomepointAdapter = { getHref: () => window.location.href };
    const BaseWsReader = getBaseWsReader(webRequestAdapter, webHomepointAdapter);

    Object.assign(BaseWsReader, ... readerPlugins);

    return Object.assign({}, BaseWsReader, WsJsonReader);
  }
};
