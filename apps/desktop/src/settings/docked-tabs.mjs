import { MdTabs } from "@material/web/tabs/tabs.js";
import { css } from "lit";
/** Registered composition retaining Material Web tabs, indicator and state layers. */
export class DockedSettingsTabs extends MdTabs {
  static styles = [
    ...(Array.isArray(MdTabs.styles) ? MdTabs.styles : [MdTabs.styles]),
    css`
      :host {
        scrollbar-width: thin;
      }
      :host([vertical]) .tabs {
        flex-direction: column;
        align-items: stretch;
        height: auto;
      }
      :host([vertical]) ::slotted(*) {
        flex: none;
        width: 100%;
        min-height: 56px;
      }
      :host([vertical]) {
        max-height: 60vh;
      }
    `,
  ];
  constructor() {
    super();
    this.addEventListener(
      "keydown",
      (event) => {
        if (
          !this.hasAttribute("vertical") ||
          !["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)
        )
          return;
        event.preventDefault();
        const tabs = [...this.querySelectorAll("md-primary-tab")];
        if (!tabs.length) return;
        const current = tabs.findIndex(
          (x) => x === document.activeElement || x.matches(":focus-within"),
        );
        let index =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : (Math.max(current, 0) +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  tabs.length) %
                tabs.length;
        tabs[index].focus();
        this.activeTabIndex = index;
      },
      true,
    );
  }
}
if (!customElements.get("material-settings-tabs"))
  customElements.define("material-settings-tabs", DockedSettingsTabs);
