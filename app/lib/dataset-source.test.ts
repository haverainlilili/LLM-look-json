import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchDatasetFromAddress,
  normalizeDatasetAddress,
} from "./dataset-source.ts";

test("normalizes a safe HTTPS dataset address and derives its file name", () => {
  const source = normalizeDatasetAddress(
    "  https://datasets.example.com/train/support.jsonl?download=1  ",
  );

  assert.equal(source.url.href, "https://datasets.example.com/train/support.jsonl?download=1");
  assert.equal(source.fileName, "support.jsonl");
});

test("rejects local paths, credentialed URLs, and insecure remote HTTP", () => {
  assert.throws(
    () => normalizeDatasetAddress("/Users/demo/private.json"),
    /本地路径.*系统文件选择器/,
  );
  assert.throws(
    () => normalizeDatasetAddress("file:///Users/demo/private.json"),
    /本地路径.*系统文件选择器/,
  );
  assert.throws(
    () => normalizeDatasetAddress("https://user:secret@example.com/data.json"),
    /不能包含用户名或密码/,
  );
  assert.throws(
    () => normalizeDatasetAddress("http://example.com/data.json"),
    /远程文件地址必须使用 HTTPS/,
  );
});

test("fetches with privacy-safe browser options and returns bounded text", async () => {
  let observedUrl = "";
  let observedInit: RequestInit | undefined;
  const result = await fetchDatasetFromAddress(
    "https://datasets.example.com/sample.json",
    64,
    async (input, init) => {
      observedUrl = String(input);
      observedInit = init;
      return new Response('{"id":1}', {
        status: 200,
        headers: { "content-length": "8" },
      });
    },
  );

  assert.equal(observedUrl, "https://datasets.example.com/sample.json");
  assert.equal(observedInit?.credentials, "omit");
  assert.equal(observedInit?.referrerPolicy, "no-referrer");
  assert.equal(result.fileName, "sample.json");
  assert.equal(result.text, '{"id":1}');
});

test("rejects declared and streamed responses beyond the byte cap", async () => {
  await assert.rejects(
    fetchDatasetFromAddress(
      "https://datasets.example.com/declared.json",
      64,
      async () =>
        new Response("{}", {
          headers: { "content-length": "65" },
        }),
    ),
    /不能超过 64 字节/,
  );

  await assert.rejects(
    fetchDatasetFromAddress(
      "https://datasets.example.com/streamed.json",
      64,
      async () => new Response(new Uint8Array(65)),
    ),
    /不能超过 64 字节/,
  );
});
