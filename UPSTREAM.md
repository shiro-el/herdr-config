# Upstream provenance

The fleet mod started as a copy of `defaults/mods/agents/main.js` from
[herdrdev/herdr-app](https://github.com/herdrdev/herdr-app/tree/816d2057d83f0cbd3705926c0231fb12963ae0fb),
commit `816d2057d83f0cbd3705926c0231fb12963ae0fb` (2026-11-04 retrieval).
Its agent rows, subtree lines, program icons, status rendering, durations and
compact rail retain the shipped geometry and theme tokens. Grouping, parent
resolution, completed-child folding, selection, ordering and shell controls
are modified here. The small shell title bar follows `defaults/mods/peek`.
`keys.json` starts from the same revision's common defaults.

Upstream is Apache-2.0; its license is included in `LICENSE`. Program and
workspace-chrome icons are referenced from the client's shipped installation.
No external fonts, colors or theme override the layout.

API authority: `defaults/AGENTS.md` (read in full), `defaults/herdr.d.ts`,
`defaults/layouts/main.json`, `defaults/mods/agents`, `defaults/mods/peek`,
`defaults/keys.json`, and `defaults/keys.macos.json` at that revision.
`defaults/gpui-kit.d.ts` returns 404: `src/mods.rs::write_workspace` generates
it at app startup via `vendor/gpui-kit/crates/shell/src/typings.rs` and the
style reflection tables. GPUI calls were checked against those declaration
sources and the unchanged shipped call sites; the client-generated `.d.ts`
and `herdr-app check` still need client validation.

`src/window.rs::agent_order` limits navigation to `Model::all_addresses`
(pane terminals), and `agent.next/prev` uses `root_agent` for its cursor.
`setAgentOrder` cannot change that host behavior. Fleet supplies full depth
first order, including folded live agents, but cannot provide complete
child-by-child navigation with the requested built-in key actions on this
upstream revision. No core/app files are modified by this repository.

`terminals()` is live-only on this revision. Fleet supplements it with
`exec("hc", ["ls", "--all", "--json"], {on: machine})` every 30 seconds per
ready machine. It does not treat disconnection as exit. Finished children
are displayed as completed and are selectable as folder context, but cannot
be focused as running terminals.
