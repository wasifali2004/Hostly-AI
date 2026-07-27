import type { Metadata } from "next";
import { OrgShell } from "@/components/org/org-shell";

export const metadata: Metadata = {
  title: {
    default: "Workspace",
    template: "%s · Hostly"
  },
  robots: { index: false, follow: false }
};

type Params = Promise<{ orgSlug: string }>;

export default async function OrganizationLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { orgSlug } = await params;
  return <OrgShell orgSlug={orgSlug}>{children}</OrgShell>;
}
