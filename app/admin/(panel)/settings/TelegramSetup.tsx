"use client";

import { CheckCircle2, Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Opt, Req } from "@/components/FieldMark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ErrorCode } from "@/lib/result";
import { checkTelegramConnect, disconnectTelegram, linkTelegramUser, sendTest, setTelegramEnabled, startTelegramConnect } from "./telegram-actions";

type Settings = {
  chatId: string | null;
  chatTitle: string | null;
  isEnabled: boolean;
  lastTestAt: Date | null;
  lastError: string | null;
};

const POLL_MS = 3_000;
const WAIT_MS = 15 * 60_000; // the connect code lasts 15 minutes

function Part({ title, done, blocked, children }: { title: string; done: boolean; blocked?: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 space-y-3 p-4">
      <h2 className="flex items-center gap-2.5 text-sm font-semibold">
        {done && (
          <CheckCircle2 className="size-5 text-ok-foreground" aria-hidden />
        )}
        {title}
      </h2>
      {blocked ? (
        <p className="text-xs text-muted-foreground">{blocked}</p>
      ) : (
        <div className="flex min-w-0 flex-col gap-3">{children}</div>
      )}
    </section>
  );
}

export function TelegramSetup({ settings: s, botReady, staff }: { settings: Settings; botReady: boolean; staff: { id: string; name: string; telegramId: string }[] }) {
  const t = useTranslations("admin.telegram");
  const te = useTranslations("errors");
  const format = useFormatter();
  const router = useRouter();
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [linked, setLinked] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<ErrorCode | null>(null);
  // the t.me link while waiting for the admin to pick a group in Telegram
  const [connectUrl, setConnectUrl] = useState<string | null>(null);
  const hasChat = !!s.chatId;

  function run(action: () => Promise<{ ok: boolean; error?: ErrorCode }>, after?: () => void) {
    setError(null);
    start(async () => {
      const r = await action();
      if (r.ok) return after?.();
      setError(r.error ?? "server");
    });
  }

  function connect() {
    setError(null);
    // open the tab now (inside the click) so the browser doesn't block it, then send it to Telegram
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null; // the Telegram page can't reach back into the admin tab
    start(async () => {
      const r = await startTelegramConnect();
      if (!r.ok || !r.data) {
        tab?.close();
        setError(r.ok ? "server" : r.error);
        return;
      }
      if (tab) tab.location.href = r.data.url;
      setConnectUrl(r.data.url);
    });
  }

  // while waiting: ask the server every few seconds whether the bot was added to a group
  useEffect(() => {
    if (!connectUrl) return;
    const startedAt = Date.now();
    let busy = false;
    const timer = setInterval(async () => {
      if (busy) return;
      if (Date.now() - startedAt > WAIT_MS) {
        setConnectUrl(null);
        return;
      }
      busy = true;
      const r = await checkTelegramConnect().catch(() => null);
      busy = false;
      if (r?.ok && r.data?.linked) {
        setConnectUrl(null);
        router.refresh();
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [connectUrl, router]);

  return (
    <>
      {error && !confirmingDisconnect && (
        <p role="alert" className="mb-4 rounded-lg border border-destructive/30 px-3 py-2 text-sm text-destructive">{te(error)}</p>
      )}

      <Card className="gap-0 divide-y overflow-hidden py-0">
        <Part title={t("step1")} done={hasChat && !connectUrl} blocked={!botReady ? t("botNotSet") : undefined}>
          {connectUrl ? (
            <div role="status" className="flex flex-col gap-3 rounded-lg bg-muted/50 p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {t("waiting")}
              </p>
              <p className="text-xs text-muted-foreground">{t("waitingHint")}</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={connectUrl} target="_blank" rel="noreferrer">
                    <Send aria-hidden />
                    {t("openTelegram")}
                  </a>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConnectUrl(null)}>{t("cancel")}</Button>
              </div>
            </div>
          ) : hasChat ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-auto text-sm">
                {t("groupLinked")} <span className="font-medium">{s.chatTitle || s.chatId}</span>
              </p>
              <Button variant="outline" size="sm" disabled={pending} onClick={connect}>{t("changeGroup")}</Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  setConfirmingDisconnect(true);
                }}
              >
                {t("disconnect")}
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t("connectHint")}</p>
              <Button className="h-11 w-fit" disabled={pending} onClick={connect}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
                {t("connect")}
              </Button>
            </>
          )}
        </Part>

        <Part title={t("step3")} done={s.isEnabled} blocked={!hasChat ? t("groupRequired") : undefined}>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" disabled={pending} onClick={() => run(sendTest)}>
              <Send aria-hidden />
              {t("sendTest")}
            </Button>
            {s.lastTestAt && (
              <p className="text-xs text-muted-foreground">
                {t("lastTest", { time: format.dateTime(s.lastTestAt, { dateStyle: "medium", timeStyle: "short" }) })}
              </p>
            )}
          </div>
          {s.lastError && (
            <p className="rounded-lg border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {t("lastError")}: <span className="font-mono">{s.lastError}</span>
            </p>
          )}
          <div className="flex min-h-11 items-center gap-2.5">
            <Switch aria-labelledby="telegram-notifications-label" checked={s.isEnabled} disabled={pending} onCheckedChange={(on) => run(() => setTelegramEnabled(on))} />
            <Label asChild><span id="telegram-notifications-label">{t("enabled")}</span></Label>
          </div>
        </Part>

        <Part title={t("buttonAccess")} done={staff.some((account) => account.telegramId)} blocked={!hasChat ? t("groupRequired") : undefined}>
          <p className="text-xs text-muted-foreground">{t("buttonAccessHint")}</p>
          <form className="@container grid gap-2" onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            setLinked(false);
            run(() => linkTelegramUser(String(data.get("staff") ?? ""), String(data.get("telegramId") ?? "")), () => setLinked(true));
          }}>
            <div className="grid gap-2 @[32rem]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] @[32rem]:items-end">
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="telegram-staff">{t("staffAccount")} <Req /></Label>
                <Select name="staff" defaultValue={staff[0]?.id} required>
                  <SelectTrigger id="telegram-staff" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}{account.telegramId && ` · ${account.telegramId}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="telegram-user-id">{t("telegramUserId")} <Opt /></Label>
                <Input id="telegram-user-id" name="telegramId" inputMode="numeric" maxLength={16} className="h-9" />
              </div>
              <Button size="sm" className="w-fit" disabled={pending}>{t("saveLink")}</Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("telegramUserHint")}</p>
            {linked && <p role="status" className="text-xs text-ok-foreground">{t("linkSaved")}</p>}
          </form>
        </Part>
      </Card>
      <DeleteConfirmDialog
        open={confirmingDisconnect}
        onClose={() => {
          setError(null);
          setConfirmingDisconnect(false);
        }}
        title={t("disconnect")}
        description={t("confirmDisconnect")}
        cancelLabel={t("cancel")}
        deleteLabel={t("disconnect")}
        pending={pending}
        error={error ? te(error) : undefined}
        onConfirm={() => run(disconnectTelegram, () => setConfirmingDisconnect(false))}
      />
    </>
  );
}
