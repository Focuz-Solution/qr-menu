import Image from "next/image";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { shop } from "@/lib/shop";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

// shadcn block login-04, swapped: shop panel on the left, form on the right; no social logins / sign-up
export default async function LoginPage() {
  // already logged in → straight to the dashboard
  if (await getCurrentUser()) redirect("/admin/");
  const t = await getTranslations("admin");

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6 md:max-w-4xl">
        <Card className="overflow-hidden p-0">
          <CardContent className="grid p-0 md:min-h-[500px] md:grid-cols-2 md:items-stretch">
            {/* left: shop panel (computers only — phones show the logo above the form) */}
            <div className="hidden flex-col items-center justify-center gap-4 bg-foreground/5 p-10 text-center md:flex">
              <Image src={shop.logo} alt={shop.name} width={160} height={160} priority className="size-40 rounded-full" />
              <div>
                <p className="font-heading text-2xl font-semibold">{shop.name}</p>
                <p className="text-sm text-muted-foreground">{t("title")}</p>
              </div>
            </div>
            <LoginForm shopName={shop.name} logo={shop.logo} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
