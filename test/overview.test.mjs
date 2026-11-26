import test from 'node:test';
import assert from 'node:assert/strict';
import { composeOverview } from '../public/overview.js';

test('live realtime freshness and sampled mentions use the current clock even when daily polling has stalled', () => {
  const now = new Date();
  const day = 86_400_000;
  const state = {
    mode:'live', range:7, dataAsOf:new Date(now.getTime()-9*day).toISOString(),
    clients:[{id:'one',name:'Example Clinic'},{id:'two',name:'Example Market'}],
    bindings:[
      {id:'a',clientId:'one',source:'ga4',points:[],realtime:{observedAt:now.toISOString(),activeUsers:7}},
      {id:'b',clientId:'two',source:'ga4',points:[],realtime:{observedAt:new Date(now.getTime()-12*60_000).toISOString(),activeUsers:11}},
    ],
    mentions:[{clientId:'one',observedAt:now.toISOString(),mentioned:true}],
  };
  const vm = composeOverview(state);
  assert.equal(vm.metrics.active.value,7);
  assert.equal(vm.metrics.mentions.value,1);
  assert.equal(vm.metrics.clicks.value,null);
  assert.equal(vm.days.at(-1),new Date(now.getTime()-day).toISOString().slice(0,10));
});

test('a source gap is distinct from a true zero in the chart and dashboard total', () => {
  const now = new Date(), day = 86_400_000;
  const yesterday = new Date(now.getTime()-day).toISOString().slice(0,10);
  const state = {
    mode:'live',range:7,clients:[{id:'one',name:'Example Clinic'}],
    bindings:[{clientId:'one',source:'gsc',points:[{date:yesterday,clicks:0,impressions:100}]}],
  };
  const vm=composeOverview(state);
  assert.equal(vm.metrics.clicks.value,0);
  assert.equal(vm.metrics.clicks.series.at(-2),null);
  assert.equal(vm.metrics.clicks.series.at(-1),0);
  assert.equal(vm.metrics.clicks.delta,null);
});
