// Derived from Herdr's shipped agents mod; row geometry, icons and status UI retained.
// Structural changes: spaces, recursive core parents, completed-child folds and shell windows.
import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, terminals, panes, focused, spaces, machines, run, theme, shared,
  setShared, setAgentOrder, window, layout, hc, exec, nextCommand, notify } from "herdr";
import { buildForest, flattenTree, qualify } from "./tree.js";
import { shellState, saveShells, basename, showShell, toggleShells, restoreShells } from "./shells.js";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) { const found = find(child, id); if (found) return found; }
  return null;
}
const narrow = () => (find(layout(), "fleet")?.size?.px ?? Infinity) < 160;
function toggleSidebar() {
  const width = find(layout(), "fleet")?.size?.px;
  if (!narrow()) setShared("fleet.width", width);
  run("layout.resize", { id: "fleet", px: narrow() ? (shared("fleet.width") ?? 300) : window()?.platform === "macos" ? 76 : 44 });
}
const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();

function leadPanes(all) {
  const leads = new Map();
  for (const p of all) {
    if (!p.terminal) continue;
    const current = leads.get(p.tab);
    // First agent, else first focused terminal, else first terminal in the tab.
    if (!current || (!current.program?.agent && (p.program?.agent || (!current.focused && p.focused)))) leads.set(p.tab, p);
  }
  return leads;
}

function title(tab, l) {
  const prog = l?.program?.name;
  const live = clean(l?.title);
  const telling = live && live !== prog && !/^[~/]|^[A-Za-z]:\\/.test(live) && !live.includes("@") && live.toLowerCase() !== l?.program?.key;
  return (tab.name === prog || !tab.named) && telling ? live : tab.name;
}
function duration(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

// The agent's icon from the app's program table: a one-color glyph or a picture.
function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}


export default class Fleet extends View {
  init(_props, cx) {
    this.folded = new Set();
    this.expandedDone = new Set();
    this.changed = JSON.parse(localStorage.getItem("changed") ?? "{}");
    this.history = new Map();
    this.known = new Map();
    restoreShells();
    this.refreshHistory(cx);
    cx.timer.every(30000, cx => { this.refreshHistory(cx); cx.notify(); });
    cx.spawn(async cx => {
      for (;;) {
        const command = await nextCommand();
        try {
          if (command === "new-shell") await this.newShell();
          else if (command === "toggle-shells") toggleShells();
          else if (command === "next" || command === "prev") this.navigate(command === "next" ? 1 : -1, cx);
        } catch (error) {
          notify({ title: "Fleet", body: String(error), level: "error" });
        }
        cx.notify();
      }
    });
  }

  refreshHistory(cx) {
    if (this.refreshing) return;
    this.refreshing = true;
    // The app publishes live terminals only. Read finished children from each core,
    // gently, without guessing that an offline machine's missing terminals exited.
    cx.spawn(async cx => {
      try {
        for (const machine of machines().filter(m => m.layout === "ready")) {
          try {
            const r = await exec("hc", ["ls", "--all", "--json"], { on: machine.name });
            if (r.code !== 0) continue;
            const data = JSON.parse(r.stdout);
            const records = data.terminals.map(t => ({ ...t,
              address: qualify(t.address, machine.name), parent: qualify(t.parent, machine.name) }));
            this.history.set(machine.name, records);
            const dead = new Set(records.filter(t => t.state !== "live").map(t => t.address));
            const state = shellState();
            if (state.items.some(s => dead.has(s.address))) {
              saveShells({ ...state, items: state.items.filter(s => !dead.has(s.address)) });
            }
          } catch (error) { console.log(`Fleet history (${machine.name ?? "local"}): ${error}`); }
        }
      } finally { this.refreshing = false; cx.notify(); }
    });
  }

  async newShell() {
    // Capture the selected item's context before awaiting the remote launch.
    const current = focused();
    const selected = this.selected;
    const space = spaces().find(s => s.id === (selected?.space ?? current?.space));
    if (!space) throw new Error("Select a space or an agent first.");
    const address = selected?.kind === "terminal" ? selected.address : null;
    const terminal = address ? this.known.get(address) || shellState().items.find(s => s.address === address) : null;
    let cwd = selected?.kind === "space" ? this.spaceFolder(space)
      : terminal?.cwd || (current?.agent === address ? current?.cwd : null) || this.spaceFolder(space);
    const machine = space.machine;
    if (selected?.kind === "space" && cwd) {
      try {
        const repo = await exec("git", ["rev-parse", "--show-toplevel"], { cwd, on: machine });
        if (repo.code === 0 && repo.stdout.trim()) cwd = repo.stdout.trim();
      } catch (error) { console.log(`Fleet repo lookup: ${error}`); }
    }
    const args = ["run", "--keep", "--bg", "--json", "--no-parent", "--outlive-parent", "--no-notify"];
    if (machine) args.push("--on", machine);
    if (cwd) args.push("--cwd", cwd);
    const r = await hc(args);
    if (r.code !== 0) throw new Error(r.stderr || r.stdout || "Could not start shell.");
    const data = JSON.parse(r.stdout);
    if (typeof data.address !== "string") throw new Error("hc run did not return an address.");
    const shell = { address: qualify(data.address, machine), machine, space: space.id,
      cwd, name: basename(cwd || space.name), open: true, overlay: null };
    const state = shellState();
    saveShells({ ...state, items: [...state.items, shell] });
    showShell(shell.address);
  }

  spaceFolder(space) {
    // Like the shipped spaces mod: prefer the first terminal's current repository.
    const tabIds = new Set(space.tabs.map(t => t.id));
    const lead = panes().find(p => p.terminal && tabIds.has(p.tab));
    return lead?.cwd || space.folder || "";
  }

  selectTerminal(terminal, cx) {
    this.selected = { kind: "terminal", address: terminal.address, space: terminal.group ?? terminal.space };
    this.lastShown = terminal.address;
    if (terminal.state === "live") run("agent.focus", { terminal: terminal.address });
    cx.notify();
  }

  treeSnapshot() {
    const listed = agents();
    const all = new Map([...this.history.values()].flat().map(k => [k.address, { ...this.known.get(k.address), ...k }]));
    for (const k of terminals()) all.set(k.address, { ...all.get(k.address), ...k, cwd: k.foreground?.cwd || k.cwd });
    for (const a of listed) all.set(a.address, { ...all.get(a.address), ...a });
    this.known = all;
    const shellList = shellState().items;
    const groups = buildForest(spaces(), listed, [...all.values()], panes(), shellList);
    // Include folded agents too: Herdr appends omitted agents to its navigation list.
    const list = groups.flatMap(g => flattenTree(g.roots, new Set(all.keys())).map(r => r.terminal));
    return { groups, list };
  }

  navigate(direction, cx) {
    const { groups, list } = this.treeSnapshot();
    const visible = new Set(groups.flatMap(g => this.folded.has(g.space.id) ? []
      : flattenTree(g.roots, this.expandedDone).map(row => row.terminal.address)));
    // History can lag exits/disconnections: only the current live snapshot may be focused.
    const live = new Set(terminals().filter(t => t.state === "live").map(t => t.address));
    const current = focused()?.agent ?? this.selected?.address;
    let index = list.findIndex(t => t.address === current);
    if (index < 0) index = direction > 0 ? -1 : 0;
    // Walk the full order so a cursor inside a newly folded branch keeps its place.
    for (let step = 1; step <= list.length; step++) {
      const terminal = list[(index + direction * step + list.length) % list.length];
      if (terminal.state === "live" && visible.has(terminal.address) && live.has(terminal.address)) {
        this.selectTerminal(terminal, cx);
        return;
      }
    }
  }

  since(a) { return this.changed[a.address]?.at ?? 0; }
  track(list, now) {
    let dirty = false;
    for (const a of list) {
      const s = a.status === "done" ? "idle" : a.status;
      if (this.changed[a.address]?.s === s) continue;
      this.changed[a.address] = { s, at: now }; dirty = true;
    }
    if (dirty) {
      const present = new Set(list.map(a => a.address));
      for (const [key, c] of Object.entries(this.changed)) if (!present.has(key) && now - c.at > 30 * 86400000) delete this.changed[key];
      localStorage.setItem("changed", JSON.stringify(this.changed));
    }
  }

  fold(t, a, count) {
    const open = this.expandedDone.has(a.address);
    return div().id(`fold-${a.address}`).h(18).px(3).gap(3).flex().items_center()
      .rounded(4).text_size(11).text_color(t.dim).cursor_pointer()
      .tooltip(`${count} completed descendants`)
      .hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        open ? this.expandedDone.delete(a.address) : this.expandedDone.add(a.address);
        cx.notify();
      })
      .child(svg(`mods/workspace-chrome/chevron-${open ? "down" : "right"}.svg`).size(11).flex_none())
      .child(String(count));
  }
  subRow(t, s, shown, compact) {
    const k = s.t;
    const st = k.state === "live" ? (k.status === "error" ? "blocked" : k.status) : "done";
    const pic = icon(k.program, 14, t.foreground);
    const on = k.address === shown;
    return h_flex()
      .id(`sub-${k.address}`)
      .pl(39)
      .pr(8)
      .rounded(8)
      .h(26)
      .flex_none()
      .gap(0)
      .items_center()
      .text_size(12.5)
      .when(on, (el) => el.bg(t.raised))
      .hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => this.selectTerminal(k, cx))
      .children(s.lines.map(l => div().self_start().mt(-4).w(9).h(17).mr(4).flex_none()
        .when(Boolean(l), el => el.border_l(1.5).border_color(t.input))
        .when(l === "└" || l === "├", el => el.border_b(1.5).rounded_bl(6))))
      .when(Boolean(pic), el => el.child(div().mr(8).child(pic)))
      .child(div().flex_1().truncate().text_color(on ? t.foreground : t.muted).child(k.name || k.template || k.program?.name || k.address))
      .when(s.completed > 0, el => el.child(this.fold(t, k, s.completed)))
      .child(this.status(t, { status: st }, compact));
  }

  // compact: a ! for blocked where a header already says "Needs you".
  status(t, a, compact = false) {
    const color = t[a.status] ?? t.dim;
    if (a.status === "working") return svg("mods/workspace-chrome/spinner.svg").size(12).mx(1).flex_none().text_color(t.working).spin(900);
    if (a.status === "blocked" && compact) return div().size(14).flex_none().rounded(4).bg(t.blocked + "26").text_size(10.5).font_bold().text_color(t.blocked).flex().items_center().justify_center().child("!");
    if (a.status === "blocked") return div().flex_none().px(6).h(18).rounded(5).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).flex().items_center().child("Needs you");
    // Idle: a ring; done: a dot.
    if (a.status === "idle") return div().size(7).mx(3).flex_none().rounded(4).border(1.5).border_color(t.idle ?? t.dim);
    return div().size(7).mx(3).flex_none().rounded(4).bg(a.status === "done" ? color : t.dim + "00");
  }


  render(cx) {
    const t = theme();
    const collapsed = narrow();
    const { groups, list } = this.treeSnapshot();
    setAgentOrder(list.filter(a => a.state === "live" && a.status).map(a => a.address));
    const shown = focused()?.agent;
    if (shown && (shown !== this.lastShown || !this.selected)) {
      const item = list.find(a => a.address === shown);
      if (item) this.selected = { kind: "terminal", address: shown, space: item.group };
    }
    this.lastShown = shown;
    const now = Date.now();
    this.track(list, now);
    const leads = leadPanes(panes());
    const tabLabels = new Map(spaces().flatMap(s => s.tabs).map(tab => [tab.id, title(tab, leads.get(tab.id))]));
    const labels = new Map(list.map(a => [a.address, a.name || tabLabels.get(a.tab) || a.title || a.program?.name || a.address]));
    const label = a => labels.get(a.address);
    const detail = new Map(list.map(a => [a.address, /^\d+$/.test(label(a)) ? null : label(a)]));
    const row = (a, i, completed = 0) => {
      const pic = icon(a.program, 16, t.foreground);
      const more = detail.get(a.address);
      // An agent on another machine (`vps/t7`) says which.
      const machine = a.address.includes("/") ? a.address.split("/")[0] : null;
      if (collapsed) {
        return h_flex()
          .id(`ag-${a.address}`)
          .h(26)
          .px(8)
          .flex_none()
          .items_center()
          .gap(4)
          .hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => this.selectTerminal(a, cx))
          .child(div().flex_1().min_w(0).whitespace_nowrap().text_right().text_color(t.muted).child(String(i + 1)))
          .child(h_flex().w(14).flex_none().items_center().justify_center().child(this.status(t, a, true)));
      }
      const when = this.since(a);
      const idle = a.status === "idle" && !a.focused;
      const isPinned = a.pinned;
      const pin = div()
        .id(`pin-${a.address}`)
        .flex_none()
        .p(2)
        .rounded(4)
        .text_color(t.dim)
        .cursor_pointer()
        .hover((s) => s.bg(t.hover).text_color(t.foreground))
        .tooltip(isPinned ? "Unpin" : "Pin")
        .on_click((_e, cx) => {
          cx.stop_propagation();
          run("terminal.pin", { terminal: a.address, pinned: !isPinned });
          this.hovered = null;
          cx.notify();
        })
        .child(svg(`mods/workspace-chrome/${isPinned ? "pin-off" : "pin"}.svg`).size(13));
      // Under a space header, keep the shipped grouped row's label.
      const name = more ?? (/^\d+$/.test(label(a)) ? a.program?.name || label(a) : label(a));
      return h_flex()
        .id(`ag-${a.address}`)
        .px(8)
        .h(30)
        .flex_none()
        .rounded(8)
        .items_center()
        .gap(9)
        .when(a.focused, (el) => el.bg(t.selected))
        .cursor_pointer()
        .hover((s) => s.bg(t.hover))
        .on_hover((on, cx) => {
          if (on) this.hovered = a.address;
          else if (this.hovered === a.address) this.hovered = null;
          cx.notify();
        })
        .on_click((_e, cx) => this.selectTerminal(a, cx))
        .when(Boolean(pic), el => el.child(div().id(`agent-fold-${a.address}`)
          .when(completed > 0, el => el.on_click((_e, cx) => {
            cx.stop_propagation();
            this.expandedDone.has(a.address) ? this.expandedDone.delete(a.address) : this.expandedDone.add(a.address);
            cx.notify();
          })).child(pic)))
        .child(h_flex().flex_1().min_w(0).gap(5).items_center()
          .child(div().min_w(0).max_w(200).truncate().text_color(idle ? t.muted : t.foreground).child(name)))
        .when(Boolean(machine), el => el.child(div().text_size(10).text_color(t.dim).child(machine)))
        .when(completed > 0, el => el.child(this.fold(t, a, completed)))
        .when(this.hovered === a.address, el => el.child(pin))
        .when(this.hovered !== a.address && Boolean(when), el => el.child(div().flex_none().text_size(11).text_color(t.dim).child(duration(now - when))))
        .child(this.status(t, a));
    };


    const header = g => {
      const open = !this.folded.has(g.space.id);
      const on = this.selected?.kind === "space" && this.selected.space === g.space.id;
      return h_flex().id(`sp-${g.space.id}`).px(8).pt(8).h(30).flex_none().gap(6)
        .items_center().text_size(11).font_medium().cursor_pointer()
        .when(on, el => el.bg(t.selected)).hover(s => s.text_color(t.foreground))
        .on_click((_e, cx) => { this.selected = { kind: "space", space: g.space.id }; cx.notify(); })
        .child(div().truncate().text_color(t.dim).child(g.space.name))
        .when(Boolean(g.space.machine), el => el.child(div().text_color(t.dim).child(g.space.machine)))
        .child(div().flex_1())
        .child(div().id(`sp-fold-${g.space.id}`).cursor_pointer()
          .on_click((_e, cx) => {
            cx.stop_propagation();
            open ? this.folded.add(g.space.id) : this.folded.delete(g.space.id); cx.notify();
          }).child(svg(`mods/workspace-chrome/chevron-${open ? "down" : "right"}.svg`).size(11).flex_none().text_color(t.dim)));
    };
    const rows = groups.flatMap(g => {
      const tree = flattenTree(g.roots, this.expandedDone);
      const agents = this.folded.has(g.space.id) ? [] : tree.map((s, i) => {
        const a = { ...s.terminal, focused: s.terminal.address === shown };
        if (!s.lines.length || collapsed) return row(a, i, s.completed);
        return this.subRow(t, { t: a, lines: s.lines, completed: s.completed }, shown, false);
      });
      const shells = this.folded.has(g.space.id) ? [] : g.shells.map(shell => h_flex()
        .id(`shell-${shell.address}`).px(8).h(30).flex_none().rounded(8).items_center().gap(9)
        .cursor_pointer().hover(s => s.bg(t.hover)).text_color(t.muted)
        .when(this.selected?.address === shell.address, el => el.bg(t.selected))
        .on_click((_e, cx) => {
          this.selected = { kind: "terminal", address: shell.address, space: shell.space };
          showShell(shell.address); cx.notify();
        }).child(div().truncate().child(`▸ shell ${shell.name}`)));
      return [...(collapsed ? [] : [header(g)]), ...agents, ...shells];
    });
    return v_flex().size_full().min_h(0).bg(t.chrome).border_t(1).border_color(t.border).text_size(13)
      .when(!collapsed, el => el.child(h_flex().px(16).h(41).pt(14).pb(5).flex_none()
        .items_center().justify_between()
        .child(div().text_size(11.5).font_medium().text_color(t.dim).child("Agents"))))
      .when(groups.length === 0 && !collapsed, el => el.child(div().px(12).text_size(12)
        .text_color(t.dim).child("No spaces yet.")))
      .child(v_flex().id("ag-list").flex_1().min_h(0).px(collapsed ? 0 : 8)
        .overflow_y_scrollbar().mode("always").children(rows))
      .when(collapsed, el => el.child(h_flex().h(28).items_center().justify_center()
        .child(div().id("collapse").text_size(13).text_color(t.dim)
          .hover(s => s.text_color(t.foreground)).on_click(toggleSidebar).child("»"))));
  }
}
