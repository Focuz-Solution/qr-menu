import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SHOP_ROLES } from "@/lib/roles";
import { StaffManager } from "./StaffManager";

const userFields = { id: true, name: true, email: true, isActive: true, lastLoginAt: true, lockedUntil: true } as const;

/** "hello@focuzsolution.com" → "h***@f***.com" (an owner's email, shown to people who aren't owners) */
function maskEmail(email: string) {
  const [local, domain = ""] = email.split("@");
  const dot = domain.lastIndexOf(".");
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  return `${local.slice(0, 1)}***@${host.slice(0, 1)}***${dot > 0 ? domain.slice(dot) : ""}`;
}

// people of the current shop (their role here) + the owners (super-admins: every shop, listed as "Owner")
export default async function StaffPage() {
  // owner / shop admin only ("owner" also lets the shop admin in); staff / packer go back to orders
  const me = await requireUser(["owner"]);
  const now = new Date();
  const [owners, members] = await Promise.all([
    prisma.user.findMany({ where: { isOwner: true }, orderBy: { createdAt: "asc" }, select: userFields }),
    prisma.membership.findMany({
      where: { shopId: me.shop.id, user: { isOwner: false } },
      orderBy: { createdAt: "asc" },
      select: { role: true, user: { select: userFields } },
    }),
  ]);
  // owners' emails: in full for owners only; anyone else gets them masked (never sent to their browser)
  const people = [
    ...owners.map((user) => ({ role: "owner" as const, user: me.role === "owner" ? user : { ...user, email: maskEmail(user.email) } })),
    ...members,
  ];
  return (
    <StaffManager
      meId={me.id}
      readOnly={false}
      // only an owner makes another owner or a shop admin
      roles={me.role === "owner" ? (["owner", ...SHOP_ROLES] as const) : SHOP_ROLES.filter((r) => r !== "admin")}
      users={people.map(({ role, user: { lockedUntil, ...u } }) => ({ ...u, role, locked: !!lockedUntil && lockedUntil > now }))}
    />
  );
}
