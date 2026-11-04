import test from "node:test";
import assert from "node:assert/strict";
import { buildForest, flattenTree } from "../mods/fleet/tree.js";
const spaces = [{ id: "box/s1", tabs: [{ id: "box/tab1" }] }, { id: "other/s1", tabs: [] }];
const root = { address: "box/t1", space: "box/s1", status: "working" };
const term = (id, parent, status = "working", state = "live") => ({ address: `box/${id}`, parent, status, state });

test("remote bare parent ids and out-of-order grandchildren stay in their machine's space", () => {
  const groups = buildForest(spaces, [root, { ...root, address: "other/t1", space: "other/s1" }], [
    term("t3", "t2"), term("t2", "t1"), term("t1"),
    { address: "other/t1", state: "live" },
  ]);
  assert.deepEqual(flattenTree(groups[0].roots).map(r => r.terminal.address), ["box/t1", "box/t2", "box/t3"]);
  assert.deepEqual(flattenTree(groups[1].roots).map(r => r.terminal.address), ["other/t1"]);
});

test("done and exited branches fold; a working grandchild keeps its done ancestor visible", () => {
  const groups = buildForest(spaces, [root], [term("t1"), term("t2", "t1", "done"),
    term("t3", "t1", undefined, "finished"), term("t4", "t1", "done"), term("t5", "t4")]);
  const rows = flattenTree(groups[0].roots);
  assert.deepEqual(rows.map(r => r.terminal.address), ["box/t1", "box/t4", "box/t5"]);
  assert.equal(rows[0].completed, 2);
  assert.deepEqual(flattenTree(groups[0].roots, new Set(["box/t1"])).map(r => r.terminal.address),
    ["box/t1", "box/t2", "box/t3", "box/t4", "box/t5"]);
});

test("a child promoted to a pane remains a single tree row", () => {
  const groups = buildForest(spaces, [root, { ...root, address: "box/t2" }], [term("t1"), term("t2", "box/t1")]);
  assert.equal(groups[0].roots.length, 1);
  assert.deepEqual(flattenTree(groups[0].roots).map(r => r.terminal.address), ["box/t1", "box/t2"]);
});

test("a shell window is excluded from the agent tree even when its program reports status", () => {
  const shell = { address: "box/t2", space: "box/s1" };
  const groups = buildForest(spaces, [root, { ...root, address: shell.address }], [term("t1"), term("t2", "t1")], [], [shell]);
  assert.deepEqual(flattenTree(groups[0].roots).map(r => r.terminal.address), ["box/t1"]);
  assert.deepEqual(groups[0].shells, [shell]);
});

test("cyclic parent data does not hang rendering", () => {
  const roots = [root, { ...root, address: "box/t2" }];
  const groups = buildForest(spaces, roots, [term("t1", "t2"), term("t2", "t1")]);
  assert.equal(flattenTree(groups[0].roots).length, 2);
});
