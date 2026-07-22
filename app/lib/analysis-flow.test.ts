import assert from "node:assert/strict";
import test from "node:test";

import {
  completeAnalysisFlow,
  failAnalysisFlow,
  parseAnalysisFailure,
  parseAnalysisTrace,
  startAnalysisFlow,
} from "./analysis-flow.ts";

test("shows the four honest stages while MING is running", () => {
  const flow = startAnalysisFlow(18, 5);

  assert.equal(flow.status, "running");
  assert.deepEqual(
    flow.steps.map((step) => step.status),
    ["complete", "active", "pending", "pending"],
  );
  assert.match(flow.steps[0].detail, /18 个字段/);
  assert.match(flow.steps[0].detail, /5 条样本/);
});

test("marks validation as the exact failed stage without claiming later work ran", () => {
  const flow = failAnalysisFlow(
    "validation",
    "布局字段或视图类型未通过安全白名单。",
  );

  assert.equal(flow.status, "error");
  assert.deepEqual(
    flow.steps.map((step) => step.status),
    ["complete", "complete", "error", "pending"],
  );
  assert.equal(flow.steps[2].detail, "布局字段或视图类型未通过安全白名单。");
});

test("records provider timing when all stages complete", () => {
  const flow = completeAnalysisFlow({ providerStatus: 200, durationMs: 842 });

  assert.equal(flow.status, "success");
  assert.ok(flow.steps.every((step) => step.status === "complete"));
  assert.match(flow.steps[1].detail, /HTTP 200/);
  assert.match(flow.steps[1].detail, /842 ms/);
});

test("parses only bounded, allowlisted diagnostics from the API", () => {
  const failure = parseAnalysisFailure({
    error: {
      code: "MODEL_PROVIDER_ERROR",
      message: "模型服务拒绝了请求。",
      stage: "provider",
      detail: "模型服务返回 HTTP 401，请检查 API Key。",
    },
  });

  assert.deepEqual(failure, {
    code: "MODEL_PROVIDER_ERROR",
    message: "模型服务拒绝了请求。",
    stage: "provider",
    detail: "模型服务返回 HTTP 401，请检查 API Key。",
  });
  assert.equal(
    parseAnalysisFailure({ error: { code: "x", message: "x", stage: "shell" } }),
    null,
  );
});

test("accepts only bounded provider timing metadata", () => {
  assert.deepEqual(
    parseAnalysisTrace({
      meta: { trace: { providerStatus: 200, durationMs: 1_240 } },
    }),
    { providerStatus: 200, durationMs: 1_240 },
  );
  assert.equal(
    parseAnalysisTrace({
      meta: { trace: { providerStatus: 999, durationMs: -1 } },
    }),
    null,
  );
});
