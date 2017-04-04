/* eslint-disable */

import {WsReaderWsjson} from './ws-reader-type-wsjson';

const READER_TYPES = {
  'default': WsReaderWsjson,
  'wsJson': WsReaderWsjson
};

export class WSReader {
  getReader(readerType) {
    return READER_TYPES[readerType] ? READER_TYPES[readerType] : READER_TYPES['default'];
  }
}