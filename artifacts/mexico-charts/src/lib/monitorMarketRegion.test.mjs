import test from "node:test";
import assert from "node:assert/strict";
import { monitorMarketRegion } from "./monitorMarketRegion.mjs";
test("corrects only the known Puebla/CMX presentation conflict without mutating source", () => {
  const market = Object.freeze({name:"Puebla",countryCode:"MX",region:"CMX",currentListeners:935867});
  assert.equal(monitorMarketRegion(market), "Puebla");
  assert.equal(market.region,"CMX");
  assert.equal(market.currentListeners,935867);
  assert.equal(monitorMarketRegion({...market,name:"Mexico City"}),"CMX");
  assert.equal(monitorMarketRegion({...market,countryCode:"US"}),"CMX");
  assert.equal(monitorMarketRegion({...market,region:null}),"MX");
  assert.equal(monitorMarketRegion({...market,region:"PUE"}),"PUE");
});
