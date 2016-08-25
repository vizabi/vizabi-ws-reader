/* eslint-disable */

import {WsReaderWsjson} from './ws-reader-type-wsjson';
import {WsReaderDdfjson} from './ws-reader-type-ddfjson';

const READER_TYPES = {
  'default': WsReaderWsjson,
  'wsJson': WsReaderWsjson,
  'ddfJson': WsReaderDdfjson
  //'json': ...
};

//wsReader = new WSReader().getReader('ddfJson');
//wsReader = new WSReader().getReader('wsJson');

export class WSReader {
  getReader(readerType) {

    // check that type available
    const readerTypeConstructor = typeof READER_TYPES[readerType] != 'undefined' ?
      READER_TYPES[readerType] :
      READER_TYPES['default'];

    return new readerTypeConstructor();
  }
}