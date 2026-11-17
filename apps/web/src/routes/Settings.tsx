import type { Locale } from "@bgc/schema";
import { Link, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useLocale, useTranslation } from "../i18n";
import { settingsStore, type Theme, useSettings } from "../settings/settings";
import { Icon } from "../ui/Icon";
import { Card, SegmentedControl } from "../ui/primitives";

function Row(props: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div>
        <p className="font-medium">{props.label}</p>
        {props.hint && <p className="text-sm text-muted">{props.hint}</p>}
      </div>
      {props.children}
    </div>
  );
}

export function SettingsScreen() {
  const { t } = useTranslation();
  const settings = useSettings();
  const locale = useLocale();
  const router = useRouter();

  return (
    <div className="mx-auto min-h-dvh max-w-2xl">
      <header className="pt-safe sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-bg/90 px-2 py-2 backdrop-blur">
        <button
          type="button"
          onClick={() => router.history.back()}
          aria-label={t("common.back")}
          className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-surface-2"
        >
          <Icon name="back" size={22} />
        </button>
        <h1 className="text-xl font-bold">{t("settings.title")}</h1>
      </header>
      <main className="space-y-4 p-4">
        <Card className="divide-y divide-line py-1">
          <Row label={t("settings.language")}>
            <SegmentedControl<Locale>
              label={t("settings.language")}
              value={locale}
              onChange={(language) => settingsStore.set({ language })}
              options={[
                { value: "en", label: "English" },
                { value: "it", label: "Italiano" },
              ]}
            />
          </Row>
          <Row label={t("settings.theme")}>
            <SegmentedControl<Theme>
              label={t("settings.theme")}
              value={settings.theme}
              onChange={(theme) => settingsStore.set({ theme })}
              options={[
                { value: "dark", label: t("settings.dark") },
                { value: "light", label: t("settings.light") },
              ]}
            />
          </Row>
          <Row label={t("settings.largeText")} hint={t("settings.largeTextHint")}>
            <SegmentedControl<"on" | "off">
              label={t("settings.largeText")}
              value={settings.largeText ? "on" : "off"}
              onChange={(v) => settingsStore.set({ largeText: v === "on" })}
              options={[
                { value: "off", label: "A" },
                { value: "on", label: "A+" },
              ]}
            />
          </Row>
        </Card>
        <p className="px-1 text-sm text-muted">
          {t("settings.about")}{" "}
          <Link to="/" className="text-accent">
            {t("common.home")}
          </Link>
        </p>
      </main>
    </div>
  );
}
