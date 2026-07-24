import assert from "node:assert/strict";
import test from "node:test";

import {
  activateSession,
  addSession,
  closeSession,
  createSessionState,
  updateSession,
} from "./dataset-sessions.ts";

interface TestWorkspace {
  fileName: string;
  query: string;
  page: number;
}

const sample = {
  id: "sample",
  value: { fileName: "sample.jsonl", query: "", page: 1 },
};

test("adds a dataset as the active tab without replacing earlier datasets", () => {
  const initial = createSessionState<TestWorkspace>(sample);
  const next = addSession(initial, {
    id: "customers",
    value: { fileName: "customers.json", query: "vip", page: 3 },
  });

  assert.deepEqual(next.tabs.map((tab) => tab.id), ["sample", "customers"]);
  assert.equal(next.activeId, "customers");
  assert.equal(next.tabs[0].value.fileName, "sample.jsonl");
});

test("switching tabs preserves each dataset's review state", () => {
  const withCustomers = addSession(createSessionState<TestWorkspace>(sample), {
    id: "customers",
    value: { fileName: "customers.json", query: "vip", page: 3 },
  });
  const updatedCustomers = updateSession(withCustomers, "customers", (workspace) => ({
    ...workspace,
    query: "priority",
    page: 7,
  }));

  const sampleActive = activateSession(updatedCustomers, "sample");
  const customersActive = activateSession(sampleActive, "customers");

  assert.equal(customersActive.tabs[1].value.query, "priority");
  assert.equal(customersActive.tabs[1].value.page, 7);
});

test("closing an active tab selects its right neighbor, then its left neighbor", () => {
  const first = createSessionState<TestWorkspace>(sample);
  const second = addSession(first, {
    id: "customers",
    value: { fileName: "customers.json", query: "", page: 1 },
  });
  const third = addSession(second, {
    id: "orders",
    value: { fileName: "orders.json", query: "", page: 1 },
  });

  const customersActive = activateSession(third, "customers");
  const afterCustomers = closeSession(customersActive, "customers");
  assert.equal(afterCustomers.activeId, "orders");

  const afterOrders = closeSession(afterCustomers, "orders");
  assert.equal(afterOrders.activeId, "sample");
});

test("keeps the final dataset tab open", () => {
  const initial = createSessionState<TestWorkspace>(sample);

  assert.strictEqual(closeSession(initial, "sample"), initial);
});
