import test from "node:test";
import assert from "node:assert/strict";
import { missingArtworkBatches, validateArtworkResponse } from "./monitorArtwork.mjs";
test("artwork batches cover the full missing catalog, including tracks past 36", () => {
  const items = Array.from({length:313}, (_,i) => ({type:"track", key:String(i).padStart(22,"0"), artworkUrl:i<57?'https://i.scdn.co/image/known':null}));
  const batches = missingArtworkBatches(items);
  assert.equal(batches.flat().length,256); assert.ok(batches.every(batch=>batch.length<=12));
  assert.equal(batches.flat().at(-1), `track:${String(312).padStart(22,"0")}`);
});
test("artwork responses cannot attach another resource's image", () => {
  const key=`track:${'a'.repeat(22)}`;
  assert.equal(validateArtworkResponse({items:[{resource:key,artworkUrl:null,status:'pending'}]},[key]).length,1);
  assert.throws(()=>validateArtworkResponse({items:[{resource:'other',artworkUrl:'https://i.scdn.co/image/wrong',status:'loaded'}]},[key]));
});
