import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

async function host() {
  const calls = [], overlays = [];
  let state = { hidden: false, items: [] };
  const space = { id: "workstation/s1", name: "repo", folder: "/fallback", machine: "workstation", tabs: [{ id: "workstation/tab" }] };
  const context = vm.createContext({ console });
  const exports = {
    spaces: () => [space], agents: () => [], terminals: () => [], machines: () => [],
    panes: () => [{ terminal: "workstation/t1", tab: "workstation/tab", cwd: "/repo/subdir" }],
    focused: () => ({ space: space.id, agent: "workstation/t1" }),
    shared: () => state, setShared: (_k, v) => { state = v; },
    openOverlay: spec => { overlays.push(spec); return "overlay-1"; }, closeOverlay: () => {},
    hc: async args => { calls.push(["hc", args]); return { code: 0, stdout: '{"address":"t99"}', stderr: "" }; },
    exec: async (...args) => { calls.push(["exec", ...args]); return { code: 0, stdout: "/repo\n" }; },
    run: () => {}, notify: () => {}, nextCommand: () => new Promise(() => {}),
    theme: () => ({}), layout: () => ({}), window: () => ({}), setAgentOrder: () => {},
  };
  const module = (name, values) => new vm.SyntheticModule(Object.keys(values), function () {
    for (const [key, value] of Object.entries(values)) this.setExport(key, value);
  }, { context, identifier: name });
  const cache = new Map([
    ["herdr", module("herdr", exports)],
    ["gpui-kit", module("gpui-kit", { View: class {}, div() {}, image() {}, svg() {} })],
    ["gpui-base", module("gpui-base", { h_flex() {}, v_flex() {} })],
  ]);
  const load = async url => {
    if (!cache.has(url)) cache.set(url, new vm.SourceTextModule(await fs.readFile(new URL(url), "utf8"), { context, identifier: url }));
    return cache.get(url);
  };
  const main = await load(new URL("../mods/fleet/main.js", import.meta.url).href);
  await main.link((specifier, parent) => cache.get(specifier) ?? load(new URL(specifier, parent.identifier).href));
  await main.evaluate();
  const fleet = new main.namespace.default();
  fleet.known = new Map([["workstation/t1", { cwd: "/agent/current" }]]);
  return { fleet, calls, overlays, space, state: () => state };
}

test("agent launch uses the selected remote cwd, is kept and has no adoption labels or parent", async () => {
  const h = await host();
  h.fleet.selected = { kind: "terminal", address: "workstation/t1", space: h.space.id };
  await h.fleet.newShell();
  const args = h.calls[0][1];
  assert.equal(args[args.indexOf("--on") + 1], "workstation");
  assert.equal(args[args.indexOf("--cwd") + 1], "/agent/current");
  for (const flag of ["--keep", "--bg", "--no-parent", "--outlive-parent"]) assert.ok(args.includes(flag));
  assert.ok(!args.includes("--label"));
  assert.equal(h.overlays[0].layout.children[1].content.terminal, "workstation/t99");
  assert.equal(h.state().items[0].name, "current");
});

test("selecting a space uses its repo root on that space's machine", async () => {
  const h = await host();
  h.fleet.selected = { kind: "space", space: h.space.id };
  await h.fleet.newShell();
  assert.deepEqual(h.calls[0].slice(0, 2), ["exec", "git"]);
  assert.equal(h.calls[0][3].on, "workstation");
  const args = h.calls[1][1];
  assert.equal(args[args.indexOf("--cwd") + 1], "/repo");
  assert.equal(h.state().items[0].name, "repo");
});
