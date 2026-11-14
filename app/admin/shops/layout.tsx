import { LogOut } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { requireLogin } from "@/lib/auth";
import { platform } from "@/lib/shop";
import { logout } from "../actions";

// "Your shops" + "Create a shop": top bar with the app's logo (no name), signed-in phone / email, sign out
export default async function ShopsLayout({ children }: LayoutProps<"/admin/shops">) {
  const user = await requireLogin();
  const t = await getTranslations("admin.shops");
  return (
    <div className="min-h-svh bg-background">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-4 py-3">
          <Image src={platform.logo} alt={platform.name} width={platform.logoWidth} height={platform.logoHeight} priority className="h-8 w-auto" />
          <span className="ml-auto min-w-0 truncate text-sm text-muted-foreground">{user.contact}</span>
          <form action={logout}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut aria-hidden />
              {t("signOut")}
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
