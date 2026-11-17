import { Link, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { useLocale, useTranslation } from "../i18n";
import { useOnline } from "../offline/useOnline";
import { useSettings } from "../settings/settings";
import { Icon } from "../ui/Icon";
import { EmptyState } from "../ui/primitives";

/** Keeps <html> attributes (theme, text size, lang) and i18next in sync with settings. */
function useDocumentSettings() {
  const { theme, largeText } = useSettings();
  const locale = useLocale();
  const { i18n } = useTranslation();

  useEffect(() => {
    const html = document.documentElement;
    html.dataset.theme = theme;
    html.dataset.text = largeText ? "large" : "normal";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#0f1512" : "#f5f1e8");
  }, [theme, largeText]);

  useEffect(() => {
    document.documentElement.lang = locale;
    if (i18n.language !== locale) void i18n.changeLanguage(locale);
  }, [locale, i18n]);
}

function OfflineBanner() {
  const online = useOnline();
  const { t } = useTranslation();
  if (online) return null;
  return (
    <div
      role="status"
      className="pt-safe flex items-center justify-center gap-2 bg-warn/20 px-4 py-1.5 text-sm font-medium text-warn"
    >
      <Icon name="offline" size={16} />
      {t("offline.banner")}
    </div>
  );
}

export function Root() {
  useDocumentSettings();
  return (
    <>
      <OfflineBanner />
      <Outlet />
    </>
  );
}

export function NotFound() {
  const { t } = useTranslation();
  return (
    <EmptyState icon="question" title={t("common.notFound")}>
      <Link to="/" className="font-medium text-accent">
        {t("common.home")}
      </Link>
    </EmptyState>
  );
}
