"use client";
import { OrganizationSwitcher } from "@clerk/nextjs";
import { useSession } from "./session-provider";
import { useClerkConfigured } from "./providers";
export function TeamSwitcher() {
  const configured = useClerkConfigured();
  const { user } = useSession();
  if (!configured || !user) return null;
  return (
    <div className="team-switcher">
      <OrganizationSwitcher
        hidePersonal={false}
        afterCreateOrganizationUrl="/dashboard"
        afterSelectOrganizationUrl="/dashboard"
        afterSelectPersonalUrl="/dashboard"
        organizationProfileMode="modal"
        createOrganizationMode="modal"
      />
    </div>
  );
}
