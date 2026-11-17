import { useEffect, useMemo, useState } from "react";
import { useGame } from "../game/GameProvider";
import { useTranslation } from "../i18n";
import { Icon } from "../ui/Icon";
import { Button } from "../ui/primitives";
import { downloadForOffline, isAvailableOffline, offlineUrls, removeOffline } from "./offlineCache";
import { useOnline } from "./useOnline";

type Status = "checking" | "missing" | "downloading" | "ready" | "error";

/** "Download for offline" for the current game, with its state. */
export function OfflineButton() {
  const { guide, assetUrl } = useGame();
  const { t } = useTranslation();
  const online = useOnline();
  const [status, setStatus] = useState<Status>("checking");
  const urls = useMemo(() => offlineUrls(guide, assetUrl), [guide, assetUrl]);

  useEffect(() => {
    let cancelled = false;
    void isAvailableOffline(urls).then((ok) => !cancelled && setStatus(ok ? "ready" : "missing"));
    return () => {
      cancelled = true;
    };
  }, [urls]);

  const download = async () => {
    setStatus("downloading");
    try {
      await downloadForOffline(urls);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  if (status === "checking") return null;
  if (status === "ready") {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ok/50 bg-ok/10 px-3 py-2 text-sm">
        <Icon name="check" className="text-ok" />
        <span className="flex-1 font-medium text-ok" data-testid="offline-status">
          {t("offline.ready")}
        </span>
        <button
          type="button"
          className="min-h-8 text-muted underline"
          onClick={() => void removeOffline(urls).then(() => setStatus("missing"))}
        >
          {t("offline.remove")}
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button icon="download" onClick={download} disabled={!online || status === "downloading"}>
        {status === "downloading" ? t("offline.downloading") : t("offline.download")}
      </Button>
      {status === "error" && <span className="text-sm text-bad">{t("offline.error")}</span>}
    </div>
  );
}
