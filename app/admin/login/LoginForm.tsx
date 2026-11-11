"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { login } from "./actions";
import { Req } from "@/components/FieldMark";

export function LoginForm({ shopName, logo }: { shopName: string; logo: string }) {
  const t = useTranslations("admin.login");
  const [state, action, pending] = useActionState(login, undefined);

  const errors = useTranslations("errors");
  const [invalid, setInvalid] = useState<{ email?: "required" | "badEmail"; password?: "required" }>({});

  return (
    <form action={action} noValidate onSubmit={(event) => {
      const email = event.currentTarget.elements.namedItem("email") as HTMLInputElement;
      const password = event.currentTarget.elements.namedItem("password") as HTMLInputElement;
      const emailError = email.validity.valueMissing ? "required" : email.validity.typeMismatch ? "badEmail" : undefined;
      const passwordError = password.validity.valueMissing ? "required" : undefined;
      setInvalid({ email: emailError, password: passwordError });
      if (emailError || passwordError) {
        event.preventDefault();
        (emailError ? email : password).focus();
      }
    }} className="p-6 md:flex md:flex-col md:justify-center md:p-8">
      <FieldGroup>
        <div className="flex flex-col items-center gap-2 text-center">
          <Image src={logo} alt={shopName} width={64} height={64} className="size-16 rounded-full md:hidden" />
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-balance text-muted-foreground">{t("subtitle", { shop: shopName })}</p>
        </div>
        <Field>
          <FieldLabel htmlFor="email">{t("email")} <Req /></FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder={t("emailPlaceholder")}
            required
            aria-invalid={!!(invalid.email || state) || undefined}
            aria-describedby={invalid.email ? "login-email-error" : undefined}
            className="h-11"
          />
          {invalid.email && <FieldError id="login-email-error" role="alert">{errors(invalid.email)}</FieldError>}
        </Field>
        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">{t("password")} <Req /></FieldLabel>
            {/* no email reset (plan D5): an administrator resets it (Admin → Staff → Reset password) */}
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="-my-3 ml-auto inline-flex min-h-11 items-center text-sm underline-offset-2 hover:underline">
                  {t("forgot")}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 gap-1 p-3 text-sm">
                <p className="font-medium">{t("forgotTitle")}</p>
                <p className="text-muted-foreground">{t("forgotBody")}</p>
              </PopoverContent>
            </Popover>
          </div>
          <Input
            aria-describedby={invalid.password || (state && !invalid.email) ? "login-error" : undefined}
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder={t("passwordPlaceholder")}
            required
            aria-invalid={!!(invalid.password || state) || undefined}
            className="h-11"
          />
          {(invalid.password || (state && !invalid.email)) && (
            <FieldError id="login-error" role="alert">
              {invalid.password ? errors(invalid.password) : state?.error === "locked" ? t("errors.locked", { minutes: state.minutes }) : t("errors.badLogin")}
            </FieldError>
          )}
        </Field>
        <Field>
          <Button type="submit" disabled={pending} className="h-11">
            {t("submit")}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
