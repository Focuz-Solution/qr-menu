"use client";

import { Check, Crown, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Req } from "@/components/FieldMark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import type { ErrorCode } from "@/lib/result";
import { createRole, deleteRole, saveRole } from "./actions";

type Role = { id: string; name: string; permissions: Permission[]; people: number };

/** Admin → Roles: one card per role (name + what it may do, saved with its own button) */
export function RolesManager({ roles }: { roles: Role[] }) {
  const t = useTranslations("admin.rolesPage");
  const tr = useTranslations("admin.roles");
  const te = useTranslations("errors");
  const [pending, start] = useTransition();
  const [error, setError] = useState<ErrorCode>();
  const [removing, setRemoving] = useState<Role | null>(null);
  const [removeError, setRemoveError] = useState<ErrorCode>();

  return (
    <>
      {/* page header: title + subtitle, Add role on the right */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <h1 className="font-heading text-2xl font-medium md:text-3xl">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("intro")}</p>
        </div>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await createRole();
              setError(r.ok ? undefined : r.error);
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
          {t("add")}
        </Button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {te(error)}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {/* the owner isn't a role: every permission, in every shop */}
        <Card className="flex-row items-center gap-3 px-4 py-3">
          <Crown className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <p className="font-medium">{tr("owner")}</p>
            <p className="text-sm text-muted-foreground">{t("ownerHint")}</p>
          </div>
        </Card>

        {roles.map((role) => (
          <RoleCard
            key={role.id}
            role={role}
            onDelete={() => {
              setRemoveError(undefined);
              setRemoving(role);
            }}
          />
        ))}
      </div>

      {/* delete: only a role nobody has (the server checks the same) */}
      <DeleteConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          const role = removing;
          if (!role) return;
          start(async () => {
            const r = await deleteRole(role.id);
            if (r.ok) setRemoving(null);
            else setRemoveError(r.error);
          });
        }}
        title={t("deleteTitle", { name: removing?.name ?? "" })}
        description={t("deleteText")}
        cancelLabel={t("cancel")}
        deleteLabel={t("delete")}
        pending={pending}
        error={removeError && te(removeError)}
      />
    </>
  );
}

function RoleCard({ role, onDelete }: { role: Role; onDelete: () => void }) {
  const t = useTranslations("admin.rolesPage");
  const te = useTranslations("errors");
  const [name, setName] = useState(role.name);
  const [picked, setPicked] = useState<Permission[]>(role.permissions);
  const [nameError, setNameError] = useState<ErrorCode>();
  const [formError, setFormError] = useState<ErrorCode>();
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => setDone(false), 2000);
    return () => clearTimeout(id);
  }, [done]);

  const toggle = (p: Permission, on: boolean) => setPicked((list) => (on ? [...list, p] : list.filter((x) => x !== p)));

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setDone(false);
        start(async () => {
          const r = await saveRole(role.id, { name, permissions: picked });
          setNameError(r.ok ? undefined : r.fields?.name);
          setFormError(r.ok || r.fields ? undefined : r.error);
          setDone(r.ok);
        });
      }}
    >
      <Card className="gap-4 p-4 md:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label htmlFor={`role-${role.id}`}>{t("name")} <Req /></Label>
            <Input
              id={`role-${role.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              aria-required
              aria-invalid={!!nameError || undefined}
              className="h-11 sm:max-w-xs"
            />
            {nameError && <p className="text-xs text-destructive">{te(nameError)}</p>}
          </div>
          <p className="pb-3 text-sm text-muted-foreground tabular-nums">{t("people", { count: role.people })}</p>
        </div>

        {/* what this role may do; everyone in a shop can always see its orders and settings */}
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t("permissions")}</legend>
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {PERMISSIONS.map((p) => (
              <div key={p} className="flex min-h-11 items-start gap-3 py-1">
                <Checkbox id={`${role.id}-${p}`} checked={picked.includes(p)} onCheckedChange={(v) => toggle(p, v === true)} className="mt-0.5" />
                <Label htmlFor={`${role.id}-${p}`} className="flex flex-col items-start gap-0.5 font-normal">
                  <span className="font-medium">{t(`perm.${p}`)}</span>
                  <span className="text-xs text-muted-foreground">{t(`permHint.${p}`)}</span>
                </Label>
              </div>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap-reverse items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mr-auto text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
            disabled={pending}
            onClick={onDelete}
          >
            <Trash2 aria-hidden />
            {t("delete")}
          </Button>
          {formError && <p role="alert" className="text-sm text-destructive">{te(formError)}</p>}
          <Button type="submit" size="sm" aria-live="polite" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : done ? <Check aria-hidden /> : <Save aria-hidden />}
            {done && !pending ? t("saved") : t("save")}
          </Button>
        </div>
      </Card>
    </form>
  );
}
