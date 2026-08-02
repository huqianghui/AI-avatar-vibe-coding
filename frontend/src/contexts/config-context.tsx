import { createContext, useContext, type ReactNode } from "react";
import type { FeatureFlags } from "@/types/config";
import { useFeatureFlags } from "@/hooks/use-config";
import { useAuthStore } from "@/stores/auth-store";

const defaultFlags: FeatureFlags = {
  avatar_enabled: false,
  voice_enabled: false,
  realtime_voice_enabled: false,
  conference_enabled: false,
  voice_live_enabled: false,
  legacy_coach_nav_enabled: false,
  default_voice_mode: "text_only",
  region: "global",
};

const ConfigContext = createContext<FeatureFlags>(defaultFlags);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const { data } = useFeatureFlags(isAuthenticated);
  const flags = isAuthenticated && data ? data.features : defaultFlags;
  return (
    <ConfigContext.Provider value={flags}>{children}</ConfigContext.Provider>
  );
}

export function useConfig(): FeatureFlags {
  return useContext(ConfigContext);
}
