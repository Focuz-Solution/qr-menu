"use client";

import { KeyRound, Plus, Store, Trash2, UserCheck, UserX, Wand2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ErrorCode, Result } from "@/lib/result";
import { cn } from "@/lib/utils";
import { Pager, paginate } from "@/components/Pager";
import { type Sort, SortHead } from "@/components/SortHead";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { createStaff, deleteStaff, resetPassword, setUserShops, updateStaff } from "./actions";
import { Req } from "@/components/FieldMark";

/**
 * A person on the list: `roleId` = their role in this shop ("owner" = the app owner, every shop);
 * `canManage` = you may change them (worked out on the server, which checks again); `shops` = where they work
 * and their role there (sent to the owner only, for the Shops dialog).
 */
type Staff = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  locked: boolean;
  canManage: boolean;
  shops: { shopId: string; roleId: string }[];
};
/** a role from Admin → Roles; `givable` = not stronger than yours, so you may give it */
type RoleOption = { id: string; name: string; givable: boolean };
type ShopOption = { id: string; name: string };
const OWNER = "owner";
const PAGE_SIZE = 10;
type SortKey = "name" | "email" | "role" | "lastLoginAt" | "status";
// status order: active, locked, disabled
const statusRank = (u: Staff) => (!u.isActive ? 2 : u.locked ? 1 : 0);
const compareBy = (roles: RoleOption[]): Record<SortKey, (a: Staff, b: Staff) => number> => ({
  name: (a, b) => a.name.localeCompare(b.name),
  email: (a, b) => a.email.localeCompare(b.email),
  // in the Roles page's order
  role: (a, b) => roles.findIndex((r) => r.id === a.roleId) - roles.findIndex((r) => r.id === b.roleId),
  lastLoginAt: (a, b) => (a.lastLoginAt ? +a.lastLoginAt : 0) - (b.lastLoginAt ? +b.lastLoginAt : 0),
  status: (a, b) => statusRank(a) - statusRank(b),
});

// 16 random characters (browser crypto) — the owner copies it to the staff member before saving
function randomPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_");
}

/** `isOwner` = you are the app owner: you may make owners and set which shops someone works in */
export function StaffManager({
  users,
  meId,
  isOwner,
  roles,
  shops,
  currentShopId,
}: {
  users: Staff[];
  meId: string;
  isOwner: boolean;
  roles: RoleOption[];
  shops: ShopOption[];
  currentShopId: string;
}) {
  const t = useTranslations("admin.staff");
  const ts = useTranslations("admin.settings");
  const tr = useTranslations("admin.roles");
  const te = useTranslations("errors");
  const format = useFormatter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<ErrorCode | null>(null);
  const [dialog, setDialog] = useState<{ kind: "add" } | { kind: "reset"; user: Staff } | { kind: "shops"; user: Staff } | null>(null);
  const [sort, setSort] = useState<Sort<SortKey>>({ key: "name", desc: false });
  const [page, setPage] = useState(0);
  // owners are pinned to the top; the column sort orders people inside each group
  const pin = (u: Staff) => (u.roleId === OWNER ? 0 : 1);
  const compare = compareBy(roles);
  const sorted = users.toSorted((a, b) => pin(a) - pin(b) || (sort.desc ? -1 : 1) * compare[sort.key](a, b));
  const roleName = (id: string) => (id === OWNER ? tr("owner") : (roles.find((r) => r.id === id)?.name ?? "—"));
  const { pages, current, rows } = paginate(sorted, page, PAGE_SIZE);
  const onSort = (key: SortKey) => {
    setSort((s) => ({ key, desc: s.key === key ? !s.desc : true }));
    setPage(0);
  };

  const [removing, setRemoving] = useState<Staff | null>(null);
  // disabling asks first (enabling again doesn't)
  const [disabling, setDisabling] = useState<Staff | null>(null);
  const [removeError, setRemoveError] = useState<ErrorCode>();

  function run(action: () => Promise<Result>) {
    setError(null);
    start(async () => {
      const r = await action();
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <>
      {/* page header: title + subtitle, Add user on the right */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <h1 className="font-heading text-2xl font-medium md:text-3xl">{ts("staffTitle")}</h1>
          <p className="text-sm text-muted-foreground">{ts("staffIntro")}</p>
        </div>
        <Button size="sm" onClick={() => setDialog({ kind: "add" })}>
          <Plus aria-hidden />
          {t("add")}
        </Button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {te(error)}
        </p>
      )}

      <Card className="gap-0 overflow-hidden py-0">
        <Table>
          <TableHeader className="bg-muted/50 [&_th]:h-11 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground">
            <TableRow className="hover:bg-transparent">
              <SortHead k="name" sort={sort} onSort={onSort} className="w-[34%] pl-4 md:w-[21%]">{t("name")}</SortHead>
              <SortHead k="email" sort={sort} onSort={onSort} className="hidden w-[24%] md:table-cell">{t("email")}</SortHead>
              <SortHead k="role" sort={sort} onSort={onSort} className="w-[22%] md:w-[17%]">{t("role")}</SortHead>
              <SortHead k="lastLoginAt" sort={sort} onSort={onSort} className="hidden w-[20%] md:table-cell">{t("lastLogin")}</SortHead>
              <SortHead k="status" sort={sort} onSort={onSort} className="hidden w-[12%] sm:table-cell">{t("status")}</SortHead>
              <TableHead className="pr-4 text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* nobody added to this shop yet: one full-width row with a hint */}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {rows.map((u) => {
              const me = u.id === meId;
              // yourself: only a new password; anyone else: only if your role is strong enough (worked out by the page)
              const canManage = !me && u.canManage;
              return (
                <TableRow key={u.id} className={cn("h-14", !u.isActive && "opacity-60")}>
                  <TableCell className="max-w-0 pl-4">
                    <p className="truncate font-medium">
                      {u.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground md:hidden">{u.email}</p>
                  </TableCell>
                  <TableCell className="hidden max-w-0 truncate text-muted-foreground md:table-cell" title={u.email}>
                    {u.email}
                  </TableCell>
                  <TableCell>
                    {/* someone you can't manage, or an owner (app-wide, not a role in a shop), can't be changed here;
                        someone not in this shop (owner's view): picking a role adds them */}
                    {u.roleId === OWNER || !canManage ? (
                      <span className="text-sm text-muted-foreground">{roleName(u.roleId)}</span>
                    ) : (
                      <Select value={u.roleId} disabled={pending} onValueChange={(roleId) => run(() => updateStaff(u.id, { roleId }))}>
                        <SelectTrigger aria-label={`${t("role")}: ${u.name}`} size="sm" className={cn("w-36", !u.roleId && "text-muted-foreground")}>
                          <SelectValue placeholder={t("notHere")} />
                        </SelectTrigger>
                        <SelectContent>
                          {/* roles stronger than yours show but can't be picked */}
                          {roles.map((r) => (
                            <SelectItem key={r.id} value={r.id} disabled={!r.givable}>{r.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground tabular-nums md:table-cell">
                    {u.lastLoginAt ? format.dateTime(u.lastLoginAt, { dateStyle: "medium", timeStyle: "short" }) : t("never")}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="flex flex-wrap gap-1">
                      {u.locked ? (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">{t("locked")}</span>
                      ) : u.isActive ? (
                        <span className="rounded-full bg-ok px-2 py-0.5 text-xs font-semibold text-ok-foreground">{t("active")}</span>
                      ) : (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{t("inactive")}</span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="pr-4">
                    {/* icon-only actions, like the Menu category toolbar */}
                    <div className="flex items-center justify-end gap-0.5">
                      {/* the owner: which shops this person works in (owners already have every shop) */}
                      {isOwner && !me && u.roleId !== OWNER && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="rounded-md text-muted-foreground hover:text-foreground"
                          disabled={pending}
                          onClick={() => setDialog({ kind: "shops", user: u })}
                          aria-label={`${t("shops")}: ${u.name}`}
                          title={t("shops")}
                        >
                          <Store aria-hidden />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-md text-muted-foreground hover:text-foreground"
                        disabled={pending || (!me && !canManage)}
                        onClick={() => setDialog({ kind: "reset", user: u })}
                        aria-label={`${t("resetPassword")}: ${u.name}`}
                        title={t("resetPassword")}
                      >
                        <KeyRound aria-hidden />
                      </Button>
                      {!me && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className={cn("rounded-md", u.isActive ? "text-destructive/80 hover:bg-destructive/10 hover:text-destructive" : "text-muted-foreground hover:text-foreground")}
                          disabled={pending || !canManage}
                          onClick={() => (u.isActive ? setDisabling(u) : run(() => updateStaff(u.id, { isActive: true })))}
                          aria-label={`${u.isActive ? t("deactivate") : t("activate")}: ${u.name}`}
                          title={u.isActive ? t("deactivate") : t("activate")}
                        >
                          {u.isActive ? <UserX aria-hidden /> : <UserCheck aria-hidden />}
                        </Button>
                      )}
                      {!me && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="rounded-md text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                          disabled={pending || !canManage || !u.roleId}
                          onClick={() => {
                            setRemoveError(undefined);
                            setRemoving(u);
                          }}
                          aria-label={`${t("delete")}: ${u.name}`}
                          title={t("delete")}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      <Pager page={current} pages={pages} size={PAGE_SIZE} shown={rows.length} total={sorted.length} onPage={setPage} />

      {/* disable: confirm first — they're signed out right away */}
      <DeleteConfirmDialog
        open={!!disabling}
        onClose={() => setDisabling(null)}
        onConfirm={() => {
          const u = disabling;
          if (!u) return;
          setDisabling(null);
          run(() => updateStaff(u.id, { isActive: false }));
        }}
        title={t("disableTitle", { name: disabling?.name ?? "" })}
        description={t("confirmDeactivate", { name: disabling?.name ?? "" })}
        cancelLabel={t("cancel")}
        deleteLabel={t("deactivate")}
        pending={pending}
      />

      {/* delete: confirm first (owner → the account; anyone else → leaves this shop) */}
      <DeleteConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          const u = removing;
          if (!u) return;
          start(async () => {
            const r = await deleteStaff(u.id);
            if (r.ok) setRemoving(null);
            else setRemoveError(r.error);
          });
        }}
        title={t("deleteTitle", { name: removing?.name ?? "" })}
        description={t(removing?.roleId === OWNER ? "deleteOwnerText" : "deleteText")}
        cancelLabel={t("cancel")}
        deleteLabel={t("delete")}
        pending={pending}
        error={removeError && te(removeError)}
      />

      <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="gap-0 p-0 sm:max-w-md">
          {dialog?.kind === "add" && <AddForm roles={roles} isOwner={isOwner} onDone={() => setDialog(null)} />}
          {dialog?.kind === "reset" && <ResetForm user={dialog.user} onDone={() => setDialog(null)} />}
          {dialog?.kind === "shops" && (
            <ShopsForm user={dialog.user} shops={shops} roles={roles} currentShopId={currentShopId} onDone={() => setDialog(null)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PasswordField({ error }: { error?: ErrorCode }) {
  const t = useTranslations("admin.staff");
  const te = useTranslations("errors");
  const [value, setValue] = useState("");
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="password">{t("password")} <Req /></Label>
      <div className="flex gap-2">
        {/* visible on purpose: the owner copies it and sends it to the staff member */}
        <Input id="password" name="password" required value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" spellCheck={false} placeholder={t("passwordPlaceholder")} aria-invalid={!!error || undefined} className="h-11 font-mono" />
        <Button type="button" variant="outline" className="h-11" onClick={() => setValue(randomPassword())}>
          <Wand2 aria-hidden />
          {t("generate")}
        </Button>
      </div>
      <p className={`text-xs ${error ? "text-destructive" : "text-muted-foreground"}`}>{error ? te(error) : t("passwordHint")}</p>
    </div>
  );
}

function AddForm({ roles, isOwner, onDone }: { roles: RoleOption[]; isOwner: boolean; onDone: () => void }) {
  const t = useTranslations("admin.staff");
  const tr = useTranslations("admin.roles");
  const te = useTranslations("errors");
  const [fields, setFields] = useState<Record<string, ErrorCode>>({});
  const [formError, setFormError] = useState<ErrorCode>();
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          const r = await createStaff({
            name: String(f.get("name") ?? ""),
            email: String(f.get("email") ?? ""),
            roleId: String(f.get("role") ?? ""),
            password: String(f.get("password") ?? ""),
          });
          if (r.ok) return onDone();
          setFields(r.fields ?? {});
          setFormError(r.fields ? undefined : r.error);
        });
      }}
    >
      <DialogHeader className="border-b px-6 pt-6 pb-4">
        <DialogTitle>{t("add")}</DialogTitle>
        <DialogDescription className="sr-only">{t("addHint")}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4 px-6 py-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">{t("name")} <Req /></Label>
          <Input id="name" name="name" required maxLength={80} placeholder={t("namePlaceholder")} aria-invalid={!!fields.name || undefined} className="h-11" />
          {fields.name && <p className="text-xs text-destructive">{te(fields.name)}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">{t("email")} <Req /></Label>
          <Input id="email" name="email" type="email" required autoComplete="off" placeholder={t("emailPlaceholder")} aria-invalid={!!fields.email || undefined} className="h-11" />
          {fields.email && <p className="text-xs text-destructive">{te(fields.email)}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="role">{t("role")} <Req /></Label>
          {/* the roles you may give (+ Owner for the owner); starts on the weakest one you may give */}
          <Select name="role" defaultValue={roles.findLast((r) => r.givable)?.id}>
            <SelectTrigger id="role" className="h-11! w-full" aria-invalid={!!fields.role || undefined}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {isOwner && <SelectItem value={OWNER}>{tr("owner")}</SelectItem>}
              {roles.filter((r) => r.givable).map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fields.role && <p className="text-xs text-destructive">{te(fields.role)}</p>}
        </div>
        <PasswordField error={fields.password} />
        {formError && <p role="alert" className="text-sm text-destructive">{te(formError)}</p>}
      </div>
      <DialogFooter className="flex-row border-t px-6 py-4">
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={onDone}>{t("cancel")}</Button>
        <Button type="submit" className="h-11 flex-1" disabled={pending}>{t("save")}</Button>
      </DialogFooter>
    </form>
  );
}

function ResetForm({ user, onDone }: { user: Staff; onDone: () => void }) {
  const t = useTranslations("admin.staff");
  const te = useTranslations("errors");
  const [error, setError] = useState<ErrorCode>();
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        const password = String(new FormData(e.currentTarget).get("password") ?? "");
        start(async () => {
          const r = await resetPassword(user.id, password);
          if (r.ok) onDone();
          else setError(r.fields?.password ?? r.error);
        });
      }}
    >
      <DialogHeader className="border-b px-6 pt-6 pb-4">
        <DialogTitle>{t("resetPassword")}</DialogTitle>
        <DialogDescription>{t("resetHint", { name: user.name })}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4 px-6 py-5">
        <PasswordField error={error === "weakPassword" ? error : undefined} />
        {error && error !== "weakPassword" && <p role="alert" className="text-sm text-destructive">{te(error)}</p>}
      </div>
      <DialogFooter className="flex-row border-t px-6 py-4">
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={onDone}>{t("cancel")}</Button>
        <Button type="submit" className="h-11 flex-1" disabled={pending}>{t("save")}</Button>
      </DialogFooter>
    </form>
  );
}

/** the owner: tick the shops this person works in and pick their role in each; saved together */
function ShopsForm({
  user,
  shops,
  roles,
  currentShopId,
  onDone,
}: {
  user: Staff;
  shops: ShopOption[];
  roles: RoleOption[];
  currentShopId: string;
  onDone: () => void;
}) {
  const t = useTranslations("admin.staff");
  const te = useTranslations("errors");
  // shop id → role id, for the ticked shops; starts from where they work now
  const [picked, setPicked] = useState<Record<string, string>>(() => Object.fromEntries(user.shops.map((s) => [s.shopId, s.roleId])));
  const [error, setError] = useState<ErrorCode>();
  const [pending, start] = useTransition();
  const fallbackRole = user.shops.find((s) => s.shopId === currentShopId)?.roleId ?? roles.at(-1)?.id ?? "";

  function toggle(shopId: string, on: boolean) {
    setPicked((p) => {
      const next = { ...p };
      if (on) next[shopId] = p[shopId] ?? fallbackRole;
      else delete next[shopId];
      return next;
    });
  }

  return (
    <form
      className="flex flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        start(async () => {
          const r = await setUserShops(user.id, Object.entries(picked).map(([shopId, roleId]) => ({ shopId, roleId })));
          if (r.ok) onDone();
          else setError(r.fields?.shops ? "shopsRequired" : r.error);
        });
      }}
    >
      <DialogHeader className="border-b px-6 pt-6 pb-4">
        <DialogTitle>{t("shopsTitle", { name: user.name })}</DialogTitle>
        <DialogDescription>{t("shopsHint")}</DialogDescription>
      </DialogHeader>
      <ul className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto px-6 py-4">
        {shops.map((shop) => {
          const on = shop.id in picked;
          return (
            <li key={shop.id} className="flex min-h-11 items-center gap-3">
              <Checkbox id={`shop-${shop.id}`} checked={on} onCheckedChange={(v) => toggle(shop.id, v === true)} />
              <Label htmlFor={`shop-${shop.id}`} className="min-w-0 flex-1 truncate font-normal">{shop.name}</Label>
              <Select value={picked[shop.id] ?? ""} disabled={!on} onValueChange={(roleId) => setPicked((p) => ({ ...p, [shop.id]: roleId }))}>
                <SelectTrigger aria-label={`${t("role")}: ${shop.name}`} size="sm" className="w-36">
                  <SelectValue placeholder={t("role")} />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          );
        })}
      </ul>
      {error && <p role="alert" className="px-6 pb-2 text-sm text-destructive">{te(error)}</p>}
      <DialogFooter className="flex-row border-t px-6 py-4">
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={onDone}>{t("cancel")}</Button>
        <Button type="submit" className="h-11 flex-1" disabled={pending || !Object.keys(picked).length}>{t("save")}</Button>
      </DialogFooter>
    </form>
  );
}
