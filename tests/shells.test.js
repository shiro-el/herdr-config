import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

// Execute the actual module against only the documented host boundary.
async function host() {
  let state = { hidden: false, items: [
    { address: "box/t1", space: "box/s1", name: "app", open: true, overlay: "old" },
    { address: "box/t2", space: "box/s1", name: "closed", open: false, overlay: null },
  ] };
  const opened = [], closed = [];
  const context = vm.createContext({});
  const herdr = new vm.SyntheticModule(["shared", "setShared", "openOverlay", "closeOverlay"], function () {
    this.setExport("shared", () => state);
    this.setExport("setShared", (_key, value) => { state = value; });
    this.setExport("openOverlay", spec => { opened.push(spec); return `overlay-${opened.length}`; });
    this.setExport("closeOverlay", id => closed.push(id));
  }, { context });
  const mod = new vm.SourceTextModule(await fs.readFile(new URL("../mods/fleet/shells.js", import.meta.url), "utf8"), { context });
  await mod.link(() => herdr); await mod.evaluate();
  return { api: mod.namespace, opened, closed, state: () => state };
}

test("hide/show preserves the open set and never opens a manually closed shell", async () => {
  const h = await host();
  h.api.toggleShells();
  assert.deepEqual(h.closed, ["old"]);
  assert.equal(h.state().hidden, true);
  assert.equal(h.state().items[0].open, true);
  h.api.toggleShells();
  assert.equal(h.opened.length, 1);
  assert.equal(h.opened[0].key, "shell:box/t1");
  assert.equal(h.opened[0].layout.children[1].content.terminal, "box/t1");
  assert.equal(h.state().items[1].open, false);
});

test("restart restores visible shells; hidden windows stay hidden until requested", async () => {
  const h = await host();
  h.api.toggleShells(); h.api.restoreShells();
  assert.equal(h.opened.length, 0);
  h.api.showShell("box/t2");
  assert.equal(h.state().hidden, false);
  assert.equal(h.opened.length, 2);
  assert.equal(h.state().items[1].open, true);
  assert.equal(h.opened[1].key, "shell:box/t2");
  h.api.restoreShells();
  assert.equal(h.opened.length, 4);
});
