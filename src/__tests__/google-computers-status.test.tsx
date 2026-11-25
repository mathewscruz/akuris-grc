import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { persistExplicitLocale } from "@/lib/i18n-locale";
import { GoogleCloudIdentityCredential } from "@/components/configuracoes/integrations/GoogleCloudIdentityCredential";
import type { CollectionConnection } from "@/lib/integration-platform";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() }, auth: { getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } },
}));

const conn = (settings: CollectionConnection["settings"]): CollectionConnection => ({
  id: "g1", provider: "google_workspace" as CollectionConnection["provider"], name: "Google", status: "connected" as CollectionConnection["status"],
  scope_ids: [], frequency: "daily", settings, last_success_at: null, next_run_at: null, error_code: null,
});
const show = (settings: CollectionConnection["settings"]) => {
  persistExplicitLocale("en");
  return render(<LanguageProvider><GoogleCloudIdentityCredential connection={conn(settings)} onChange={() => {}} onReauthorize={() => {}} /></LanguageProvider>);
};
const admin = { email: "admin@a.com", validated_at: "2026-11-25T10:00:00Z" };

describe("Google computers status (no upload)", () => {
  it("old connection: unavailable + no admin identity still offers re-authorise", () => {
    const { container } = show({ cloud_identity: { status: "unavailable" } });
    expect(screen.getByRole("button", { name: "Authorise again" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Check authorisation" })).toBeNull();
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });
  it("unavailable stored + validated admin: check and maintenance re-authorise, no upload", () => {
    const { container } = show({ cloud_identity: { status: "unavailable" }, admin_identity: admin });
    expect(screen.getByRole("button", { name: "Check authorisation" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Authorise again" })).toBeTruthy();
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });
  it("delegation pending with validated admin: guidance + check button + maintenance re-authorise", () => {
    const { container } = show({ cloud_identity: { status: "delegation_pending" }, admin_identity: admin });
    expect(screen.getByRole("button", { name: "Check authorisation" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Authorise again" })).toBeTruthy();
    expect(screen.getByText("110121051822981322395")).toBeTruthy();
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });
  it("active: shows count, check + maintenance re-authorise, no upload", () => {
    const { container } = show({ cloud_identity: { status: "active", count: 6 }, admin_identity: admin });
    expect(screen.getByText(/6 computers/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check authorisation" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Authorise again" })).toBeTruthy();
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });
});
