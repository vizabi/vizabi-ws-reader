import { WsJsonReader } from './ws-reader-wsjson';
import { BaseWsReader } from './ws-reader-base';

export const WsReader = {
  getReader(... readerPlugins) {
    Object.assign(BaseWsReader, ... readerPlugins);
    return Object.assign({}, BaseWsReader, WsJsonReader);
  }
};
