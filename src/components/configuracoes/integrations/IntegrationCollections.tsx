import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EntidadeSelect } from "@/components/common/EntidadeSelect";
import {
  IconPlug,
  IconExternal as IconExternalLink,
  IconRefresh,
  IconSearch,
} from "@/components/icons";
import { toast } from "@/lib/toast";
import { INTEGRATION_COLLECTIONS_ENABLED } from "@/lib/integration-release";
import {
  COLLECTION_PROVIDERS,
  connectionNeedsAttention,
  integrationErrorKey,
  integrationRequest,
  type CollectionConnection,
  type CollectionDetails,
  type CollectionList,
  type CollectionProvider,
} from "@/lib/integration-platform";

function ProviderLogo({ provider }: { provider: CollectionProvider }) {
  const item = COLLECTION_PROVIDERS.find((p) => p.id === provider)!;
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-white p-2.5">
      <img
        src={`/integrations/${item.logo}`}
        alt=""
        className="h-full w-full object-contain"
        width={28}
        height={28}
      />
    </span>
  );
}

export function IntegrationCollections({ empresaId }: { empresaId: string }) {
  return INTEGRATION_COLLECTIONS_ENABLED ? (
    <AvailableIntegrationCollections empresaId={empresaId} />
  ) : (
    <ComingSoonCollections />
  );
}

function ComingSoonCollections() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const providers = COLLECTION_PROVIDERS.filter((provider) =>
    `${provider.name} ${t(`collectionHub.family.${provider.family}`)}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );

  // This catalog deliberately mounts no connection queries, callbacks or dialogs.
  return (
    <section className="space-y-6" aria-label={t("collectionHub.tab")}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl space-y-2">
          <h3 className="text-xl font-semibold tracking-tight">
            {t("collectionHub.title")}
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("collectionHub.comingSoonIntro")}
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <IconSearch className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("collectionHub.search")}
            aria-label={t("collectionHub.search")}
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {providers.map((provider) => (
          <article key={provider.id} className="flex flex-col rounded-lg border bg-card p-5">
            <div className="flex items-center gap-3">
              <ProviderLogo provider={provider.id} />
              <div>
                <h4 className="font-semibold">{provider.name}</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(`collectionHub.family.${provider.family}`)}
                </p>
              </div>
            </div>
            <p className="mb-5 mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
              {t(`collectionHub.provider.${provider.id}`)}
            </p>
            <Button
              disabled
              variant="secondary"
              className="self-start disabled:opacity-100"
              aria-label={`${provider.name}: ${t("collectionHub.comingSoon")}`}
            >
              {t("collectionHub.comingSoon")}
            </Button>
          </article>
        ))}
      </div>
      {!providers.length && (
        <p role="status" className="py-8 text-center text-sm text-muted-foreground">
          {t("collectionHub.noMatch")}
        </p>
      )}
    </section>
  );
}

function AvailableIntegrationCollections({ empresaId }: { empresaId: string }) {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState("connected");
  const [search, setSearch] = useState("");
  const [newProvider, setNewProvider] = useState<CollectionProvider | null>(
    null,
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const client = useQueryClient();
  const key = ["integration-collections", empresaId];
  const query = useQuery({
    queryKey: key,
    queryFn: () => integrationRequest<CollectionList>({ action: "list" }),
    retry: false,
  });
  const connections = query.data?.connections || [];
  const active = connections.find((c) => c.id === activeId);
  const reload = useCallback(
    () =>
      client.invalidateQueries({
        queryKey: ["integration-collections", empresaId],
      }),
    [client, empresaId],
  );
  useEffect(() => {
    const id = searchParams.get("connection");
    if (!id || !query.data) return;
    const result = searchParams.get("integration_result");
    setActiveId(id);
    if (result && result !== "authorized")
      toast.error(t(integrationErrorKey(result)));
    const next = new URLSearchParams(searchParams);
    next.delete("connection");
    next.delete("integration_result");
    setSearchParams(next, { replace: true });
  }, [query.data, searchParams, setSearchParams, t]);
  const matches = (value: string) =>
    value.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim());
  const visible = connections
    .filter((c) =>
      matches(
        `${c.name} ${COLLECTION_PROVIDERS.find((p) => p.id === c.provider)?.name}`,
      ),
    )
    .filter((c) => view !== "attention" || connectionNeedsAttention(c));
  const providers = COLLECTION_PROVIDERS.filter((p) =>
    matches(`${p.name} ${t(`collectionHub.family.${p.family}`)}`),
  );

  return (
    <section className="space-y-6" aria-label={t("collectionHub.tab")}>
      <div className="max-w-3xl space-y-2">
        <h3 className="text-xl font-semibold tracking-tight">
          {t("collectionHub.title")}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("collectionHub.intro")}
        </p>
      </div>
      {query.isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm"
        >
          <span>{t("collectionHub.loadError")}</span>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {t("collectionHub.retry")}
          </Button>
        </div>
      )}
      <Tabs value={view} onValueChange={setView}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="h-auto flex-wrap">
            {["connected", "attention", "catalog"].map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {t(`collectionHub.${tab}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="relative w-full sm:w-72">
            <IconSearch className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("collectionHub.search")}
              aria-label={t("collectionHub.search")}
            />
          </div>
        </div>
        {["connected", "attention"].map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-3 pt-3">
            {query.isPending ? (
              <p role="status" className="py-8 text-sm text-muted-foreground">
                {t("common.loading")}
              </p>
            ) : visible.length ? (
              visible.map((connection) => {
                const needsAttention = connectionNeedsAttention(connection);
                return (
                  <article
                    key={connection.id}
                    className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4 sm:p-5"
                  >
                    <ProviderLogo provider={connection.provider} />
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate font-semibold">
                        {connection.name}
                      </h4>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {
                          COLLECTION_PROVIDERS.find(
                            (p) => p.id === connection.provider,
                          )?.name
                        }
                      </p>
                    </div>
                    <div className="text-sm sm:text-right">
                      <p
                        className={
                          needsAttention
                            ? "text-warning"
                            : "text-muted-foreground"
                        }
                      >
                        {t(
                          `collectionHub.${needsAttention && connection.status === "connected" ? "stale" : `status.${connection.status}`}`,
                        )}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("collectionHub.lastSuccess")}:{" "}
                        {connection.last_success_at
                          ? new Date(
                              connection.last_success_at,
                            ).toLocaleString()
                          : t("collectionHub.never")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setActiveId(connection.id)}
                    >
                      {t("collectionHub.manage")}
                    </Button>
                  </article>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {t("collectionHub.empty")}
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setView("catalog")}
                >
                  {t("collectionHub.catalog")}
                </Button>
              </div>
            )}
          </TabsContent>
        ))}
        <TabsContent value="catalog" className="pt-3">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {providers.map((provider) => (
              <article
                key={provider.id}
                className="flex flex-col rounded-lg border bg-card p-5 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <ProviderLogo provider={provider.id} />
                  <div>
                    <h4 className="font-semibold">{provider.name}</h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t(`collectionHub.family.${provider.family}`)}
                    </p>
                  </div>
                </div>
                <p className="mb-5 mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {t(`collectionHub.provider.${provider.id}`)}
                </p>
                <Button
                  variant="outline"
                  className="self-start"
                  onClick={() => setNewProvider(provider.id)}
                >
                  {t("collectionHub.connect")}
                </Button>
              </article>
            ))}
          </div>
          {!providers.length && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("collectionHub.noMatch")}
            </p>
          )}
        </TabsContent>
      </Tabs>
      <p className="max-w-4xl text-xs leading-relaxed text-muted-foreground">
        {t("collectionHub.caveat")}
      </p>
      {newProvider && (
        <NewConnection
          key={newProvider}
          provider={newProvider}
          ready={query.data?.availability[newProvider] === true}
          close={() => {
            setNewProvider(null);
            void reload();
          }}
          onCreated={async (id) => {
            await reload();
            setActiveId(id);
          }}
        />
      )}
      {active && (
        <ConnectionManager
          key={active.id}
          connection={active}
          empresaId={empresaId}
          schedulerReady={query.data?.scheduler_ready === true}
          close={() => setActiveId(null)}
          reload={reload}
        />
      )}
    </section>
  );
}

function NewConnection({
  provider,
  ready,
  close,
  onCreated,
}: {
  provider: CollectionProvider;
  ready: boolean;
  close: () => void;
  onCreated: (id: string) => Promise<void>;
}) {
  const { t } = useLanguage();
  const product = COLLECTION_PROVIDERS.find((p) => p.id === provider)!;
  const [name, setName] = useState<string>(product.name);
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);
  const [authorization, setAuthorization] = useState<{
    authorize_url: string;
    connection_id: string;
    aws?: boolean;
    install_url?: string;
  } | null>(null);
  async function start() {
    setBusy(true);
    try {
      setAuthorization(
        await integrationRequest({
          action: "start",
          provider,
          name,
          account_id: account,
        }),
      );
    } catch (error) {
      toast.error(t(integrationErrorKey((error as Error).message)));
    } finally {
      setBusy(false);
    }
  }
  return (
    <DialogShell
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
      title={`${t("collectionHub.newTitle")} · ${product.name}`}
      description={t("collectionHub.authReturn")}
      icon={IconPlug}
      size="md"
      hideFooter
    >
      <div className="space-y-5 p-1">
        <ProviderLogo provider={provider} />
        <div>
          <h4 className="font-medium">{t("collectionHub.permissions")}</h4>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t(`collectionHub.provider.${provider}`)}
          </p>
        </div>
        {product.family === "documents" && (
          <p className="rounded-lg bg-muted/40 p-3 text-sm">
            {t("collectionHub.metadataOnly")}
          </p>
        )}
        {!ready ? (
          <div role="status" className="rounded-lg border bg-muted/30 p-4">
            <h4 className="font-medium">{t("collectionHub.setup")}</h4>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("collectionHub.setupDetail")}
            </p>
          </div>
        ) : authorization ? (
          <div className="space-y-4 rounded-lg border p-4">
            {authorization.install_url && (
              <div className="space-y-3 border-b pb-4">
                <p className="text-sm">{t("collectionHub.githubInstall")}</p>
                <Button variant="outline" asChild>
                  <a
                    href={authorization.install_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("collectionHub.install")}
                  </a>
                </Button>
              </div>
            )}
            <p className="text-sm">
              {t(
                authorization.aws
                  ? "collectionHub.awsReturn"
                  : "collectionHub.authReturn",
              )}
            </p>
            <Button asChild>
              <a
                href={authorization.authorize_url}
                {...(authorization.aws
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {t("collectionHub.authorizedLink")}
                <IconExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
            {authorization.aws && (
              <Button
                variant="outline"
                className="ml-2"
                onClick={async () => {
                  await onCreated(authorization.connection_id);
                  close();
                }}
              >
                {t("collectionHub.manage")}
              </Button>
            )}
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void start();
            }}
          >
            <label className="block space-y-2 text-sm font-medium">
              <span>{t("collectionHub.name")}</span>
              <Input
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("collectionHub.nameHint")}
              />
            </label>
            {provider === "aws" && (
              <label className="block space-y-2 text-sm font-medium">
                <span>{t("collectionHub.account")}</span>
                <Input
                  required
                  inputMode="numeric"
                  pattern="[0-9]{12}"
                  maxLength={12}
                  value={account}
                  onChange={(e) =>
                    setAccount(e.target.value.replace(/\D/g, ""))
                  }
                />
              </label>
            )}
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? t("common.loading") : t("collectionHub.authorize")}
            </Button>
          </form>
        )}
      </div>
    </DialogShell>
  );
}

function ConnectionManager({
  connection,
  empresaId,
  schedulerReady,
  close,
  reload,
}: {
  connection: CollectionConnection;
  empresaId: string;
  schedulerReady: boolean;
  close: () => void;
  reload: () => Promise<unknown>;
}) {
  const { t } = useLanguage();
  const [page, setPage] = useState(0);
  const [scope, setScope] = useState(new Set(connection.scope_ids));
  const [frequency, setFrequency] = useState(connection.frequency);
  const [system, setSystem] = useState(connection.settings.system_id || "");
  const [region, setRegion] = useState(
    connection.settings.region || "us-east-1",
  );
  const [busy, setBusy] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [reconnectUrl, setReconnectUrl] = useState("");
  const query = useQuery({
    queryKey: ["integration-details", empresaId, connection.id, page],
    queryFn: () =>
      integrationRequest<CollectionDetails>({
        action: "details",
        connection_id: connection.id,
        page,
      }),
    retry: false,
    refetchInterval: (q) =>
      q.state.data?.runs.some((run) =>
        ["queued", "running"].includes(run.status),
      )
        ? 5000
        : false,
  });
  const runs = query.data?.runs || [];
  const running = runs.some((run) =>
    ["queued", "running"].includes(run.status),
  );
  const dirty =
    frequency !== connection.frequency ||
    region !== (connection.settings.region || "us-east-1") ||
    system !== (connection.settings.system_id || "") ||
    scope.size !== connection.scope_ids.length ||
    connection.scope_ids.some((id) => !scope.has(id));
  const latestStatus = runs[0]?.status;
  useEffect(() => {
    void reload();
  }, [latestStatus, reload]); // Refresh health after background collection.
  async function perform(action: string, extras: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const result = await integrationRequest<{
        authorize_url?: string;
        url?: string;
      }>({ action, connection_id: connection.id, ...extras });
      if (result.authorize_url) setReconnectUrl(result.authorize_url);
      if (result.url) {
        // Signed URL includes Content-Disposition: attachment. A same-tab
        // download does not depend on a popup opened after an async request.
        const link = document.createElement("a");
        link.href = result.url;
        link.rel = "noreferrer";
        link.download = "";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      if (action === "configure") toast.success(t("collectionHub.saved"));
      if (action === "collect") toast.success(t("collectionHub.queued"));
      if (action === "disconnect") {
        await reload();
        close();
        return;
      }
      await Promise.all([reload(), query.refetch()]);
    } catch (error) {
      toast.error(t(integrationErrorKey((error as Error).message)));
    } finally {
      setBusy(false);
    }
  }
  const resources = query.data?.resources || [];
  const changeSelection = (ids: string[], checked: boolean) =>
    setScope((previous) => {
      const next = new Set(previous);
      ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  const locked = busy || running;
  const identity = ["microsoft365", "entra_id"].includes(connection.provider);
  return (
    <>
      <DialogShell
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={connection.name}
        icon={IconPlug}
        size="xl"
        description={t(`collectionHub.provider.${connection.provider}`)}
        isDirty={dirty}
        isSubmitting={busy}
        onSubmit={() =>
          void perform("configure", {
            frequency,
            region,
            scope_ids: [...scope],
            system_id: system || null,
          })
        }
        submitLabel={t("collectionHub.save")}
        submitDisabled={locked || !dirty}
      >
        <div className="space-y-6 p-1">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <div className="flex items-center gap-3">
              <ProviderLogo provider={connection.provider} />
              <div>
                <p className="text-sm font-medium">
                  {t(`collectionHub.status.${connection.status}`)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("collectionHub.lastSuccess")}:{" "}
                  {connection.last_success_at
                    ? new Date(connection.last_success_at).toLocaleString()
                    : t("collectionHub.never")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void query.refetch()}
                aria-label={t("collectionHub.refresh")}
              >
                <IconRefresh className="h-4 w-4" />
              </Button>
              <Button
                disabled={
                  locked ||
                  dirty ||
                  connection.status === "paused" ||
                  (connection.status === "pending" &&
                    connection.provider !== "aws")
                }
                onClick={() => void perform("collect")}
              >
                {running
                  ? t("collectionHub.status.running")
                  : t(
                      scope.size
                        ? "collectionHub.collect"
                        : "collectionHub.discover",
                    )}
              </Button>
            </div>
          </div>
          <ol className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            {["authorize", "scope", "collect"].map((step) => (
              <li key={step} className="rounded-md bg-muted/40 px-3 py-2">
                {t(`collectionHub.steps.${step}`)}
              </li>
            ))}
          </ol>
          {connection.error_code && (
            <p
              role="alert"
              className="rounded-lg border border-warning/25 bg-warning/5 p-3 text-sm"
            >
              {t(integrationErrorKey(connection.error_code))}
            </p>
          )}
          <section className="space-y-3">
            <div>
              <h4 className="font-semibold">{t("collectionHub.scope")}</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("collectionHub.scopeHelp")}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm">
                {scope.size} {t("collectionHub.selected")}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={locked || !resources.length}
                  onClick={() =>
                    changeSelection(
                      resources.map((r) => r.external_id),
                      true,
                    )
                  }
                >
                  {t("collectionHub.selectPage")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={locked || !resources.length}
                  onClick={() =>
                    changeSelection(
                      resources.map((r) => r.external_id),
                      false,
                    )
                  }
                >
                  {t("collectionHub.clearPage")}
                </Button>
              </div>
            </div>
            {query.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {t(integrationErrorKey((query.error as Error).message))}
              </p>
            ) : query.isPending ? (
              <p role="status">{t("common.loading")}</p>
            ) : !resources.length ? (
              <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                {t("collectionHub.noResources")}
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <span className="sr-only">
                          {t("collectionHub.scope")}
                        </span>
                      </TableHead>
                      <TableHead>{t("collectionHub.resources")}</TableHead>
                      <TableHead>{t("collectionHub.collectedAt")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resources.map((resource) => (
                      <TableRow key={resource.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-primary"
                            aria-label={resource.name}
                            disabled={locked}
                            checked={scope.has(resource.external_id)}
                            onChange={(e) =>
                              changeSelection(
                                [resource.external_id],
                                e.target.checked,
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <p className="break-all font-medium">
                            {resource.name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t(`collectionHub.kind.${resource.kind}`)}
                          </p>
                          {resource.source_url &&
                            /^https:\/\//.test(resource.source_url) && (
                              <a
                                href={resource.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                              >
                                {t("collectionHub.source")}
                                <IconExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          {!!resource.checks?.length && (
                            <details className="mt-2 text-xs">
                              <summary className="cursor-pointer text-muted-foreground">
                                {t("collectionHub.checksTitle")}
                              </summary>
                              <ul className="mt-2 space-y-1">
                                {resource.checks.map((check) => (
                                  <li
                                    key={check.key}
                                    className={
                                      check.status === "fail"
                                        ? "text-destructive"
                                        : check.status === "pass"
                                          ? "text-success"
                                          : "text-muted-foreground"
                                    }
                                  >
                                    {t(`collectionHub.checks.${check.key}`)}:{" "}
                                    {t(
                                      `collectionHub.checkStatus.${check.status}`,
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(resource.collected_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {(query.data?.count || 0) > 50 && (
              <div className="flex items-center justify-end gap-3 text-sm">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!page || query.isFetching}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t("collectionHub.previous")}
                </Button>
                <span>
                  {t("collectionHub.page")} {page + 1} /{" "}
                  {Math.ceil((query.data?.count || 0) / 50)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    (page + 1) * 50 >= (query.data?.count || 0) ||
                    query.isFetching
                  }
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t("collectionHub.next")}
                </Button>
              </div>
            )}
          </section>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              <span>{t("collectionHub.frequency")}</span>
              <select
                value={frequency}
                disabled={locked}
                onChange={(e) =>
                  setFrequency(
                    e.target.value as CollectionConnection["frequency"],
                  )
                }
                className="flex h-10 w-full rounded-md border bg-background px-3 text-sm font-normal"
              >
                {["manual", "daily", "weekly"].map((value) => (
                  <option
                    key={value}
                    value={value}
                    disabled={value !== "manual" && !schedulerReady}
                  >
                    {t(`collectionHub.${value}`)}
                  </option>
                ))}
              </select>
              {!schedulerReady && (
                <span className="block text-xs font-normal leading-relaxed text-muted-foreground">
                  {t("collectionHub.schedulerMissing")}
                </span>
              )}
            </label>
            {identity && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {t("collectionHub.system")}
                </p>
                <EntidadeSelect
                  entidade="sistema"
                  value={system}
                  onValueChange={setSystem}
                  disabled={locked}
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("collectionHub.systemHelp")}
                </p>
              </div>
            )}
            {connection.provider === "aws" && (
              <label className="space-y-2 text-sm font-medium">
                <span>{t("collectionHub.region")}</span>
                <Input
                  value={region}
                  disabled={locked}
                  onChange={(e) => setRegion(e.target.value)}
                  pattern="[a-z]{2}-[a-z]+-[0-9]"
                />
              </label>
            )}
          </div>
          <section className="space-y-3 border-t pt-5">
            <h4 className="font-semibold">{t("collectionHub.history")}</h4>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("collectionHub.evidenceHelp")}
            </p>
            {!runs.length && (
              <p className="text-sm text-muted-foreground">
                {t("collectionHub.historyEmpty")}
              </p>
            )}
            <ul className="divide-y">
              {runs.map((run) => (
                <li
                  key={run.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                >
                  <div>
                    <p>
                      {t(`collectionHub.status.${run.status}`)} ·{" "}
                      {new Date(run.created_at).toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {run.resource_count} {t("collectionHub.resources")}
                      {!run.evidence_id &&
                      ["success", "partial"].includes(run.status)
                        ? ` · ${t("collectionHub.discoveryOnly")}`
                        : ""}
                    </p>
                    {run.error_code && (
                      <p className="mt-1 max-w-xl text-xs text-warning">
                        {t(integrationErrorKey(run.error_code))}
                      </p>
                    )}
                  </div>
                  {run.evidence_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void perform("download_evidence", { run_id: run.id })
                      }
                    >
                      {t("collectionHub.evidence")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button
              variant="outline"
              disabled={locked}
              onClick={() =>
                void perform(
                  connection.status === "paused" ? "resume" : "pause",
                )
              }
            >
              {t(
                connection.status === "paused"
                  ? "collectionHub.resume"
                  : "collectionHub.pause",
              )}
            </Button>
            <Button
              variant="outline"
              disabled={locked}
              onClick={() =>
                void perform("start", {
                  provider: connection.provider,
                  name: connection.name,
                  account_id: connection.settings.role_arn?.split(":")[4],
                })
              }
            >
              {t("collectionHub.reconnect")}
            </Button>
            <Button
              variant="ghost"
              className="text-destructive"
              disabled={locked}
              onClick={() => setConfirmDisconnect(true)}
            >
              {t("collectionHub.disconnect")}
            </Button>
            {reconnectUrl && (
              <Button asChild>
                <a
                  href={reconnectUrl}
                  target={connection.provider === "aws" ? "_blank" : undefined}
                  rel="noopener noreferrer"
                >
                  {t("collectionHub.authorizedLink")}
                </a>
              </Button>
            )}
          </div>
        </div>
      </DialogShell>
      <DialogShell
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title={t("collectionHub.disconnectTitle")}
        description={t("collectionHub.disconnectHelp")}
        size="sm"
        onSubmit={() => void perform("disconnect")}
        submitLabel={t("collectionHub.disconnect")}
        isSubmitting={busy}
      >
        <p className="text-sm">{connection.name}</p>
      </DialogShell>
    </>
  );
}
