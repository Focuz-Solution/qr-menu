import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { ShopArt } from "@/components/ShopArt";
import { LoginForm } from "./LoginForm";

// shadcn block login-04, swapped: shop panel on the left, form on the right; no social logins / sign-up
export default async function LoginPage() {
  // already logged in → straight in (a shop already open → its dashboard, else the shop list)
  const user = await getCurrentUser();
  if (user) redirect(user.shopId ? "/admin/orders" : "/admin/shops");
  const t = await getTranslations("admin.login");

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6 md:max-w-4xl">
        <Card className="overflow-hidden p-0">
          <CardContent className="grid p-0 md:min-h-[500px] md:grid-cols-2 md:items-stretch">
            {/* left (computers only — phones show a small one above the form): popping shop icon + a short line */}
            <div className="hidden items-center justify-center bg-foreground/5 p-10 md:flex">
              <ShopArt text={t("tagline")} />
            </div>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
