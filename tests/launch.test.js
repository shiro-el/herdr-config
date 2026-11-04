import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

async function host() {
  const calls = [], overlays = [];
  let state = { hidden: false, items: [] };
  let facts = { agents: [], terminals: [], agent: "workstation/t1" };
  let receiveCommand, afterCommand;
  const focusCalls = [];
  const space = { id: "workstation/s1", name: "repo", folder: "/fallback", machine: "workstation", tabs: [{ id: "workstation/tab" }] };
  const context = vm.createContext({ console, localStorage: { getItem: () => null, setItem() {} } });
  const exports = {
    spaces: () => [space], agents: () => facts.agents, terminals: () => facts.terminals, machines: () => [],
    panes: () => [{ terminal: "workstation/t1", tab: "workstation/tab", cwd: "/repo/subdir" }],
    focused: () => ({ space: space.id, agent: facts.agent }),
    shared: () => state, setShared: (_k, v) => { state = v; },
    openOverlay: spec => { overlays.push(spec); return "overlay-1"; }, closeOverlay: () => {},
    hc: async args => { calls.push(["hc", args]); return { code: 0, stdout: '{"address":"t99"}', stderr: "" }; },
    exec: async (...args) => { calls.push(["exec", ...args]); return { code: 0, stdout: "/repo\n" }; },
    run: (command, args) => { focusCalls.push([command, args]); facts.agent = args.terminal; },
    notify: () => {}, nextCommand: () => new Promise(resolve => { receiveCommand = resolve; }),
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
  const cx = {
    timer: { every() {} },
    spawn: body => body(cx),
    notify: () => { if (afterCommand) { const done = afterCommand; afterCommand = null; done(); } },
  };
  return { fleet, calls, overlays, space, focusCalls, state: () => state,
    setFacts: values => { facts = { ...facts, ...values }; },
    start: () => fleet.init(undefined, cx),
    send: async command => {
      const finished = new Promise(resolve => { afterCommand = resolve; });
      receiveCommand(command); await finished;
    },
  };
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


async function navigationHost() {
  const h = await host();
  h.start();
  const terminal = (id, parent, status = "working") => ({
    address: `workstation/${id}`, parent, status, state: "live",
  });
  const root = { ...terminal("t1"), space: h.space.id };
  h.setFacts({ agents: [root], terminals: [root, terminal("t2", "t1", "done"),
    terminal("t4", "t1"), terminal("t5", "t4"), terminal("shell", "t1")] });
  h.state().items.push({ address: "workstation/shell", space: h.space.id });
  h.fleet.history.set("workstation", [
    { ...terminal("finished", "t1"), state: "finished" },
    terminal("stale", "t1"), // Gone from current facts, still live in the last history poll.
  ]);
  return h;
}

test("next/prev commands visit children and grandchildren, skip folded/finished/stale/shell rows, and wrap", async () => {
  const h = await navigationHost();
  h.fleet.selected = { kind: "terminal", address: "workstation/t5", space: h.space.id };
  for (const [command, expected] of [["next", "t4"], ["next", "t5"], ["next", "t1"],
    ["prev", "t5"], ["prev", "t4"], ["prev", "t1"]]) {
    await h.send(command);
    const [name, args] = h.focusCalls.at(-1);
    assert.equal(name, "agent.focus");
    assert.equal(args.terminal, `workstation/${expected}`);
    assert.equal(h.fleet.selected.address, args.terminal);
    assert.equal(h.fleet.selected.space, h.space.id);
  }
});

test("selection fallback retains a folded cursor's position and all-folded trees do nothing", async () => {
  const h = await navigationHost();
  h.setFacts({ agent: null });
  h.fleet.selected = { kind: "terminal", address: "workstation/t2", space: h.space.id };
  await h.send("next");
  assert.equal(h.fleet.selected.address, "workstation/t4");
  h.setFacts({ agent: null });
  h.fleet.selected = { kind: "terminal", address: "workstation/t2", space: h.space.id };
  await h.send("prev");
  assert.equal(h.fleet.selected.address, "workstation/t1");
  h.fleet.folded.add(h.space.id);
  const count = h.focusCalls.length;
  await h.send("next"); await h.send("prev");
  assert.equal(h.focusCalls.length, count);
  assert.equal(h.fleet.selected.address, "workstation/t1");
});
