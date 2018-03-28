import { WsJsonReader } from './ws-reader-wsjson';
import { getBaseWsReader } from './ws-reader-base';
import * as ReaderUtils from './reader-utils-node';

export { WsError } from './ws-error';

export const WsReader = {
  getReader(... readerPlugins) {
    const backendRequestAdapter = { ajax: ReaderUtils.ajax };
    const BaseWsReader = getBaseWsReader(backendRequestAdapter);

    Object.assign(BaseWsReader, ... readerPlugins);

    return Object.assign({}, BaseWsReader, WsJsonReader);
  }
};
