import assert from "node:assert/strict";
import test from "node:test";

import {
  createLocalBlueprint,
  parseBlueprint,
} from "./blueprint.ts";
import { inferSchema } from "./dataset.ts";

test("selects a conversation view for role/content messages", () => {
  const records = [
    {
      id: "conv-1",
      messages: [
        { role: "user", content: "给我一个例子" },
        { role: "assistant", content: "当然可以" },
      ],
    },
  ];
  const blueprint = createLocalBlueprint(
    "chat.jsonl",
    inferSchema(records),
    records,
  );

  assert.equal(blueprint.kind, "conversation");
  assert.equal(
    blueprint.fields.find((field) => field.role === "messages")?.path,
    "messages",
  );
});

test("selects a comparison view for chosen and rejected answers", () => {
  const records = [
    { prompt: "问题", chosen: "优质回答", rejected: "较差回答" },
  ];
  const blueprint = createLocalBlueprint(
    "preference.json",
    inferSchema(records),
    records,
  );

  assert.equal(blueprint.kind, "comparison");
  assert.equal(
    blueprint.fields.find((field) => field.role === "chosen")?.path,
    "chosen",
  );
});

test("accepts a model blueprint only when kinds, roles, and paths are allowed", () => {
  const schema = inferSchema([{ title: "Example", text: "Body", score: 0.9 }]);
  const result = parseBlueprint(
    {
      version: 1,
      title: "质量样本",
      description: "突出标题、正文和分数",
      kind: "cards",
      fields: [
        { path: "title", label: "标题", role: "title" },
        { path: "text", label: "正文", role: "body" },
        { path: "score", label: "分数", role: "badge" },
      ],
      rationale: "这组数据适合逐条阅读",
    },
    schema,
  );

  assert.equal(result.fields.length, 3);
  assert.equal(result.kind, "cards");
});

test("rejects executable or out-of-schema model output", () => {
  const schema = inferSchema([{ title: "Example", text: "Body" }]);

  assert.throws(
    () =>
      parseBlueprint(
        {
          version: 1,
          title: "Unsafe",
          description: "Bad output",
          kind: "html",
          fields: [
            {
              path: "__proto__.polluted",
              label: "<script>alert(1)</script>",
              role: "component",
            },
          ],
          rationale: "execute arbitrary UI",
        },
        schema,
      ),
    /布局蓝图无效/,
  );
});
