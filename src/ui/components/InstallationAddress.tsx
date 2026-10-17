import { Link } from "@tanstack/react-router";
import { Can } from "../../access/Can";
import { PERMISSIONS } from "../../access/permissions";
import { useResource } from "../../application/useResource";
import { api } from "../../lib/api";
import { useTranslation } from "../../translations/TranslationProvider";

/**
 * The address other systems reach this installation at: the administrator's public base address, or —
 * while none is set — the address this browser used, which may be one only this machine can reach.
 *
 * Shared, because every example a person is meant to run elsewhere is built from it, and one built from
 * the browser's own address has to say so. Null while the answer is still loading.
 */
export function usePublicBaseAddress(): { base: string; configured: boolean } | null {
  const addresses = useResource(() => api.installationAddresses(), []);
  if (addresses.status === "loading") {
    return null;
  }
  const configured = addresses.status === "ready" ? addresses.data.publicBaseAddress : null;
  return configured === null
    ? { base: window.location.origin, configured: false }
    : { base: configured, configured: true };
}

/** Said quietly under the examples while they are built from the browser's own address. */
export function BrowserOriginNote() {
  const { t } = useTranslation();
  return (
    <p className="text-xs text-muted">
      {t("installationAddress.browserOrigin", "Built from this browser's address, because no public address is set for Raccoon.")}{" "}
      <Can permission={PERMISSIONS.systemWrite} fallback={t("installationAddress.administratorCanSet", "An administrator can set one.")}>
        {t("installationAddress.setPublicAddress", "{link} ({setting}).", {
          link: (
            <Link to="/administration/settings">
              {t("installationAddress.setPublicAddressLink", "Set it in Administration › System settings")}
            </Link>
          ),
          setting: "installation.public-base-address",
        })}
      </Can>
    </p>
  );
}
