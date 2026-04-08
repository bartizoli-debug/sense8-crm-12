// /components/ui/styles.ts
import { CSSProperties } from "react";
import { ui } from "./tokens";

export function mergeStyles(
  ...styles: Array<CSSProperties | undefined | null | false>
): CSSProperties {
  return Object.assign({}, ...styles.filter(Boolean));
}

export const base = {
  page: {
    background: ui.color.bg,
    color: ui.color.text,
  } satisfies CSSProperties,

  control: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: ui.radius.md,
    border: `1px solid ${ui.color.border}`,
    background: ui.color.surface,
    padding: `${ui.space.sm}px ${ui.space.md}px`,
    fontSize: ui.font.size.md,
    color: ui.color.text,
    outline: "none",
  } satisfies CSSProperties,

  controlFocus: {
    borderColor: ui.color.primary,
    boxShadow: ui.focusRing(ui.color.primarySoft),
  } satisfies CSSProperties,

  label: {
    fontSize: ui.font.size.sm,
    fontWeight: ui.font.weight.medium,
    color: ui.color.text2,
    marginBottom: ui.space.xs,
    display: "block",
  } satisfies CSSProperties,

  hint: {
    fontSize: ui.font.size.sm,
    color: ui.color.text3,
    marginTop: ui.space.xs,
  } satisfies CSSProperties,

  error: {
    fontSize: ui.font.size.sm,
    color: ui.color.danger,
    marginTop: ui.space.xs,
  } satisfies CSSProperties,
};
