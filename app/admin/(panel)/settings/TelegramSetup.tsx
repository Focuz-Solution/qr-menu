"use client";

import { CheckCircle2, Search, Send } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Opt, Req } from "@/components/FieldMark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ErrorCode } from "@/lib/result";
import { cn } from "@/lib/utils";
import { detectChats, disconnectTelegram, enableTelegramButtons, linkTelegramUser, saveBotToken, saveChat, sendTest, setTelegramEnabled } from "./telegram-actions";

type Settings = {
  connected: boolean;
  botUsername: string | null;
  chatId: string | null;
  chatTitle: string | null;
  threadId: number | null;
  isEnabled: boolean;
  lastTestAt: Date | null;
  lastError: string | null;
};

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

export function TelegramSetup({ settings: s, keyReady, staff }: { settings: Settings; keyReady: boolean; staff: { id: string; name: string; telegramId: string }[] }) {
  const t = useTranslations("admin.telegram");
  const te = useTranslations("errors");
  const format = useFormatter();
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [linked, setLinked] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<ErrorCode | null>(null);
  const [fields, setFields] = useState<Record<string, ErrorCode>>({});
  const [changingToken, setChangingToken] = useState(!s.connected);
  const [chats, setChats] = useState<{ id: string; title: string; isForum: boolean }[] | null>(null);
  const [chatId, setChatId] = useState(s.chatId ?? "");
  const [chatTitle, setChatTitle] = useState(s.chatTitle ?? "");
  const hasChat = !!s.chatId;

  function run(action: () => Promise<{ ok: boolean; error?: ErrorCode; fields?: Record<string, ErrorCode> }>, after?: () => void) {
    setError(null);
    setFields({});
    start(async () => {
      const r = await action();
      if (r.ok) return after?.();
      setFields(r.fields ?? {});
      if (!r.fields) setError(r.error ?? "server");
    });
  }

  return (
    <>
      {error && !confirmingDisconnect && (
        <p role="alert" className="mb-4 rounded-lg border border-destructive/30 px-3 py-2 text-sm text-destructive">{te(error)}</p>
      )}

      <Card className="gap-0 divide-y overflow-hidden py-0">
        <Part title={t("step1")} done={s.connected && !changingToken} blocked={!keyReady ? t("keyRequired") : undefined}>
          {s.connected && !changingToken ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-auto text-sm">
                {t("botConnected")} <span className="font-medium">@{s.botUsername}</span>
              </p>
              <Button variant="outline" size="sm" onClick={() => setChangingToken(true)}>{t("changeToken")}</Button>
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
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const token = String(new FormData(e.currentTarget).get("token") ?? "");
                run(() => saveBotToken(token), () => setChangingToken(false));
              }}
            >
              <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1.5">
                <Label htmlFor="token">{t("token")} <Req /></Label>
                <Input id="token" name="token" type="password" required autoComplete="off" spellCheck={false} placeholder="123456789:AA…" aria-invalid={!!fields.token || undefined} className="h-11 font-mono sm:h-9" />
                {fields.token && <p className="text-xs text-destructive">{te(fields.token)}</p>}
              </div>
              {s.connected && (
                <Button type="button" variant="outline" size="sm" className="mb-1.5 sm:mb-0.5" onClick={() => setChangingToken(false)}>{t("cancel")}</Button>
              )}
              <Button type="submit" size="sm" className="mb-1.5 sm:mb-0.5" disabled={pending}>{t("saveToken")}</Button>
            </form>
          )}
        </Part>

        <Part title={t("step2")} done={hasChat} blocked={!s.connected ? t("botRequired") : undefined}>
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            disabled={pending}
            onClick={() => run(async () => {
              const r = await detectChats();
              if (r.ok) setChats(r.data ?? []);
              return r;
            })}
          >
            <Search aria-hidden />
            {t("detect")}
          </Button>
          {chats && !chats.length && <p className="text-sm text-muted-foreground">{t("noGroupsFound")}</p>}
          {!!chats?.length && (
            <ul className="flex flex-col gap-2">
              {chats.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setChatId(c.id);
                      setChatTitle(c.title);
                    }}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-3 text-left text-sm hover:bg-foreground/5",
                      chatId === c.id && "border-foreground",
                    )}
                  >
                    <span className="font-medium">{c.title}</span>
                    <span className="font-mono text-xs text-muted-foreground">{c.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(() => saveChat({ chatId, chatTitle, threadId: String(f.get("threadId") ?? "") }));
            }}
          >
            <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1.5">
              <Label htmlFor="chatId">{t("chatId")} <Req /></Label>
              <Input id="chatId" value={chatId} onChange={(e) => setChatId(e.target.value)} required inputMode="numeric" placeholder="-1001234567890" aria-invalid={!!fields.chatId || undefined} className="h-11 font-mono sm:h-9" />
              {fields.chatId && <p className="text-xs text-destructive">{te(fields.chatId)}</p>}
            </div>
            <div className="flex w-36 flex-col gap-1.5">
              <Label htmlFor="threadId">{t("threadId")} <Opt /></Label>
              <Input id="threadId" name="threadId" inputMode="numeric" placeholder="—" defaultValue={s.threadId ?? ""} aria-invalid={!!fields.threadId || undefined} className="h-11 font-mono sm:h-9" />
              {fields.threadId && <p className="text-xs text-destructive">{te(fields.threadId)}</p>}
            </div>
            <Button type="submit" size="sm" className="mb-1.5 sm:mb-0.5" disabled={pending || !chatId}>{t("saveGroup")}</Button>
          </form>
        </Part>

        <Part title={t("step3")} done={s.isEnabled} blocked={!s.connected || !hasChat ? t("groupRequired") : undefined}>
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
        <Part title={t("buttonAccess")} done={registered} blocked={!hasChat ? t("groupRequired") : undefined}>
          <Button type="button" size="sm" variant="outline" className="w-fit" disabled={pending} onClick={() => run(enableTelegramButtons, () => setRegistered(true))}>
            {registered ? t("buttonsEnabled") : t("enableButtons")}
          </Button>
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
        onConfirm={() => run(disconnectTelegram, () => {
          setConfirmingDisconnect(false);
          setChangingToken(true);
        })}
      />
    </>
  );
}
