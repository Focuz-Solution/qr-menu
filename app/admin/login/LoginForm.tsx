"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { ShopArt } from "@/components/ShopArt";
import { platform } from "@/lib/shop";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { login } from "./actions";
import { Req } from "@/components/FieldMark";

export function LoginForm() {
  const t = useTranslations("admin.login");
  const [state, action, pending] = useActionState(login, undefined);

  const errors = useTranslations("errors");
  const [showPassword, setShowPassword] = useState(false);
  // React resets a form after its action runs; keeping the values in state means a wrong password
  // leaves both fields filled in so the person can fix them
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invalid, setInvalid] = useState<{ email?: "required" | "badEmail"; password?: "required" }>({});

  return (
    <form action={action} noValidate onSubmit={(event) => {
      const emailInput = event.currentTarget.elements.namedItem("email") as HTMLInputElement;
      const passwordInput = event.currentTarget.elements.namedItem("password") as HTMLInputElement;
      const emailError = emailInput.validity.valueMissing ? "required" : emailInput.validity.typeMismatch ? "badEmail" : undefined;
      const passwordError = passwordInput.validity.valueMissing ? "required" : undefined;
      setInvalid({ email: emailError, password: passwordError });
      if (emailError || passwordError) {
        event.preventDefault();
        (emailError ? emailInput : passwordInput).focus();
      }
    }} className="p-6 md:flex md:flex-col md:justify-center md:p-8">
      <FieldGroup>
        <div className="flex flex-col items-center gap-2 text-center">
          <ShopArt small text={t("tagline")} className="mb-2 md:hidden" />
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-balance text-muted-foreground">{t("subtitle", { shop: platform.name })}</p>
        </div>
        <Field>
          <FieldLabel htmlFor="email">{t("email")} <Req /></FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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
          {/* password + eye button to show / hide what was typed */}
          <InputGroup className="h-11">
            <InputGroupInput
              aria-describedby={invalid.password || (state && !invalid.email) ? "login-error" : undefined}
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder={t("passwordPlaceholder")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              aria-invalid={!!(invalid.password || state) || undefined}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-sm"
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                aria-pressed={showPassword}
                title={showPassword ? t("hidePassword") : t("showPassword")}
                onClick={() => setShowPassword((v) => !v)}
                className="rounded-full"
              >
                {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          {(invalid.password || (state && !invalid.email)) && (
            <FieldError id="login-error" role="alert">
              {invalid.password ? errors(invalid.password) : state?.error === "locked" ? t("errors.locked", { minutes: state.minutes }) : t("errors.badLogin")}
            </FieldError>
          )}
        </Field>
        <Field>
          <Button type="submit" disabled={pending} aria-busy={pending} className="h-11">
            {/* spinner while the password is being checked */}
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {t("submit")}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
