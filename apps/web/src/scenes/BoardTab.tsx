import { EmptyState } from "../ui/primitives";

export function BoardTab(_props: {
  focusScene?: string | undefined;
  focusHotspot?: string | undefined;
}) {
  return <EmptyState icon="board" title="BoardTab" />;
}
