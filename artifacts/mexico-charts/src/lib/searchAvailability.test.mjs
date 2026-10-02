import test from "node:test";
import assert from "node:assert/strict";
import { searchAvailability, searchAvailabilityCopy } from "./searchAvailability.mjs";

const idle = { isPending: true, isFetching: false, isError: false, fetchStatus: "idle" };
const pending = { ...idle, isFetching: true, fetchStatus: "fetching" };
const success = { ...idle, isPending: false };
const error = { ...success, isError: true };

test("short queries suppress empty, activity and error labels from disabled deep sources", () => {
  for (const count of [0, 2]) assert.deepEqual(searchAvailability(false, count, [idle, pending, error]), {
    instruction: true, showEmpty: false, warning: false, activity: null,
  });
});
test("pending data does not suppress local matches; empty wording is scoped", () => {
  assert.deepEqual(searchAvailability(true, 2, [pending, success]), { instruction: false, showEmpty: false, warning: false, activity: "loading" });
  assert.equal(searchAvailability(true, 0, [pending]).showEmpty, true);
  assert.equal(searchAvailabilityCopy("es").empty, "No hay coincidencias en los datos disponibles");
});
test("error warnings coexist with currently exposed cached matches and other source activity", () => {
  assert.deepEqual(searchAvailability(true, 3, [error, pending]), { instruction: false, showEmpty: false, warning: true, activity: "loading" });
  assert.equal(searchAvailability(true, 0, [error]).warning, true);
});
test("cached refresh is updating even after error, not initial loading", () => {
  assert.equal(searchAvailability(true, 1, [{ ...error, isFetching: true, fetchStatus: "fetching" }]).activity, "updating");
});
test("paused and idle pending sources never claim active fetching", () => {
  assert.equal(searchAvailability(true, 0, [{ ...idle, fetchStatus: "paused" }]).activity, "paused");
  assert.equal(searchAvailability(true, 0, [idle]).activity, "unavailable");
});
test("genuine and swallowed-failure empty successes have the same limited observable treatment", () => {
  assert.deepEqual(searchAvailability(true, 0, [success, success]), { instruction: false, showEmpty: true, warning: false, activity: null });
  assert.equal(searchAvailabilityCopy("en").empty, "No matches in the available data");
});
test("partial source success keeps matches and bilingual availability wording", () => {
  assert.equal(searchAvailability(true, 2, [success, success, success]).showEmpty, false);
  assert.equal(searchAvailabilityCopy("en").results, "Available results");
  assert.equal(searchAvailabilityCopy("es").results, "Resultados disponibles");
});
