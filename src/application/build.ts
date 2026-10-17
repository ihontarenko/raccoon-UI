// The interface's own version and build, stamped by `vite.config.ts` when it is evaluated.

declare const __RACCOON_BUILD__: {
  version: string;
  builtAt: string;
  kind: "bundle" | "development";
};

export interface InterfaceBuild {
  /** The UI package's version. */
  version: string;
  /** When the bundle was built, or when the development server started. */
  builtAt: Date;
  kind: "bundle" | "development";
}

export const INTERFACE_BUILD: InterfaceBuild = {
  version: __RACCOON_BUILD__.version,
  builtAt: new Date(__RACCOON_BUILD__.builtAt),
  kind: __RACCOON_BUILD__.kind,
};
