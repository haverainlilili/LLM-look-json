import assert from "node:assert/strict";
import test from "node:test";

import { compareSchemaStructure } from "./schema-diff.ts";
import type { SchemaField } from "./dataset.ts";

function field(
  path: string,
  types: string[],
  overrides: Partial<SchemaField> = {},
): SchemaField {
  return {
    path,
    types,
    type: types.join(" | "),
    presence: 1,
    sample: "示例",
    depth: path.split(".").length - 1,
    ...overrides,
  };
}

test("treats sample, presence, depth, and field order changes as the same structure", () => {
  const before = [field("id", ["string"]), field("score", ["integer", "null"])];
  const after = [
    field("score", ["null", "integer"], { presence: 0.4, sample: "12", depth: 3 }),
    field("id", ["string"], { presence: 0.8, sample: "new-id" }),
  ];

  assert.deepEqual(compareSchemaStructure(before, after), {
    changed: false,
    added: [],
    removed: [],
    typeChanges: [],
  });
});

test("reports added and removed field paths", () => {
  const difference = compareSchemaStructure(
    [field("id", ["string"]), field("legacy", ["boolean"])],
    [field("id", ["string"]), field("category", ["string"])],
  );

  assert.equal(difference.changed, true);
  assert.deepEqual(difference.added, ["category"]);
  assert.deepEqual(difference.removed, ["legacy"]);
  assert.deepEqual(difference.typeChanges, []);
});

test("reports field type changes without treating the path as added or removed", () => {
  const difference = compareSchemaStructure(
    [field("score", ["integer"])],
    [field("score", ["number", "null"])],
  );

  assert.equal(difference.changed, true);
  assert.deepEqual(difference.added, []);
  assert.deepEqual(difference.removed, []);
  assert.deepEqual(difference.typeChanges, [
    { path: "score", before: ["integer"], after: ["null", "number"] },
  ]);
});
