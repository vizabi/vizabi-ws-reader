/* eslint-disable */

//const WSReader = require('dist/bundle');
import {WSReader} from 'src/dist/bundle';

const wsReader = new WSReader();
const wsReaderInst = wsReader.getReader();

const wsReaderConfig = {
  'parsers': {},
  'path': 'http://localhost:3000/',
  'reader': 'waffle',
  'splash': true
};
const wsReaderQuery = {
  'select': ['geo', 'time', 'population'],
  'grouping': {'geo': undefined, 'time': undefined},
  'where': {'geo': ['afr', 'chn'], 'time': ['1800', '1950:2000', '2015'], 'geo.cat': ['country', 'region']}
};

wsReaderInst.init(wsReaderConfig);
const wsResult = wsReaderInst.read(wsReaderQuery);

wsResult.then(function () {
  const wsReaderData = wsReaderInst.getData();
  console.log('wsReaderData', wsReaderData);
});

console.log('wsReader Done');
