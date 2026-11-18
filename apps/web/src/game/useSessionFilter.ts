import type { Conditions } from "@bgc/schema";
import { useState } from "react";
import { useGame } from "./GameProvider";

export interface SessionFilter<T> {
  /** What to render: items for this session, or everything when `showAll` is on. */
  items: T[];
  /** Items that don't apply to this session (other expansions, player counts…). */
  hiddenCount: number;
  showAll: boolean;
  toggle(): void;
  isApplicable(item: T): boolean;
}

/**
 * Filters any list with optional `conditions` to the current session, while keeping the
 * rest reachable on demand ("filtered content stays reachable").
 */
export function useSessionFilter<T extends { conditions?: Conditions | undefined }>(
  list: readonly T[],
  keep?: (item: T) => boolean,
): SessionFilter<T> {
  const { isApplicable } = useGame();
  const [showAll, setShowAll] = useState(false);
  const applies = (item: T) => isApplicable(item.conditions);
  const applicable = list.filter((i) => applies(i) || keep?.(i));
  return {
    items: showAll ? [...list] : applicable,
    hiddenCount: list.length - applicable.length,
    showAll,
    toggle: () => setShowAll((s) => !s),
    isApplicable: applies,
  };
}
