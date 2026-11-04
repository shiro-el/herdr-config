import { shared, setShared, openOverlay, closeOverlay } from "herdr";

const KEY = "fleet.shells";
export const shellState = () => {
  const state = shared(KEY);
  return state && typeof state === "object" && Array.isArray(state.items)
    ? state : { items: [], hidden: false };
};
export const saveShells = (state) => setShared(KEY, state);
export const basename = (folder) => folder.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || "shell";

export function shellLayout(shell) {
  return {
    type: "column", resizable: false,
    children: [
      { id: "shell-bar", type: "block", size: { px: 28 },
        content: { mod: "fleet-shell-bar", props: { address: shell.address } } },
      { id: "shell-terminal", type: "block", content: { terminal: shell.address } },
    ],
  };
}

export function openShell(shell) {
  return { ...shell, open: true, overlay: openOverlay({
    kind: "window", key: `shell:${shell.address}`, keep: true,
    width: 760, height: 480, layout: shellLayout(shell),
  }) };
}

// Reusing the key raises/replaces that window, preserving its saved position.
export function showShell(address) {
  const state = shellState();
  saveShells({ hidden: false, items: state.items.map(s =>
    s.address === address || (state.hidden && s.open) ? openShell(s) : s) });
}

export function toggleShells() {
  const state = shellState();
  const hidden = !state.hidden;
  const items = state.items.map(s => {
    if (!s.open) return s;
    if (!hidden) return openShell(s);
    if (s.overlay) closeOverlay(s.overlay);
    return { ...s, overlay: null };
  });
  saveShells({ hidden, items });
}

export function restoreShells() {
  const state = shellState();
  if (!state.hidden && state.items.some(s => s.open)) {
    saveShells({ ...state, items: state.items.map(s => s.open ? openShell(s) : s) });
  }
}
