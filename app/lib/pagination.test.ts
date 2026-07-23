import assert from "node:assert/strict";
import test from "node:test";

import { paginationForIndex, pageStartIndex } from "./pagination.ts";

test("calculates the page containing the active record", () => {
  assert.deepEqual(paginationForIndex(53, 25, 27), {
    page: 2,
    pageCount: 3,
    start: 25,
    end: 50,
  });
});

test("clamps requested pages and active indexes to the available records", () => {
  assert.equal(pageStartIndex(53, 25, 999), 50);
  assert.equal(pageStartIndex(53, 25, -2), 0);
  assert.deepEqual(paginationForIndex(53, 25, 999), {
    page: 3,
    pageCount: 3,
    start: 50,
    end: 53,
  });
});

test("represents an empty result set without inventing a page", () => {
  assert.equal(pageStartIndex(0, 25, 1), 0);
  assert.deepEqual(paginationForIndex(0, 25, 0), {
    page: 0,
    pageCount: 0,
    start: 0,
    end: 0,
  });
});
