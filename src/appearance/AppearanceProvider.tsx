import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  changeAppearanceAxis,
  loadAppearance,
  type AppearanceAxis,
  type AppearanceState,
} from "./appearance";

// One appearance state for the whole interface, so the topbar's theme switch and the appearance
// controls on the UI Kit page always agree.

interface AppearanceValue {
  appearance: AppearanceState;
  changeAppearance: (axis: AppearanceAxis, value: string) => void;
}

const AppearanceContext = createContext<AppearanceValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<AppearanceState>(() => loadAppearance());
  const value = useMemo<AppearanceValue>(
    () => ({
      appearance,
      changeAppearance: (axis, axisValue) => {
        setAppearance((current) => changeAppearanceAxis(current, axis, axisValue));
      },
    }),
    [appearance],
  );
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceValue {
  const value = useContext(AppearanceContext);
  if (value === null) {
    throw new Error("useAppearance must be used inside AppearanceProvider.");
  }
  return value;
}
