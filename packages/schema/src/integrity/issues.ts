export type Severity = "error" | "warning";

export interface IntegrityIssue {
  severity: Severity;
  /** JSON-path-like location inside the merged GameGuide, e.g. `rules[2].citations[0]`. */
  path: string;
  message: string;
}

export type Path = readonly (string | number)[];

export function formatPath(path: Path): string {
  let out = "";
  for (const p of path) {
    if (typeof p === "number") out += `[${p}]`;
    else out += out === "" ? p : `.${p}`;
  }
  return out || "(root)";
}

export class IssueCollector {
  readonly issues: IntegrityIssue[] = [];

  error(path: Path, message: string): void {
    this.issues.push({ severity: "error", path: formatPath(path), message });
  }

  warning(path: Path, message: string): void {
    this.issues.push({ severity: "warning", path: formatPath(path), message });
  }

  /** Reports every id that appears more than once in `items`. */
  unique(items: readonly { id: string }[], basePath: Path, what: string): Set<string> {
    const seen = new Set<string>();
    for (const [i, item] of items.entries()) {
      if (seen.has(item.id))
        this.error([...basePath, i, "id"], `duplicate ${what} id "${item.id}"`);
      seen.add(item.id);
    }
    return seen;
  }
}

export const hasErrors = (issues: readonly IntegrityIssue[]): boolean =>
  issues.some((i) => i.severity === "error");
