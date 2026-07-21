import assert from "node:assert/strict";
import test from "node:test";

import {
  createModelSamples,
  inferSchema,
  parseDatasetText,
  searchRecords,
} from "./dataset.ts";

test("parses a root JSON array as records", () => {
  const result = parseDatasetText(
    JSON.stringify([
      { id: 1, text: "第一条" },
      { id: 2, text: "第二条" },
    ]),
    "sample.json",
  );

  assert.equal(result.format, "json");
  assert.equal(result.recordPath, "$");
  assert.equal(result.records.length, 2);
  assert.deepEqual(result.records[1], { id: 2, text: "第二条" });
});

test("parses JSONL and reports the failing line", () => {
  const result = parseDatasetText(
    '{"id":1,"text":"hello"}\n{"id":2,"text":"world"}\n',
    "sample.jsonl",
  );

  assert.equal(result.format, "jsonl");
  assert.equal(result.records.length, 2);

  assert.throws(
    () => parseDatasetText('{"id":1}\nnot-json', "broken.jsonl"),
    /第 2 行/,
  );
});

test("discovers a nested conventional record array", () => {
  const result = parseDatasetText(
    JSON.stringify({
      metadata: { source: "demo" },
      payload: {
        records: [
          { prompt: "A", answer: "B" },
          { prompt: "C", answer: "D" },
        ],
      },
    }),
    "nested.json",
  );

  assert.equal(result.recordPath, "$.payload.records");
  assert.equal(result.records.length, 2);
});

test("keeps a single conversation object intact instead of treating messages as records", () => {
  const result = parseDatasetText(
    JSON.stringify({
      id: "conversation-1",
      messages: [
        { role: "user", content: "你好" },
        { role: "assistant", content: "你好！" },
      ],
      tags: ["greeting", "short"],
    }),
    "single-conversation.json",
  );

  assert.equal(result.recordPath, "$");
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].id, "conversation-1");
});

test("infers nested field types and presence rates", () => {
  const schema = inferSchema([
    {
      id: 1,
      messages: [
        { role: "user", content: "你好" },
        { role: "assistant", content: "你好！" },
      ],
      tag: "greeting",
    },
    {
      id: 2,
      messages: [{ role: "user", content: "天气" }],
    },
  ]);

  assert.equal(schema.find((field) => field.path === "messages")?.type, "array");
  assert.equal(
    schema.find((field) => field.path === "messages[].content")?.type,
    "string",
  );
  assert.equal(schema.find((field) => field.path === "tag")?.presence, 0.5);
});

test("searches nested record values case-insensitively", () => {
  const records = [
    { id: 1, profile: { name: "Ada Lovelace" } },
    { id: 2, profile: { name: "Grace Hopper" } },
  ];

  assert.deepEqual(searchRecords(records, "LOVELACE"), [records[0]]);
  assert.deepEqual(searchRecords(records, ""), records);
});

test("bounds and truncates samples sent to the model", () => {
  const records = Array.from({ length: 10 }, (_, index) => ({
    index,
    secretLikeLongText: "x".repeat(1_000),
  }));
  const samples = createModelSamples(records);

  assert.equal(samples.length, 5);
  assert.equal(
    (samples[0] as { secretLikeLongText: string }).secretLikeLongText.length,
    401,
  );
  assert.match(
    (samples[0] as { secretLikeLongText: string }).secretLikeLongText,
    /…$/,
  );
});
