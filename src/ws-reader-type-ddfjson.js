/* eslint-disable */

import {WsReaderBase} from './ws-reader-type-base';
import {Unpack} from './unpack';
import {VizabiUtils} from './vizabi-utils';

// Init Base Class
const WsReaderDdfjson = WsReaderBase();

// Redefine Functionality
WsReaderDdfjson._parseResponsePacked = function(resolve, reject, path, query, parsers, resp, done) {
  const self = this;
  Unpack(resp, function (err, unpackedJson) {
    if(err) {
      VizabiUtils.error("Unpack error: ", err);
      reject({
        'message' : 'Unpack error',
        'data': err
      });
      return;
    }
    unpackedJson.forEach(function(value){
      for(let objKey in value) {
        if(!(typeof value[objKey] == 'undefined' || value[objKey] === null)) {
          value[objKey] = value[objKey].toString();
        }
      }
    });
    const respReady = VizabiUtils.mapRows(unpackedJson, parsers);
    done(resolve, reject, path, query, respReady);
  });
};

module.exports = {WsReaderDdfjson};