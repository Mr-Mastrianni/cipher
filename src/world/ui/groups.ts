import type { Panel } from "../state";

/**
 * The world's three doors.
 *
 * The HUD used to carry nine buttons — Atlas, Talk, Codex, Chart, Learn, Build,
 * Avatar, Settings — which read as a cockpit: every panel was equally urgent,
 * so none of them was. They are the same nine screens, grouped by the question
 * they answer:
 *
 *   Atlas — where am I, and what is here  (Places, Codex, Terraces)
 *   Room  — who am I with, and what are we doing  (Talk, Teaching, Build)
 *   Chart — what do I carry  (Your chart, Avatar, Settings)
 *
 * The group is a navigation layer, not a rewrite: each tab still renders the
 * panel it always did, with its own state and shortcuts.
 */

export type PanelId = Exclude<Panel, null>;
export type PanelGroupId = "atlas" | "room" | "chart";

export interface PanelTab {
  id: PanelId;
  label: string;
}

export interface PanelGroup {
  id: PanelGroupId;
  label: string;
  /** The one-line promise of the group, shown in the HUD tooltip. */
  hint: string;
  /** Order matters: the first tab is the group's default door. */
  tabs: readonly PanelTab[];
}

export const PANEL_GROUPS: readonly PanelGroup[] = [
  {
    id: "atlas",
    label: "Atlas",
    hint: "Places, the Codex and the terraces",
    tabs: [
      { id: "atlas", label: "Places" },
      { id: "codex", label: "Codex" },
      { id: "plots", label: "Terraces" },
    ],
  },
  {
    id: "room",
    label: "Room",
    hint: "Talk, teaching and the build bench",
    tabs: [
      { id: "chat", label: "Talk" },
      { id: "learn", label: "Teaching" },
      { id: "build", label: "Build" },
    ],
  },
  {
    id: "chart",
    label: "Chart",
    hint: "Your chart, your avatar, your settings",
    tabs: [
      { id: "chart", label: "Your chart" },
      { id: "avatar", label: "Avatar" },
      { id: "settings", label: "Settings" },
    ],
  },
] as const;

/** The group a panel belongs to, or null when nothing is open. */
export function groupOf(panel: Panel): PanelGroup | null {
  if (!panel) return null;
  return PANEL_GROUPS.find((group) => group.tabs.some((tab) => tab.id === panel)) ?? null;
}

/** The panel a group opens on. */
export function defaultPanel(group: PanelGroup): PanelId {
  return group.tabs[0].id;
}

/** The tab label for a panel, for titles and aria text. */
export function tabLabel(panel: Panel): string {
  const group = groupOf(panel);
  return group?.tabs.find((tab) => tab.id === panel)?.label ?? "";
}
