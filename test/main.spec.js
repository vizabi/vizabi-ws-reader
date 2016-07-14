

import _ from 'lodash';
import test from 'ava';
import {WSReader} from '../dist/bundle';

test('Reader', t => {
  
  const wsReader = new WSReader();

  t.true(!!wsReader);
  t.pass();

});

test.cb('WS Reader Test', t => {

  const wsReader = new WSReader();
  let wsReaderData = wsReader.getData();
  
  t.true(_.isArray(wsReaderData));
  t.pass();

});