/* eslint-disable */

import {VizabiPromise} from './vizabi-promise';
import {QueryEncoder} from './query-encoder';
import {Utils} from './utils';
import {Unpack} from './unpack';
import cloneDeep from 'lodash/cloneDeep';

var FILE_CACHED = {}; //caches files from this reader
var FILE_REQUESTED = {}; //caches files from this reader

export class WSReader {

  getReader() {

    const ERROR_NETWORK = 'Connection Problem';
    const ERROR_RESPONSE = 'Bad Response';
    const ERROR_ORDERING = 'Cannot sort response. Column does not exist in result.';
    const ERROR_PARAM_PATH = 'Missing base path for waffle reader';

    return {

      init(reader_info) {

        this._name = 'waffle';
        this._data = [];
        this._basepath = reader_info.path;
        this._parsers = reader_info.parsers;

        if (!this._basepath) {
          Utils.error(ERROR_PARAM_PATH);
        }

        // UPDATE
        // http://localhost:3000/api/graphs/stats/vizabi-tools"

        // *** /api/graphs/stats/vizabi-tools
        // *** /api/ddf/entities

        // *** /api/graphs/stats/vizabi-tools
        // *** /api/ddf/datapoints

        this._predefined_path = {
          'old_path':'/api/graphs/stats/vizabi-tools',
          'datapoints':'/api/ddf/datapoints',
          'entities':'/api/ddf/entities'
        };

        this._data = [];
      },

      read(query, language) {

        var p = new VizabiPromise();

        // START :: improvements

        // encode query and check path
        var encodedQuery = this._encodeQuery(query);
        var path = this._basepath + '?' + encodedQuery;

        // END :: improvements

        this._data = [];

        //if cached, retrieve and parse
        if (FILE_CACHED.hasOwnProperty(path)) {
          this._parse(p, query, FILE_CACHED[path]);
          return p;
        }
        //if requested by another hook, wait for the response
        if (FILE_REQUESTED.hasOwnProperty(path)) {
          return FILE_REQUESTED[path];
        }
        //if not, request and parse
        FILE_REQUESTED[path] = p;

        Utils.getRequest(
          path,
          [],
          this._readCallbackSuccess.bind(this, p, path, query),
          this._readCallbackError.bind(this, p, path, query),
          true
        );

        return p;
      },

      getData() {
        return this._data;
      },







      _encodeQuery: function (params) {

        var _params = cloneDeep(params.where);

        // START :: improvements

        // 1. detect additional where parameters

        if(params.where) {
          for(let whereKey in params.where) {
            if(whereKey.indexOf(".") != -1) {
              let whereKeyPart = whereKey.split(".");
              let whereKeyPrefix = whereKeyPart[0];
              let whereDataLength = params.where[whereKey].length;
              for(let whereKeyIndex = 0; whereKeyIndex < whereDataLength; whereKeyIndex++) {
                if(params.where[whereKey][whereKeyIndex] != 'unstate') {
                  let generatedKey = whereKeyPrefix + '.is--' + params.where[whereKey][whereKeyIndex];
                  _params[generatedKey] = 1;
                }
              }
              delete _params[whereKey];
            }
          }
        }

        // 2. detect destination

        let pathOldKey = 'old_path';
        let pathKey = 'datapoints';
        if(params.select) {
          let selectLength = params.select.length;
          for(let selectIndex = 0; selectIndex < selectLength; selectIndex++) {
            if(params.select[selectIndex].indexOf(".") != -1) {
              pathKey = 'entities';
              break;
            }
          }
        }

        // 3. update path with new one

        this._basepath = this._basepath
          .split(this._predefined_path[pathOldKey])
          .join(this._predefined_path[pathKey]);

        // 4. update select statement

        let paramKey = [];
        if(params.select) {
          let paramSelectNew = [];
          let selectLength = params.select.length;
          for(let selectIndex = 0; selectIndex < selectLength; selectIndex++) {
            if(params.select[selectIndex].indexOf(".") != -1) {
              let selectKeyPart = params.select[selectIndex].split(".");
              let selectKeyPrefix = selectKeyPart[0];
              let selectKeyCleared = selectKeyPart[1];
              // store select prefix into param Key
              if(paramKey.indexOf(selectKeyPrefix) == -1) {
                paramKey.push(selectKeyPrefix);
              }
              // update select statement
              paramSelectNew.push(selectKeyCleared);
              //params.select.splice(selectIndex, 1);
            } else {
              paramSelectNew.push(params.select[selectIndex]);
            }
          }
          params.select = paramSelectNew;

          // update parameter Key for DataPoints request
          if(pathKey == 'datapoints') {
            Array.prototype.push.apply(paramKey, paramSelectNew.slice(0, 2));
          }
        }

        // 5. add Key parameter

        if(paramKey.length) {
          _params.key = paramKey;
          params.key = paramKey;
        }

        // 6. add request type into Base Query
        params.pathKey = pathKey;

        // END :: improvements

        _params.select = params.select;
        _params.gapfilling = params.gapfilling;

        // todo: WS doesn't support value `*` for geo parameter
        // remove this condition when geo will be removed from params.where (when you need all geo props)
        if (_params.geo && _params.geo.length === 1 && _params.geo[0] === '*') {
          delete _params.geo;
        }

        var result = [];

        // create `key=value` pairs for url query string
        Object.keys(_params).map(function (key) {
          var value = QueryEncoder.encodeQuery(_params[key]);
          if (value) {
            result.push(key + '=' + value);
          }
        });

        return result.join('&');
      },

      _readCallbackSuccess: function (p, path, query, resp) {

        console.log("Success", path, query, resp);

        if (!resp) {
          Utils.error("Empty json: " + path);
          p.reject({
            'message' : ERROR_RESPONSE,
            'data': path
          });
          return;
        }

        // START :: improvements

        let self = this;

        Unpack(resp, function (err, unpackedJson) {

          if(err) {
            Utils.error("Unpack error: ", err);
            p.reject({
              'message' : 'Unpack error',
              'data': err
            });
            return;
          }

          // Fix :: prefix

          /*
           if (['', '', ''].some(val => val === key)) {
           skip
           }
           */

          if(query.pathKey == 'entities' && query.key) {
            let prefixKey = query.key[0];
            unpackedJson.forEach(function(value, index){
              for(let keyEntity in value) {
                if (
                  keyEntity.indexOf("shape") == -1 &&
                  query.key.indexOf(keyEntity) == -1
                ) {
                  let currValue = value[keyEntity];
                  value[prefixKey + '.' + keyEntity] = currValue;
                  delete value[keyEntity];
                }
                if (keyEntity.indexOf("shape") > -1) {
                  let currValue = value[keyEntity];
                  value[keyEntity] = "<svg xmlns='http://www.w3.org/2000/svg' version='1.1' viewBox='0 0 833 532'><path id='" + value[prefixKey] + "' d='" + currValue + "'/></svg>";
                }
              }
            });
          }

          resp = Utils.mapRows(unpackedJson, self._parsers);
          console.log("VIZABI::CUSTOM WS READER", resp);





          if(path == 'http://localhost:3000/api/ddf/entities?geo.is--country=1&key=geo&select=geo,name,world_4region') {
            resp = [{
              "geo": "chl",
              "geo.name": "Chile",
              "geo.world_4region": "americas"
            }];
          }

          if(path == 'http://localhost:3000/api/ddf/entities?geo.is--world_4region=1&key=geo&select=geo,name,shape_lores_svg') {
            resp = [{"geo":"africa","geo.name":"Africa","shape_lores_svg":"<svg xmlns='http://www.w3.org/2000/svg' version='1.1' viewBox='0 0 584.5 364.5'><path id='africa' d='M322.7,114.7l-1-1.8l-6.5,2.3l-16-4.8l-2.3,1.7l-1.8,4.5l-16.9-8.6l-0.2-0.6l-0.3-5.5l-2-2.8l-29,4.4l-0.2-0.4 l-1.7,0.2l-0.1,1.1l-6.7,7l-0.5,1.9l-0.6,0.7l-0.3,3.3l-15.3,23.7l0.6,13.2l-1.4,3l1.1,7.6l12.1,17.9l6,2.8l7.1-1.9l4.5,0.8 l13.7-3.3l3.9,4.5h3.5l1.6,1.4l1.8,3.6l-1.1,10.7l9.2,27.4l-4,14.6l8.5,30.7l1.1,1.1v0.7h0.5l3.5,12.5l2,1.7l11.9-0.6l15-18.2v-3.9 l5.1-4.5l1.1-4.2l-1.1-5.9l10.5-12.2l0.6-0.3l1.6-3.7l-3.4-24l25-43.3l-13.1,1.1l-1.8-1.1l-24.7-48.6l0.9-0.4l0.6-1L322.7,114.7  M360.1,233.2l2.3,1.7l-8.6,30.5l-4.3-0.6l-2-7.6l2.8-14.6l6.4-4.4l2.8-4.9L360.1,233.2z'/></svg>"},{"geo":"americas","geo.name":"Americas","shape_lores_svg":"<svg xmlns='http://www.w3.org/2000/svg' version='1.1' viewBox='0 0 584.5 364.5'><path id='americas' d='M134.8,152l-11.4,1.8l-3.1-1.7l5.3-1.3l-0.7-1.1l-3.3-1.4h-0.1l-8.1-0.9l-0.3-0.3l-0.3-1.5l-6.2-3.6l-3.4,0.8 l-1.6,1.3l-1.2-0.5l-0.7-1.7l3.8-1.6l9.1,0.7l9.5,5.3l0,0l3.3,1.8l1.7-0.5l6.6,2.8L134.8,152 M183.7,25.4l-0.5-1.5l-2.6-2.2 l-2.1-0.6l-2.9-2.2l-18.2-2.2l-5.1,3.7l2,4.3l-6,2.2l1-1.7l-4.6-1.9l-0.5-1.7l-1.1-1.2l-2.9,0.5l-2.1,4.2l-5.8,2.5l-15.5-2.2 l10.5-1.7l-1.3-4l-11.6-0.4l-3.2-1.5L96,20.7h5.8l4,1.9l-1.7,1l0.8,1l7.2,2.3l-78.9-5.3l-10,3.6l-0.4,4.4L18,31.1l1,1.8l1.7,1.2 l-5.5,4.5l-0.4,5.6L13.8,46l1.8,1.8l-4.4,6.2L22,43.7l1.8-0.5l1.3-1.2l13.4,4l4,4.2l-1.3,14l1.6,2.6l-3.3,1.3L39.4,70l2.7,2.6 L28.6,96.9l1.6,11.2l4.8,5.6l-0.2,3.4l2.5,6.1l-0.5,5l6.6,11.9L38,121.5l1.7-4l3.4,6.1l0.3,2.2l7.1,13.1l1.1,9.2l11.1,8.7l1.6,0.3 l1.3,0.9l5.5,1.2l3.4-0.9l5.5,4.2l0.3,0.5l0.8,0.3l2.1,1.9l5.5,0.5l0.2,0.6l0.8,0.3l4.8,8.9l2.3,1.5l0.2,0.5l7.1,3.4l1.6-1.7 l-5.1-2.2l-1.3-15.6l-6.3-2.2l-3.7,0.3v-4.6l3.7-8.9l-5.2-0.9l-0.5,0.3L83,151l-6.3,2.2l-4-2.8l-3.2-8.9l3.2-11.8l0.5-0.3l0.2-1.2 l2.6-3.1l8.5-3.6l6.3,1.8l4.5-3.1l9.2,1.1l2.5,3.1l1.5,7.8l1.3,1.8l2.1-4.5l-1.1-5l1.6-7l13.7-12.3l0.2-3.7l0.8-1.7l0.9-0.2l0.7,0.5 l0.6-1.9l15-8.8l2.2-3.9l11.9-5.1l-2.2,3.6l11.4-3.8l-5.2-1.7l-1.8-2.8l1.6-4.2l-0.8-0.9h-4.2l0.8-1.5l19.5-3.2l1.6,2.8l-4.5,4.2 l6,1.7l5.3-2.2l-6.3-7.6l4.5-6.1l-1.1-0.6l-0.2-0.5h-3.2l-3.7-13.4l-7.7,3.1l-1.8-1.9l0.2-3.9l-2.3-2.5l-3.4-1.5l-6.6,1.9l-2.1,4.2 l-1.1,0.6l-1.3,2.2l-0.3,3.4l-10,9.5l-0.8,2.8l-1.8,1.9l-2.1,0.3l-1.8-2.5l1.1-4.8l-11.9-6.1l-3.1-5.1l15-12l1.3,0.3l5.1-1.2 l1.1-1.2l0.4-1.2l3.4-0.3l-1.7,4.8L147,34l4.6,0.7l-2.2-2.9l-2.1-1.2l8.2-2.8l0.3-0.6l2-1.7l0.7,0.1l8.1-4.2l7.4,5.3l0.2,1.5l-6,1.5 l-1.8,2.2l3.7,5.3l3.4,1.2l2.3-2.2l2.9-1.2L179,33l-0.2-1.9l7.7-1.7L183.7,25.4 M119.7,74.5l0.8,3.1l1.7,1.8l3.3-0.2l5.4,4.7 l2.7,0.2l-0.5,1.7l-4.7-0.4l0.2-1.2l-2.6-0.9l-2,0.6l-2.6,3.4l3.1,1.7l-3.2,2.3l-2.6-1.2l0.1-9.3l-9.6,9.9L108,88l4.5-7l4.3-2 l-5.1-2.1l-4.8,0.5l0.2-1.7l1.3-1.2l8.7-2.2L119.7,74.5 M205.9,223.1l-1.3,3.1H204l-7.1,11.2l-1.9,18.2l-3.1,6.1h-0.5v0.6l-0.8,0.3 l-1.1,1.2l-2.7-0.3l-9.4,6.7l-7.7,21.6l-3.9,3.3l-5.1-1.1l2.1,3.3l0.5,5.3l-7.9,3.3l-1.4,1.5l-0.5,3.6l-1.1,0.6l-1.1-0.3l-1.8,0.9 l1.8,6.1l-1.8,5.6l3.4,6.1l-2,5.9l0.5,3.1l11.1,8.2l-0.2,0.5l-9.3-0.6l-4.3-5.1l-4.7-1.7l-8.6-17.1l0.5-1.7l-6-12.3l-4.5-56.7 l-12.4-10.2l-4.2-8.1l-0.8-0.6l-9.8-21.5l1.1-2.2l-0.3-2.6l-0.5-0.8l7.9-15.3l0.3-5.6l-1-2.8l1-3.9l1.8-0.3l9.7-8.2l2.1,0.3l0.8,5.1 l2.7-5.1l1.3-0.3l4.2,2.8h0.9l0.2,0.6l14.8,3.9l1.6,1.4l0.3,0.6l7.9,6.7l7.7,0.9l4.3,4l2,6.3l-1,4.6l4.4,1.4l1.1,2.2l5.2-1.1 l2.1,1.1l2.6,4l2.9-0.9l9,1.9l8.6,5.8L205.9,223.1'/></svg>"},{"geo":"asia","geo.name":"Asia","shape_lores_svg":"<svg xmlns='http://www.w3.org/2000/svg' version='1.1' viewBox='0 0 584.5 364.5'><path id='asia' d='M322.9,118.9l22.8,42.5l13.5-5.9l16.8-19l-7.3-6.5l-0.7-3.4h-0.1l-5.7,5.2l-0.9,0.1l-3.2-4.4l-0.4-0.2l-0.7,1.7 l-1.2-0.4l-4.1-11.4l0.2-0.5l1.9-1.2l5.1,6.8l6.2,2.7l0.8-0.2l1.1-1.1l1.6,0.4l2.9,2.6l0.4,0.8l16.4,0.8l6.9,6.5l0.4,0.1l1.4-0.3 l0.3,0.1l-1.7,2.5l2.9,2.8h0.7l3.3-3.3l0.5,0.3l9.2,32.1l4,3.7l1.3-1.3h0.2l1.7,1.3l1.4,6.6l1.6,0.9l1.7-2.9l-2.3-7.3l-0.1,0.3v-0.2 l-1.7,0.6l-1.3-1.1l1.2-14.3l14.3-17.6l5.9-1.7l0.3,0.1l3.1,4.5l0.8,0.2l0.9,1.5l0.8,0.3l4.7,10.3l0.2,0.1l2-0.6l5.4,10.1l-0.3,10.5 l2.8,3.7l0,0l4.2,10.8l1.8,1.7l-1.1,2.4l-0.8-0.6l-1.9-4l-1.7-1.4l-0.3-0.9l-5.5-3.5l-2.4-0.3l-0.2,1.2l19.8,28.5l2.6-3.6l-5.7-11.2 l0.9-4l0.7-0.2l0.2-2.3l-9.3-18.6l-0.3-8.9l1.4-1.5l6.7,7.8l1.4,0.3l1.1-0.6l0.1,0.1l-0.2,3.4l0.6,0.5l0.5,0.2l7.4-7.9l-2-10.4 l-6.9-9.5l4.9-6l0.8,0.2l0.8,0.5l1.7,3.9l2.9-4.7l10.1-3.6l5.1-8.1l1.6-9.9l-2.5-2l1.1-1.7l-7.5-11.5l3.5-4.7l-6.1-0.9l-3.5-3.7 l4.1-4.3l0.8-0.1l1.4,0.9l0.6,2.9l2.8-1.3l3.9,1.4l0.9,3.2l2.3,0.5l5,9h0.4l2.3-2.4h0.3l1-1.5l-1.7-3.8l-5.8-5.9l2.1-4v-3.6l2.6-2.4 l0.5,0.1l0.2-0.1l-3.5-15.2l-0.2,0.1v-0.1l-9.3,1.2l-7.3-9.3L464,58.8l-0.8,1.9L441.2,60l-1.5-1.8l-0.2,0.1l0,0l-7.3,4.1l-7.5-3 l-0.5,0.3l-1.8-0.8l-0.9-1.2l-0.3,0.1l-0.1-0.1l-5.7-0.4l-0.3-0.2l0,0l0,0l-1,0.5l-1.5,4.5l-4.2,2.7l-16.8-4.4L377.5,50l0,0l-0.2,1 l1.8,6.7l-13.3,3l-9.2-3.8l-1.1,3.1l-6.7-1.6l-0.1,0.1h-0.2l-4.4,6.8l3.8,3.8l0.6,2.7l0,0l0,0L352,71l2.6,2.2V74l-2.3,1.9l-0.8,1.6 l1.6,3.9l0.9,0.3l1,1.1l2.6,0.9l1.7,1.7l-0.2,1.1l-1.5,2.8l2.1,3.7v4.5l-1.3,1.4l-3.8-0.9l-4.7-5.1v-0.6l-1.4-1.4l-3.9,2.1l-2.4-2.1 l-1.6,0.9l-0.3,5.1l-15.2,4.7l-1.7,9.8l-2.5,1.7L322.9,118.9 M531.1,99.3l-1,2l-4,1.7l-2.4,3l-3.3-2.5l-6.4,0.2l-0.2-0.7l8.9-4.2 l3.7-4.9l-0.6-3.3l-3.2-5.1l-0.7-0.4v-5.1l1.4-2.6l1.7,0.3l0.6,0.7h0.8l1.1,0.8l1.3,0.3l0.6,1.9l-1.7,2l-2.6-1.2L531.1,99.3  M500.5,130.3l1.9-0.9l-0.8,6.3l-1.6-0.3L500.5,130.3 M515.9,180.5l-1.7,0.4l-2.2-3.3l-3.6-2.2l4.3-2.5l0.9-3.1l-0.3-4.1l-4.6-2.1 l-2,0.5l-5.1,8.5l-2.4,0.3l-0.2-3.4l0.8-0.7l4.2-9.3l-1.8-3.7l1.4-9.3l2.4,1.8l1.6,3.6l-0.5,4.8l8,6.4l0.1-0.1l3.1,11.2L515.9,180.5 L515.9,180.5L515.9,180.5 M497.7,179.5l2.6,0.9l1.1,1.9l-1.8,5.1l0.8,7l-6,10.9l-9.2-1.7l-2.9-10.9L497.7,179.5L497.7,179.5  M509,194.8l-1.8,0.1L509,194.8 M515,193.9l-1.7,2.2l-2.4-0.2l-1.9-1.1l-3.3,1.3l-0.3,1.9l1.2,1.4l2.1-0.3l0.9-0.7l1.1,0.1l0.3,1.2 l-1.9,2.6l0.7,5.6l-2.3-2l-1-2l-1.5,1l0.9,5.2l-3.1-0.4l0.2-2.8l-1.4-2.5l2.9-10.5l3.2-1.6l3.8,1.2l3.4-1.1L515,193.9 M530.7,198.1 l2.5,0.5l0.4,0.4l2,5.3l2.1-2.2l4.2-1.7l14.5,11.5l2.4,0.5l4-2.6l-1.2,4.7l-3.5,1.4l-0.5,1.4l0.1,1.3l4.4,6.5l-4.4-1.5l-5.2-7.5 l-5.6,4.4l-5.6-2l-1.2-1.5l1.3-1.5l-1.9-2.4l-0.3-0.8l-8.5-5l-0.9-4.7l-3.4-3.1l2.4-1.4H530.7 M476.6,212.1l19.1,5l3.1-0.8l4.4,1.4 l3.3-0.9l12.4,2.1l-0.1,0.6l-8.2,4v-1.9l-35.4-5.6l-1.5-1.8l2.5-1.9H476.6 M569.4,280.1l-19,14.6l-0.7-1.1l2.2-4.6l5.1-3l7.4-9.7 l0.9-4.3l4.8,5.1L569.4,280.1 M554.3,267.3l-11.1,18.2l-5.7,3.1l-4.8,7.7l-2.5,0.5l-0.6-1.9l0.5-3.4l2.8-2.9l-6.6-0.8l-1.6-1.4 l-1.7-8.4l-0.9-0.9l-3.1,1.1l-5.2-3.9l-32.3,7.3l-2.3-1.9l2.3-4.5l0.6-21.9l1.8-2.5l13.9-6.4l4.3-4.8l0.3-0.9l10-9.2l4.2,1.9l5.5-7 l4.2-1.4l4.9,2l-1.1,5l2.8,4.8l4.5,2.8l3.2-4.5l2.5-11.7l4.6,10.8v7.6l7.7,18.5L554.3,267.3L554.3,267.3L554.3,267.3L554.3,267.3 L554.3,267.3L554.3,267.3'/></svg>"},{"geo":"europe","geo.name":"Europe","shape_lores_svg":"<svg xmlns='http://www.w3.org/2000/svg' version='1.1' viewBox='0 0 584.5 364.5'><path id='europe' d='M556.7,26.9l-35.5-7.3l-3.5,1.4l-49.9-5.2l-2.7,2l-45.8-4.1l-1.3-1.9l-15.3-2.2l-0.2,0.1h-0.1l-0.2,0.2l-6,0.6 l-0.5,0.5L372.4,17l-1.7,1.7l-5.8-3.1h-1.7l-1.5,3.7l1.8,2.5l-0.4,0.2l-10.1-1.5l-6.8,1.9l-5.3-0.6l-7.2,2.6l-4.2-1h-0.1l-3.1,3.2 l-0.9,0.2l-2.6,2.2l-2.3,0.8l-1.6,2h-1.7l-5.1-5.1l-1-0.2l-0.1-0.5l1.3-0.9l8.4,1.6l0.5-0.1l2.4-1.8l-0.8-0.9l-20.2-5.5l-16.9,3.4 L268,37l0.8,6.1l3.2,1.7l4-1l1.5,0.9l2.6,5.5h0.8l0.7,1.2l0.8,0.2l7.9-9.7l-2.9-5.4l8.5-8.9h0.5l1.3,1.7l-2.7,6.6l0.8,2.8l11.9,2.4 l-4,1.8l-3.5-0.3l-1.5,1.2l1,1.6l-0.1,2.2l-0.9-0.6H297l-1.8,1.2l-0.5,3.9l-2.3,2.2h-4.3l-4.2,1.9l-6.8-0.7l-0.6-0.4l2.5-1.7 l0.5-1.2l-0.9-1.7l-0.2-0.1l-2.3,0.5l-0.2-0.1l-0.2-3.4l-0.4-0.1l-2.6,3.9l1.3,3.7l-1.4,1.7L269,57l-18.9,13.1l0.1,1l1.7,1.6 l0.8,0.3l1.3,2.2l0.3,3.6l-3.1,4.5l-9.7-0.9l-1.3,1.5L239,97.9l0.4,1.1l5.1,3.1l0.2,0.8l1.6-0.2l0.1-0.2h0.1v-0.1l7.9-4.5l10-14.3 l10-2.8l1.2,0.5l11,11.5l0.2,2.3l-2,1.8l-1.9-0.4l-1.8,0.5l3.8,3.9l1.1-0.7l3.7-5.6l0.2-0.5l-0.9-1.9l0.2-0.4l2.3,0.3l0.8-1 l-1.7-0.9l-8.7-7.6l-0.5-4.5l1.4,0.2l10.4,8l3.4,9l1,0.5l0.5,0.6v1.5l4.5,6.1v0.4l0.7,1.1l3.7,1.3l1.4-1.6l-3.8-2.3l-0.1-1.7 l2.2-2.6l-6.3-6.3l5.6-2.2L306,90l5.8,8l4.2-0.6l2.7,0.9l1,4.7l0.7-0.1l1.8-2l-1.3-1.7l0.2-0.9h4.3l0.3,2.7l15.2-4.7l0.4-5.1 l1.5-0.9l2.5,2l3.9-2.1l1.4,1.5l0.3-3.9l-3.1-5.3l-1.3-8.6l2.9-2.5l-0.6-2.7l-3.8-3.8l4.5-6.9l6.8,1.6l1.1-3.1l9.2,3.8l13.3-3.1 l-1.8-6.7l0.2-1l8.7,7.4l22.2,7.4l4.3-2.7l1.5-4.5l1-0.5l0.2,0.2l6,0.4l1,1.2l1.7,0.8l0.5-0.3l7.5,2.9l7.5-4.2l1.5,1.8l22.1,0.8 l0.7-1.8l23.5-1.4l7,9.2l9.6-1.2l3.4,15.2l1,1.1l-0.2,0.2l1.7,1.7l0.5,0.1l1.8-2.2l1.6-5.3L508,56.7l-2.9-2.2l-5.5,0.3l-2.6-2.5 l1.8-7.8l0.5-0.3l0.2-0.9l3.4-1.7l14.2,0.6l1.3-4.8l1.6-1.2l0.4-0.1l4.3,1.2l0.1-0.1l0.2,0.1l3.1-2.5l1.7,0.9l-1,12l6.9,15.9l3.1-3 l0.1-0.3l2.3,1.1l0.8-2.2l-1.1-8.7l-4.8-5.8l0.1-2.6l0.8-1.5l4.5-2.2l2.2,0.2l4-3.7l2.1-0.3l1.1-1.7l-5.2-2.5l-0.5-1.7l2.9-1.7 l8.2,2.2l0.9-0.2l0.8-1.2L556.7,26.9 M331,87l-11.6-3.1l-8.9,2.9l-0.2-0.1l-0.5-1.9l2.9-7l2.9-2.5h1.7l2.1,1.1l2.3-1.7l1.8-3.4 l1.8-0.6l2.1,0.6l-0.8,3.9l7.7,7.3L331,87 M252.8,18.2l-5.8,5.6l-3.7,1.1l-1.1,4.3l-2.2,1.7l-0.2,1.2l0.9,1.7l7.8,1.2l-2.4,2.9 l-4.6,1.7l-5.9-2.9l2-1.8l1.9-0.8l-2.5-2.1l-11.4,1.7l-4.7,3.1l-8,1.7L203,49l-3.4,0.3l-3.7-2.8l-1.3-10.6l5.2-4.5l1.1-2l-1.9-3.3 l-0.5-0.3v-0.6l-0.5-0.3v-0.6l-0.6-0.3l-1.1-1.4l-3.1-1.4h-5.5l-4-1.7l71.2-3.4L252.8,18.2 M258.9,60.7l0.7,1.2l-10.5,1.5l3.4-1.5 l-0.1-1.5l-2.7-0.9l4.2-4.9l-2.7-2.7l-5.9,7.4l-4.4,0.8l1.1-2.7l-0.2-2.7l8.5-4.8l0.3-3.8l1-1.3l1.3,0.4l0.2,1.1l1.3,0.3l-0.8,3.2 l3.3,2.4l1.7,5.1l2.6,0.9L258.9,60.7'/></svg>"}];
          }

          if(path == 'http://localhost:3000/api/ddf/datapoints?time=2015&geo.is--country=1&key=geo,time&select=geo,time,life_expectancy_years,income_per_person_gdppercapita_ppp_inflation_adjusted,population_total') {
            resp = [{
              "geo": "chl",
              "time": "2015-01-01T00:00:00.000Z",
              "life_expectancy_years": 79.3,
              "income_per_person_gdppercapita_ppp_inflation_adjusted": 22460,
              "population_total": 17950000
            }];
          }

          if(path == 'http://localhost:3000/api/ddf/datapoints?time=1800:2016&geo.is--country=1&key=geo,time&select=geo,time,life_expectancy_years,income_per_person_gdppercapita_ppp_inflation_adjusted,population_total') {
            resp = [{"geo":"chl","time":"1892-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":3044,"population_total":null},{"geo":"chl","time":"1939-01-01T00:00:00.000Z","life_expectancy_years":41.73,"income_per_person_gdppercapita_ppp_inflation_adjusted":4535,"population_total":null},{"geo":"chl","time":"2015-01-01T00:00:00.000Z","life_expectancy_years":79.3,"income_per_person_gdppercapita_ppp_inflation_adjusted":22460,"population_total":17950000},{"geo":"chl","time":"1826-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":998,"population_total":null},{"geo":"chl","time":"1901-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":3338,"population_total":null},{"geo":"chl","time":"1814-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1028,"population_total":null},{"geo":"chl","time":"1966-01-01T00:00:00.000Z","life_expectancy_years":61.42,"income_per_person_gdppercapita_ppp_inflation_adjusted":7026,"population_total":8803000},{"geo":"chl","time":"1865-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1751,"population_total":null},{"geo":"chl","time":"1802-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1027,"population_total":null},{"geo":"chl","time":"2003-01-01T00:00:00.000Z","life_expectancy_years":77.8,"income_per_person_gdppercapita_ppp_inflation_adjusted":15500,"population_total":15730000},{"geo":"chl","time":"1853-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1395,"population_total":null},{"geo":"chl","time":"1978-01-01T00:00:00.000Z","life_expectancy_years":68.6,"income_per_person_gdppercapita_ppp_inflation_adjusted":7122,"population_total":10910000},{"geo":"chl","time":"1940-01-01T00:00:00.000Z","life_expectancy_years":42.75,"income_per_person_gdppercapita_ppp_inflation_adjusted":4625,"population_total":5108000},{"geo":"chl","time":"1927-01-01T00:00:00.000Z","life_expectancy_years":37.25,"income_per_person_gdppercapita_ppp_inflation_adjusted":4023,"population_total":null},{"geo":"chl","time":"1820-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1029,"population_total":820900},{"geo":"chl","time":"1906-01-01T00:00:00.000Z","life_expectancy_years":30.8,"income_per_person_gdppercapita_ppp_inflation_adjusted":3620,"population_total":null},{"geo":"chl","time":"1844-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1159,"population_total":null},{"geo":"chl","time":"1996-01-01T00:00:00.000Z","life_expectancy_years":75.6,"income_per_person_gdppercapita_ppp_inflation_adjusted":13500,"population_total":14400000},{"geo":"chl","time":"1984-01-01T00:00:00.000Z","life_expectancy_years":71.2,"income_per_person_gdppercapita_ppp_inflation_adjusted":7160,"population_total":11920000},{"geo":"chl","time":"1805-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1027,"population_total":null},{"geo":"chl","time":"1871-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1904,"population_total":null},{"geo":"chl","time":"1945-01-01T00:00:00.000Z","life_expectancy_years":47.23,"income_per_person_gdppercapita_ppp_inflation_adjusted":4935,"population_total":null},{"geo":"chl","time":"1832-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":998,"population_total":null},{"geo":"chl","time":"1918-01-01T00:00:00.000Z","life_expectancy_years":28.27,"income_per_person_gdppercapita_ppp_inflation_adjusted":4340,"population_total":null},{"geo":"chl","time":"1883-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":2815,"population_total":null},{"geo":"chl","time":"1969-01-01T00:00:00.000Z","life_expectancy_years":63.18,"income_per_person_gdppercapita_ppp_inflation_adjusted":7364,"population_total":9377000},{"geo":"chl","time":"1957-01-01T00:00:00.000Z","life_expectancy_years":57.33,"income_per_person_gdppercapita_ppp_inflation_adjusted":6016,"population_total":7183000},{"geo":"chl","time":"1987-01-01T00:00:00.000Z","life_expectancy_years":73.1,"income_per_person_gdppercapita_ppp_inflation_adjusted":7851,"population_total":12510000},{"geo":"chl","time":"1888-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":2753,"population_total":null},{"geo":"chl","time":"1963-01-01T00:00:00.000Z","life_expectancy_years":59.81,"income_per_person_gdppercapita_ppp_inflation_adjusted":6538,"population_total":8238000},{"geo":"chl","time":"1823-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":986,"population_total":null},{"geo":"chl","time":"1975-01-01T00:00:00.000Z","life_expectancy_years":67.2,"income_per_person_gdppercapita_ppp_inflation_adjusted":6058,"population_total":10420000},{"geo":"chl","time":"1811-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1028,"population_total":null},{"geo":"chl","time":"2012-01-01T00:00:00.000Z","life_expectancy_years":79,"income_per_person_gdppercapita_ppp_inflation_adjusted":21050,"population_total":17390000},{"geo":"chl","time":"2000-01-01T00:00:00.000Z","life_expectancy_years":77.2,"income_per_person_gdppercapita_ppp_inflation_adjusted":14610,"population_total":15170000},{"geo":"chl","time":"1862-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1596,"population_total":null},{"geo":"chl","time":"1936-01-01T00:00:00.000Z","life_expectancy_years":39.59,"income_per_person_gdppercapita_ppp_inflation_adjusted":4091,"population_total":null},{"geo":"chl","time":"1850-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1389,"population_total":1414000},{"geo":"chl","time":"1849-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1334,"population_total":null},{"geo":"chl","time":"1924-01-01T00:00:00.000Z","life_expectancy_years":33.9,"income_per_person_gdppercapita_ppp_inflation_adjusted":4488,"population_total":null},{"geo":"chl","time":"1828-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":996,"population_total":null},{"geo":"chl","time":"1903-01-01T00:00:00.000Z","life_expectancy_years":31.7,"income_per_person_gdppercapita_ppp_inflation_adjusted":3213,"population_total":null},{"geo":"chl","time":"1879-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":2353,"population_total":null},{"geo":"chl","time":"1954-01-01T00:00:00.000Z","life_expectancy_years":56.37,"income_per_person_gdppercapita_ppp_inflation_adjusted":5519,"population_total":6709000},{"geo":"chl","time":"1867-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1685,"population_total":null},{"geo":"chl","time":"1942-01-01T00:00:00.000Z","life_expectancy_years":44.78,"income_per_person_gdppercapita_ppp_inflation_adjusted":4600,"population_total":null},{"geo":"chl","time":"1993-01-01T00:00:00.000Z","life_expectancy_years":75.1,"income_per_person_gdppercapita_ppp_inflation_adjusted":11290,"population_total":13780000},{"geo":"chl","time":"1880-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":2605,"population_total":2277000},{"geo":"chl","time":"1841-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1119,"population_total":null},{"geo":"chl","time":"1915-01-01T00:00:00.000Z","life_expectancy_years":32.08,"income_per_person_gdppercapita_ppp_inflation_adjusted":3562,"population_total":null},{"geo":"chl","time":"1981-01-01T00:00:00.000Z","life_expectancy_years":70.5,"income_per_person_gdppercapita_ppp_inflation_adjusted":8454,"population_total":11400000},{"geo":"chl","time":"1834-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1016,"population_total":null},{"geo":"chl","time":"1885-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":2678,"population_total":null},{"geo":"chl","time":"1960-01-01T00:00:00.000Z","life_expectancy_years":58.45,"income_per_person_gdppercapita_ppp_inflation_adjusted":6020,"population_total":7696000},{"geo":"chl","time":"2008-01-01T00:00:00.000Z","life_expectancy_years":78.9,"income_per_person_gdppercapita_ppp_inflation_adjusted":18700,"population_total":16650000},{"geo":"chl","time":"1858-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1559,"population_total":null},{"geo":"chl","time":"1933-01-01T00:00:00.000Z","life_expectancy_years":39.24,"income_per_person_gdppercapita_ppp_inflation_adjusted":3227,"population_total":null},{"geo":"chl","time":"1998-01-01T00:00:00.000Z","life_expectancy_years":76.5,"income_per_person_gdppercapita_ppp_inflation_adjusted":14450,"population_total":14790000},{"geo":"chl","time":"1846-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1208,"population_total":null},{"geo":"chl","time":"1921-01-01T00:00:00.000Z","life_expectancy_years":31.76,"income_per_person_gdppercapita_ppp_inflation_adjusted":3495,"population_total":null},{"geo":"chl","time":"1972-01-01T00:00:00.000Z","life_expectancy_years":63.8,"income_per_person_gdppercapita_ppp_inflation_adjusted":7674,"population_total":9917000},{"geo":"chl","time":"1807-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1027,"population_total":null},{"geo":"chl","time":"1959-01-01T00:00:00.000Z","life_expectancy_years":58.06,"income_per_person_gdppercapita_ppp_inflation_adjusted":5699,"population_total":7521000},{"geo":"chl","time":"1897-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":3106,"population_total":null},{"geo":"chl","time":"1819-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1029,"population_total":null},{"geo":"chl","time":"1876-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":2080,"population_total":null},{"geo":"chl","time":"2014-01-01T00:00:00.000Z","life_expectancy_years":79.2,"income_per_person_gdppercapita_ppp_inflation_adjusted":21970,"population_total":17760000},{"geo":"chl","time":"1825-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":991,"population_total":null},{"geo":"chl","time":"1813-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1028,"population_total":null},{"geo":"chl","time":"1951-01-01T00:00:00.000Z","life_expectancy_years":55.55,"income_per_person_gdppercapita_ppp_inflation_adjusted":5279,"population_total":6278000},{"geo":"chl","time":"1864-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1710,"population_total":null},{"geo":"chl","time":"1912-01-01T00:00:00.000Z","life_expectancy_years":31.9,"income_per_person_gdppercapita_ppp_inflation_adjusted":4448,"population_total":null},{"geo":"chl","time":"1852-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1440,"population_total":null},{"geo":"chl","time":"1989-01-01T00:00:00.000Z","life_expectancy_years":72.7,"income_per_person_gdppercapita_ppp_inflation_adjusted":9016,"population_total":12930000},{"geo":"chl","time":"1891-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":3147,"population_total":null},{"geo":"chl","time":"1977-01-01T00:00:00.000Z","life_expectancy_years":68,"income_per_person_gdppercapita_ppp_inflation_adjusted":6675,"population_total":10750000},{"geo":"chl","time":"1900-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":3295,"population_total":2981000},{"geo":"chl","time":"1990-01-01T00:00:00.000Z","life_expectancy_years":73,"income_per_person_gdppercapita_ppp_inflation_adjusted":9193,"population_total":13140000},{"geo":"chl","time":"1938-01-01T00:00:00.000Z","life_expectancy_years":40.72,"income_per_person_gdppercapita_ppp_inflation_adjusted":4529,"population_total":null},{"geo":"chl","time":"1837-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1056,"population_total":null},{"geo":"chl","time":"1843-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1155,"population_total":null},{"geo":"chl","time":"1995-01-01T00:00:00.000Z","life_expectancy_years":75.2,"income_per_person_gdppercapita_ppp_inflation_adjusted":12760,"population_total":14190000},{"geo":"chl","time":"2005-01-01T00:00:00.000Z","life_expectancy_years":78.4,"income_per_person_gdppercapita_ppp_inflation_adjusted":16980,"population_total":16100000},{"geo":"chl","time":"1804-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1027,"population_total":null},{"geo":"chl","time":"1855-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1472,"population_total":null},{"geo":"chl","time":"1930-01-01T00:00:00.000Z","life_expectancy_years":38.38,"income_per_person_gdppercapita_ppp_inflation_adjusted":4145,"population_total":4309000},{"geo":"chl","time":"1831-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":985,"population_total":null},{"geo":"chl","time":"1917-01-01T00:00:00.000Z","life_expectancy_years":32.2,"income_per_person_gdppercapita_ppp_inflation_adjusted":4344,"population_total":null},{"geo":"chl","time":"1929-01-01T00:00:00.000Z","life_expectancy_years":38,"income_per_person_gdppercapita_ppp_inflation_adjusted":5019,"population_total":null},{"geo":"chl","time":"1894-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":3064,"population_total":null},{"geo":"chl","time":"1816-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1029,"population_total":null},{"geo":"chl","time":"1882-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":2838,"population_total":null},{"geo":"chl","time":"1968-01-01T00:00:00.000Z","life_expectancy_years":62.58,"income_per_person_gdppercapita_ppp_inflation_adjusted":7231,"population_total":9188000},{"geo":"chl","time":"1870-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1929,"population_total":1957000},{"geo":"chl","time":"1956-01-01T00:00:00.000Z","life_expectancy_years":56.99,"income_per_person_gdppercapita_ppp_inflation_adjusted":5584,"population_total":7020000},{"geo":"chl","time":"1822-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":990,"population_total":null},{"geo":"chl","time":"1908-01-01T00:00:00.000Z","life_expectancy_years":30.78,"income_per_person_gdppercapita_ppp_inflation_adjusted":4123,"population_total":null},{"geo":"chl","time":"1974-01-01T00:00:00.000Z","life_expectancy_years":66.1,"income_per_person_gdppercapita_ppp_inflation_adjusted":7070,"population_total":10260000},{"geo":"chl","time":"1810-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1028,"population_total":771400},{"geo":"chl","time":"1809-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1028,"population_total":null},{"geo":"chl","time":"1986-01-01T00:00:00.000Z","life_expectancy_years":72.6,"income_per_person_gdppercapita_ppp_inflation_adjusted":7483,"population_total":12300000},{"geo":"chl","time":"2011-01-01T00:00:00.000Z","life_expectancy_years":78.9,"income_per_person_gdppercapita_ppp_inflation_adjusted":20140,"population_total":17200000},{"geo":"chl","time":"1873-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":2119,"population_total":null},{"geo":"chl","time":"1899-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":3421,"population_total":null},{"geo":"chl","time":"1861-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1617,"population_total":null},{"geo":"chl","time":"1947-01-01T00:00:00.000Z","life_expectancy_years":48.86,"income_per_person_gdppercapita_ppp_inflation_adjusted":4598,"population_total":null},{"geo":"chl","time":"1935-01-01T00:00:00.000Z","life_expectancy_years":39.47,"income_per_person_gdppercapita_ppp_inflation_adjusted":3973,"population_total":null},{"geo":"chl","time":"1926-01-01T00:00:00.000Z","life_expectancy_years":36.13,"income_per_person_gdppercapita_ppp_inflation_adjusted":4163,"population_total":null},{"geo":"chl","time":"1941-01-01T00:00:00.000Z","life_expectancy_years":43.77,"income_per_person_gdppercapita_ppp_inflation_adjusted":4484,"population_total":null},{"geo":"chl","time":"1801-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1026,"population_total":null},{"geo":"chl","time":"1953-01-01T00:00:00.000Z","life_expectancy_years":56.08,"income_per_person_gdppercapita_ppp_inflation_adjusted":5811,"population_total":6561000},{"geo":"chl","time":"1840-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1117,"population_total":1183000},{"geo":"chl","time":"1839-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1062,"population_total":null},{"geo":"chl","time":"1914-01-01T00:00:00.000Z","life_expectancy_years":32.02,"income_per_person_gdppercapita_ppp_inflation_adjusted":3729,"population_total":null},{"geo":"chl","time":"1965-01-01T00:00:00.000Z","life_expectancy_years":60.86,"income_per_person_gdppercapita_ppp_inflation_adjusted":6451,"population_total":8612000},{"geo":"chl","time":"2002-01-01T00:00:00.000Z","life_expectancy_years":77.6,"income_per_person_gdppercapita_ppp_inflation_adjusted":15080,"population_total":15540000},{"geo":"chl","time":"1827-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1003,"population_total":null},{"geo":"chl","time":"1902-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":3443,"population_total":null},{"geo":"chl","time":"1878-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":2073,"population_total":null},{"geo":"chl","time":"1866-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1771,"population_total":null},{"geo":"chl","time":"1992-01-01T00:00:00.000Z","life_expectancy_years":74.8,"income_per_person_gdppercapita_ppp_inflation_adjusted":10740,"population_total":13570000},{"geo":"chl","time":"1845-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1181,"population_total":null},{"geo":"chl","time":"1983-01-01T00:00:00.000Z","life_expectancy_years":70.9,"income_per_person_gdppercapita_ppp_inflation_adjusted":6867,"population_total":11740000},{"geo":"chl","time":"1896-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":3216,"population_total":null},{"geo":"chl","time":"1971-01-01T00:00:00.000Z","life_expectancy_years":64,"income_per_person_gdppercapita_ppp_inflation_adjusted":7906,"population_total":9742000},{"geo":"chl","time":"1920-01-01T00:00:00.000Z","life_expectancy_years":31.84,"income_per_person_gdppercapita_ppp_inflation_adjusted":4092,"population_total":3760000},{"geo":"chl","time":"2007-01-01T00:00:00.000Z","life_expectancy_years":78.8,"income_per_person_gdppercapita_ppp_inflation_adjusted":18280,"population_total":16460000},{"geo":"chl","time":"1869-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1908,"population_total":null},{"geo":"chl","time":"1905-01-01T00:00:00.000Z","life_expectancy_years":31.1,"income_per_person_gdppercapita_ppp_inflation_adjusted":3395,"population_total":null},{"geo":"chl","time":"1857-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1508,"population_total":null},{"geo":"chl","time":"1932-01-01T00:00:00.000Z","life_expectancy_years":39.13,"income_per_person_gdppercapita_ppp_inflation_adjusted":2666,"population_total":null},{"geo":"chl","time":"1818-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1029,"population_total":null},{"geo":"chl","time":"1944-01-01T00:00:00.000Z","life_expectancy_years":46.41,"income_per_person_gdppercapita_ppp_inflation_adjusted":4633,"population_total":null},{"geo":"chl","time":"1884-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":2800,"population_total":null},{"geo":"chl","time":"1806-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1027,"population_total":null},{"geo":"chl","time":"2013-01-01T00:00:00.000Z","life_expectancy_years":79.1,"income_per_person_gdppercapita_ppp_inflation_adjusted":21750,"population_total":17580000},{"geo":"chl","time":"1887-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":2905,"population_total":null},{"geo":"chl","time":"1863-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1640,"population_total":null},{"geo":"chl","time":"1949-01-01T00:00:00.000Z","life_expectancy_years":53.22,"income_per_person_gdppercapita_ppp_inflation_adjusted":5056,"population_total":null},{"geo":"chl","time":"1962-01-01T00:00:00.000Z","life_expectancy_years":59.33,"income_per_person_gdppercapita_ppp_inflation_adjusted":6293,"population_total":8054000},{"geo":"chl","time":"1848-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1259,"population_total":null},{"geo":"chl","time":"1923-01-01T00:00:00.000Z","life_expectancy_years":32.79,"income_per_person_gdppercapita_ppp_inflation_adjusted":4237,"population_total":null},{"geo":"chl","time":"1988-01-01T00:00:00.000Z","life_expectancy_years":72.9,"income_per_person_gdppercapita_ppp_inflation_adjusted":8288,"population_total":12720000},{"geo":"chl","time":"1836-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1031,"population_total":null},{"geo":"chl","time":"1911-01-01T00:00:00.000Z","life_expectancy_years":31.62,"income_per_person_gdppercapita_ppp_inflation_adjusted":4333,"population_total":null},{"geo":"chl","time":"1824-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":962,"population_total":null},{"geo":"chl","time":"1875-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":2134,"population_total":null},{"geo":"chl","time":"1950-01-01T00:00:00.000Z","life_expectancy_years":55.4,"income_per_person_gdppercapita_ppp_inflation_adjusted":5196,"population_total":6143000},{"geo":"chl","time":"1980-01-01T00:00:00.000Z","life_expectancy_years":69.7,"income_per_person_gdppercapita_ppp_inflation_adjusted":8088,"population_total":11230000},{"geo":"chl","time":"1842-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1132,"population_total":null},{"geo":"chl","time":"1928-01-01T00:00:00.000Z","life_expectancy_years":37.62,"income_per_person_gdppercapita_ppp_inflation_adjusted":4849,"population_total":null},{"geo":"chl","time":"1881-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":2658,"population_total":null},{"geo":"chl","time":"1967-01-01T00:00:00.000Z","life_expectancy_years":61.99,"income_per_person_gdppercapita_ppp_inflation_adjusted":7114,"population_total":8995000},{"geo":"chl","time":"1916-01-01T00:00:00.000Z","life_expectancy_years":32.14,"income_per_person_gdppercapita_ppp_inflation_adjusted":4309,"population_total":null},{"geo":"chl","time":"1803-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1027,"population_total":null},{"geo":"chl","time":"1979-01-01T00:00:00.000Z","life_expectancy_years":69,"income_per_person_gdppercapita_ppp_inflation_adjusted":7603,"population_total":11070000},{"geo":"chl","time":"1893-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":3155,"population_total":null},{"geo":"chl","time":"1815-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1029,"population_total":null},{"geo":"chl","time":"2004-01-01T00:00:00.000Z","life_expectancy_years":78.1,"income_per_person_gdppercapita_ppp_inflation_adjusted":16260,"population_total":15910000},{"geo":"chl","time":"1854-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1421,"population_total":null},{"geo":"chl","time":"1833-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":994,"population_total":null},{"geo":"chl","time":"1919-01-01T00:00:00.000Z","life_expectancy_years":31.96,"income_per_person_gdppercapita_ppp_inflation_adjusted":3673,"population_total":null},{"geo":"chl","time":"1898-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":3441,"population_total":null},{"geo":"chl","time":"1907-01-01T00:00:00.000Z","life_expectancy_years":30.5,"income_per_person_gdppercapita_ppp_inflation_adjusted":3769,"population_total":null},{"geo":"chl","time":"2010-01-01T00:00:00.000Z","life_expectancy_years":78.8,"income_per_person_gdppercapita_ppp_inflation_adjusted":19200,"population_total":17020000},{"geo":"chl","time":"1860-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1632,"population_total":1669000},{"geo":"chl","time":"1946-01-01T00:00:00.000Z","life_expectancy_years":48.04,"income_per_person_gdppercapita_ppp_inflation_adjusted":5254,"population_total":null},{"geo":"chl","time":"1997-01-01T00:00:00.000Z","life_expectancy_years":76.1,"income_per_person_gdppercapita_ppp_inflation_adjusted":14190,"population_total":14590000},{"geo":"chl","time":"1973-01-01T00:00:00.000Z","life_expectancy_years":64.8,"income_per_person_gdppercapita_ppp_inflation_adjusted":7123,"population_total":10090000},{"geo":"chl","time":"1859-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1594,"population_total":null},{"geo":"chl","time":"1934-01-01T00:00:00.000Z","life_expectancy_years":39.36,"income_per_person_gdppercapita_ppp_inflation_adjusted":3826,"population_total":null},{"geo":"chl","time":"1985-01-01T00:00:00.000Z","life_expectancy_years":71.8,"income_per_person_gdppercapita_ppp_inflation_adjusted":7193,"population_total":12110000},{"geo":"chl","time":"1821-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":984,"population_total":null},{"geo":"chl","time":"1872-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":2017,"population_total":null},{"geo":"chl","time":"1958-01-01T00:00:00.000Z","life_expectancy_years":57.68,"income_per_person_gdppercapita_ppp_inflation_adjusted":6194,"population_total":7350000},{"geo":"chl","time":"1800-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1026,"population_total":771400},{"geo":"chl","time":"1851-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1413,"population_total":null},{"geo":"chl","time":"1937-01-01T00:00:00.000Z","life_expectancy_years":39.7,"income_per_person_gdppercapita_ppp_inflation_adjusted":4564,"population_total":null},{"geo":"chl","time":"1890-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":2948,"population_total":2624000},{"geo":"chl","time":"1976-01-01T00:00:00.000Z","life_expectancy_years":67.4,"income_per_person_gdppercapita_ppp_inflation_adjusted":6168,"population_total":10580000},{"geo":"chl","time":"1838-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1060,"population_total":null},{"geo":"chl","time":"1889-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":2786,"population_total":null},{"geo":"chl","time":"1964-01-01T00:00:00.000Z","life_expectancy_years":60.32,"income_per_person_gdppercapita_ppp_inflation_adjusted":6537,"population_total":8424000},{"geo":"chl","time":"1877-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1983,"population_total":null},{"geo":"chl","time":"1925-01-01T00:00:00.000Z","life_expectancy_years":35.02,"income_per_person_gdppercapita_ppp_inflation_adjusted":4613,"population_total":null},{"geo":"chl","time":"1952-01-01T00:00:00.000Z","life_expectancy_years":55.81,"income_per_person_gdppercapita_ppp_inflation_adjusted":5505,"population_total":6418000},{"geo":"chl","time":"1991-01-01T00:00:00.000Z","life_expectancy_years":74,"income_per_person_gdppercapita_ppp_inflation_adjusted":9747,"population_total":13350000},{"geo":"chl","time":"1913-01-01T00:00:00.000Z","life_expectancy_years":31.96,"income_per_person_gdppercapita_ppp_inflation_adjusted":4471,"population_total":null},{"geo":"chl","time":"2001-01-01T00:00:00.000Z","life_expectancy_years":77.4,"income_per_person_gdppercapita_ppp_inflation_adjusted":14920,"population_total":15360000},{"geo":"chl","time":"1812-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1028,"population_total":null},{"geo":"chl","time":"1994-01-01T00:00:00.000Z","life_expectancy_years":75.1,"income_per_person_gdppercapita_ppp_inflation_adjusted":11720,"population_total":13990000},{"geo":"chl","time":"1856-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1475,"population_total":null},{"geo":"chl","time":"1904-01-01T00:00:00.000Z","life_expectancy_years":31.4,"income_per_person_gdppercapita_ppp_inflation_adjusted":3437,"population_total":null},{"geo":"chl","time":"1955-01-01T00:00:00.000Z","life_expectancy_years":56.67,"income_per_person_gdppercapita_ppp_inflation_adjusted":5613,"population_total":6862000},{"geo":"chl","time":"2006-01-01T00:00:00.000Z","life_expectancy_years":78.6,"income_per_person_gdppercapita_ppp_inflation_adjusted":17550,"population_total":16280000},{"geo":"chl","time":"1817-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1029,"population_total":null},{"geo":"chl","time":"1868-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1752,"population_total":null},{"geo":"chl","time":"1943-01-01T00:00:00.000Z","life_expectancy_years":45.6,"income_per_person_gdppercapita_ppp_inflation_adjusted":4638,"population_total":null},{"geo":"chl","time":"1982-01-01T00:00:00.000Z","life_expectancy_years":70.9,"income_per_person_gdppercapita_ppp_inflation_adjusted":7182,"population_total":11570000},{"geo":"chl","time":"1931-01-01T00:00:00.000Z","life_expectancy_years":38.75,"income_per_person_gdppercapita_ppp_inflation_adjusted":3210,"population_total":null},{"geo":"chl","time":"1830-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":986,"population_total":969100},{"geo":"chl","time":"1829-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1002,"population_total":null},{"geo":"chl","time":"1895-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":3238,"population_total":null},{"geo":"chl","time":"1970-01-01T00:00:00.000Z","life_expectancy_years":63.8,"income_per_person_gdppercapita_ppp_inflation_adjusted":7382,"population_total":9562000},{"geo":"chl","time":"1808-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1028,"population_total":null},{"geo":"chl","time":"1874-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":2000,"population_total":null},{"geo":"chl","time":"1948-01-01T00:00:00.000Z","life_expectancy_years":51.04,"income_per_person_gdppercapita_ppp_inflation_adjusted":5263,"population_total":null},{"geo":"chl","time":"1847-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1222,"population_total":null},{"geo":"chl","time":"1835-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":1039,"population_total":null},{"geo":"chl","time":"2009-01-01T00:00:00.000Z","life_expectancy_years":78.8,"income_per_person_gdppercapita_ppp_inflation_adjusted":18330,"population_total":16830000},{"geo":"chl","time":"1910-01-01T00:00:00.000Z","life_expectancy_years":31.34,"income_per_person_gdppercapita_ppp_inflation_adjusted":4512,"population_total":3348000},{"geo":"chl","time":"1909-01-01T00:00:00.000Z","life_expectancy_years":31.06,"income_per_person_gdppercapita_ppp_inflation_adjusted":4098,"population_total":null},{"geo":"chl","time":"1922-01-01T00:00:00.000Z","life_expectancy_years":31.67,"income_per_person_gdppercapita_ppp_inflation_adjusted":3571,"population_total":null},{"geo":"chl","time":"1886-01-01T00:00:00.000Z","life_expectancy_years":32,"income_per_person_gdppercapita_ppp_inflation_adjusted":2753,"population_total":null},{"geo":"chl","time":"1961-01-01T00:00:00.000Z","life_expectancy_years":58.87,"income_per_person_gdppercapita_ppp_inflation_adjusted":6155,"population_total":7874000},{"geo":"chl","time":"1999-01-01T00:00:00.000Z","life_expectancy_years":76.9,"income_per_person_gdppercapita_ppp_inflation_adjusted":14160,"population_total":14980000}];
          }

          let respClone = cloneDeep(resp);
          console.log("OUTPUT", path, respClone);











          delete query.key;
          delete query.pathKey;


          //cache and resolve
          FILE_CACHED[path] = resp;

          self._parse(p, query, resp);
          FILE_REQUESTED[path] = void 0;
        });

        // END :: improvements
      },

      _readCallbackError: function (p, path, query, resp) {
        p.reject({
          'message' : ERROR_NETWORK,
          'data': path
        });
      },

      _parse: function (p, query, resp) {
        var data = resp;
        // sorting
        // one column, one direction (ascending) for now

        console.log("PARSE :: query", query);

        if(query.orderBy && data[0]) {
          if (data[0][query.orderBy]) {
            data.sort(function(a, b) {
              return a[query.orderBy] - b[query.orderBy];
            });
          } else {
            return p.reject({
              'message' : ERROR_ORDERING,
              'data': query.orderBy
            });
          }
        }

        this._data = data;
        p.resolve();
      }      

    };
  }
}