import { type ReactNode, useEffect, useRef } from "react";
import { useTranslation } from "../i18n";
import { IconButton } from "./primitives";

/**
 * Bottom sheet on phones, centered panel on wide screens. Built on <dialog> + showModal(), which
 * gives focus trapping, Esc-to-close and an inert background. Drag the handle down to dismiss.
 */
export function BottomSheet(props: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Optional label for tests / a11y when the title is not plain text. */
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ startY: number; dy: number } | null>(null);
  const { t } = useTranslation();
  const { open, onClose } = props;
  // The native "close" event also fires when we close the dialog ourselves (open → false);
  // only report closes the user initiated.
  const openRef = useRef(open);
  openRef.current = open;
  const userClose = () => {
    if (openRef.current) onClose();
  };

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { startY: e.clientY, dy: 0 };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !ref.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.startY);
    ref.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onPointerUp = () => {
    if (!drag.current || !ref.current) return;
    const dismiss = drag.current.dy > 90;
    ref.current.style.transform = "";
    drag.current = null;
    if (dismiss) userClose();
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click is a pointer shortcut; Esc closes via onCancel
    <dialog
      ref={ref}
      aria-label={props.ariaLabel}
      onClose={userClose}
      onCancel={(e) => {
        e.preventDefault();
        userClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) userClose(); // backdrop click
      }}
      className="m-0 mt-auto max-h-[88dvh] w-full max-w-none overflow-hidden rounded-t-3xl border border-line bg-surface p-0 text-ink transition-transform sm:m-auto sm:max-w-lg sm:rounded-3xl"
    >
      {open && (
        <div className="flex max-h-[88dvh] flex-col">
          <div
            className="flex cursor-grab touch-none justify-center pt-2 pb-1 sm:hidden"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <span className="h-1.5 w-10 rounded-full bg-line" />
          </div>
          <div className="flex items-center gap-2 border-b border-line px-4 py-2">
            <h2 className="flex-1 text-lg font-semibold">{props.title}</h2>
            <IconButton icon="close" label={t("common.close")} onClick={onClose} />
          </div>
          <div className="overflow-y-auto px-4 py-4 pb-safe">{props.children}</div>
        </div>
      )}
    </dialog>
  );
}
