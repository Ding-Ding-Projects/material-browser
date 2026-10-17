import type { DetailedHTMLProps, HTMLAttributes } from "react";
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "md-filled-button": DetailedHTMLProps<
        HTMLAttributes<HTMLElement>,
        HTMLElement
      > & { disabled?: boolean; type?: string };
      "md-outlined-button": DetailedHTMLProps<
        HTMLAttributes<HTMLElement>,
        HTMLElement
      > & { disabled?: boolean; type?: string };
    }
  }
}
export {};
