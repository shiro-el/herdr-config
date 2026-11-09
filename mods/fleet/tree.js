// Core parents are terminal addresses, not pane ids. Keep machine namespaces intact.
export const machineOf = (address) => address.includes("/") ? address.slice(0, address.indexOf("/")) : null;
export const qualify = (id, machine) => !id || id.includes("/") || !machine ? id : `${machine}/${id}`;
export const finished = (terminal) => terminal.state !== "live" || terminal.status === "done";

export function buildForest(spaces, agents, terminals, panes = [], shells = []) {
  const spaceIds = new Set(spaces.map(s => s.id));
  const byAgent = new Map(agents.map(a => [a.address, a]));
  const byTab = new Map(spaces.flatMap(s => s.tabs.map(t => [t.id, s.id])));
  const byPane = new Map(panes.filter(p => p.terminal).map(p => [p.terminal, byTab.get(p.tab)]));
  const shellIds = new Set(shells.map(s => s.address));
  const records = new Map(terminals.filter(t => !shellIds.has(t.address)).map(t => {
    const a = byAgent.get(t.address);
    return [t.address, { ...t, ...a, parent: qualify(t.parent, machineOf(t.address)),
      state: t.state ?? "live", status: t.state && t.state !== "live" ? "done" : (a?.status ?? (t.status === "error" ? "blocked" : t.status)),
      children: [] }];
  }));
  for (const a of agents) if (!shellIds.has(a.address) && !records.has(a.address)) records.set(a.address, { ...a, state: "live", children: [] });

  const resolving = new Set();
  const resolve = (t) => {
    if (t.group !== undefined) return t.group;
    if (resolving.has(t.address)) return null;
    resolving.add(t.address);
    const explicit = t.space || byPane.get(t.address) || qualify(t.labels?.["herdr.space"], machineOf(t.address));
    const group = spaceIds.has(explicit) ? explicit : records.has(t.parent) ? resolve(records.get(t.parent)) : null;
    resolving.delete(t.address);
    return t.group = group;
  };
  for (const t of records.values()) resolve(t);
  const groups = spaces.map(space => ({ space, roots: [], shells: shells.filter(s => s.space === space.id) }));
  const bySpace = new Map(groups.map(g => [g.space.id, g]));
  for (const t of records.values()) {
    const group = bySpace.get(t.group);
    if (!group) continue;
    const parent = records.get(t.parent);
    // Reject malformed cycles rather than recurse forever.
    let cur = parent;
    const seen = new Set([t.address]);
    while (cur && !seen.has(cur.address)) { seen.add(cur.address); cur = records.get(cur.parent); }
    if (parent && parent.group === t.group && !cur) parent.children.push(t);
    else group.roots.push(t);
  }
  // Keep non-agent intermediates only when they connect a real descendant.
  // A Claude session that moved to a background job stops reporting status but still holds the foreground.
  const prune = (t) => {
    t.children = t.children.filter(prune);
    return Boolean(t.status || t.program?.agent || t.foreground?.name === "claude" || t.parent || t.children.length);
  };
  for (const g of groups) g.roots = g.roots.filter(prune);
  return groups;
}

export function flattenTree(roots, expanded = new Set()) {
  const rows = [];
  const complete = (t) => finished(t) && t.children.every(complete);
  const count = (t) => 1 + t.children.reduce((n, c) => n + count(c), 0);
  const visit = (t, lines) => {
    const folded = t.children.filter(complete);
    const children = t.children.filter(c => expanded.has(t.address) || !complete(c));
    rows.push({ terminal: t, lines, completed: folded.reduce((n, c) => n + count(c), 0) });
    children.forEach((c, i) => visit(c, [...lines.map(l => l === "├" ? "│" : l === "└" ? "" : l), i === children.length - 1 ? "└" : "├"]));
  };
  roots.forEach(t => visit(t, []));
  return rows;
}
