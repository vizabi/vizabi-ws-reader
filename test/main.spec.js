/* eslint-disable */

import _ from 'lodash';
import test from 'ava';
import td from 'testdouble';

import {Utils} from '../src/vizabi-utils';
import {WSReader} from './../src/ws-reader';

test('Reader, simple test', t => {

  const wsReader = new WSReader();
  const wsReaderInst = wsReader.getReader();

  const language = 'en';
  const wsReaderConfig = {
    'parsers' : {},
    'path': "http://localhost:3000/",
    'reader': "waffle",
    'splash': true
  };
  const wsReaderQuery = {
    'select': ['geo', 'time', 'population'],
    'grouping': {'geo': undefined,'time': undefined},
    'where': {'geo': ['afr', 'chn'], 'time': ['1800', '1950:2000', '2015'], 'geo.cat': ['country', 'region']}
  };

  wsReaderInst.init(wsReaderConfig);
  const wsResult = wsReaderInst.read(wsReaderQuery, language);

  wsResult.then(function () {

    let wsReaderData = wsReaderInst.getData();
    console.log("wsReaderData", wsReaderData);

    t.true(_.isArray(wsReaderData));
    t.pass();

  });
});
