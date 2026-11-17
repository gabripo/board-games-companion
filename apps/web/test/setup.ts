import { cleanup } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

afterEach(() => {
  cleanup();
  localStorage.clear();
  resetGamePrefsCache();
});

import { initI18n } from "../src/i18n";
import { resetGamePrefsCache } from "../src/settings/settings";

initI18n();

// happy-dom cancels Web Animations on teardown; animations are irrelevant to unit tests.
MotionGlobalConfig.skipAnimations = true;
