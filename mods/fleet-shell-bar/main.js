import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { props, theme, shared, setShared, closeOverlay } from "herdr";
const shellState = () => shared("fleet.shells") ?? { items: [], hidden: false };
function registerShell(address, overlay) {
  const state = shellState();
  const shell = state.items.find(s => s.address === address);
  if (!shell || shell.overlay === overlay) return;
  if (state.hidden || !shell.open) { closeOverlay(overlay); return; }
  setShared("fleet.shells", { ...state, items: state.items.map(s => s.address === address ? { ...s, overlay } : s) });
}
function closeShell(address, overlay) {
  const state = shellState();
  setShared("fleet.shells", { ...state, items: state.items.map(s => s.address === address ? { ...s, open: false, overlay: null } : s) });
  closeOverlay(overlay);
}

export default class FleetShellBar extends View {
  render() {
    const { address, overlay } = props() ?? {};
    registerShell(address, overlay);
    const name = shellState().items.find(s => s.address === address)?.name ?? address;
    const t = theme();
    // An unhandled press drags a window overlay. Only the close control stops it.
    return h_flex().size_full().px(12).gap(8).items_center()
      .bg(t.surface).border_b(1).border_color(t.border).text_size(12)
      .child(div().flex_1().truncate().font_semibold().text_color(t.foreground).child(`shell ${name}`))
      .child(div().id("shell-close").px(8).py(2).rounded(5).text_color(t.muted)
        .cursor_pointer().tooltip("Close window (shell keeps running)")
        .hover(s => s.bg(t.hover).text_color(t.foreground))
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .on_click((_e, cx) => { cx.stop_propagation(); closeShell(address, overlay); })
        .child("✕"));
  }
}
