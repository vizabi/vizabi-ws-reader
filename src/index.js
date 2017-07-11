import { WsJsonReader } from './ws-reader-wsjson';
import { BaseWsReader } from './ws-reader-base';

export const WsReader = {
  getReader() {
    return Object.assign({}, BaseWsReader, WsJsonReader);
  }
};
