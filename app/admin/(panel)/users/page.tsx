import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { within } from "@/lib/permissions";
import { allRoles, ensureBuiltInRoles, membershipPermissions } from "@/lib/staff-roles";
import { StaffManager } from "./StaffManager";

const userFields = { id: true, name: true, email: true, isActive: true, lastLoginAt: true, lockedUntil: true } as const;

/** "hello@focuzsolution.com" → "h***@f***.com" (an owner's email, shown to people who aren't owners) */
function maskEmail(email: string) {
  const [local, domain = ""] = email.split("@");
  const dot = domain.lastIndexOf(".");
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  return `${local.slice(0, 1)}***@${host.slice(0, 1)}***${dot > 0 ? domain.slice(dot) : ""}`;
}

// people of the current shop (their role here) + the owners (super-admins: every shop, listed as "Owner").
// The owner sees everyone, also people of other shops (shown as not in this shop; Shops dialog / role picker adds them).
export default async function StaffPage() {
  // anyone whose role may manage people (and the owner); others go back to orders
  const me = await requireUser("users.manage");
  await ensureBuiltInRoles(); // first visit after the roles update: built-in roles + people moved onto them
  const now = new Date();
  const [owners, members, roles, shops] = await Promise.all([
    prisma.user.findMany({ where: { isOwner: true }, orderBy: { createdAt: "asc" }, select: userFields }),
    prisma.membership.findMany({
      // the owner: every person's membership here or, if they aren't here, any (one row per person below)
      where: { user: { isOwner: false }, ...(!me.isOwner && { shopId: me.shop.id }) },
      orderBy: { createdAt: "asc" },
      select: {
        shopId: true,
        role: true,
        roleId: true,
        staffRole: { select: { permissions: true } },
        user: {
          select: {
            ...userFields,
            // the owner sets which shops someone works in (Shops dialog): their shops + role in each
            memberships: me.isOwner ? { select: { shopId: true, roleId: true } } : false,
            _count: { select: { memberships: true } },
          },
        },
      },
    }),
    allRoles(),
    me.isOwner
      ? prisma.shop.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, slug: true, settings: { select: { name: true } } } })
      : [],
  ]);
  // owners' emails: in full for owners only; anyone else gets them masked (never sent to their browser)
  const ownerRows = owners.map(({ lockedUntil, ...u }) => ({
    ...u,
    email: me.isOwner ? u.email : maskEmail(u.email),
    locked: !!lockedUntil && lockedUntil > now,
    roleId: "owner",
    canManage: me.isOwner && u.id !== me.id,
    shops: [],
  }));
  // one row per person: their membership in this shop if they have one (the owner also gets people of other shops)
  const byUser = new Map<string, (typeof members)[number]>();
  for (const m of members) {
    const seen = byUser.get(m.user.id);
    if (!seen || (m.shopId === me.shop.id && seen.shopId !== me.shop.id)) byUser.set(m.user.id, m);
  }
  const memberRows = [...byUser.values()].map(({ shopId, roleId, role, staffRole, user: { lockedUntil, memberships, _count, ...u } }) => ({
    ...u,
    locked: !!lockedUntil && lockedUntil > now,
    // "" = not in this shop (owner's view only)
    roleId: shopId === me.shop.id ? (roleId ?? "") : "",
    // same rule as the server (users/actions.ts → manageable): owner, or only here and no stronger than you
    canManage: u.id !== me.id && (me.isOwner || (_count.memberships === 1 && within(membershipPermissions({ role, staffRole }), me.permissions))),
    shops: (memberships || []).flatMap((m) => (m.roleId ? [{ shopId: m.shopId, roleId: m.roleId }] : [])),
  }));
  return (
    <StaffManager
      meId={me.id}
      isOwner={me.isOwner}
      users={[...ownerRows, ...memberRows]}
      roles={roles.map((r) => ({ id: r.id, name: r.name, givable: me.isOwner || within(r.permissions, me.permissions) }))}
      shops={shops.map((s) => ({ id: s.id, name: s.settings?.name ?? s.slug }))}
      currentShopId={me.shop.id}
    />
  );
}
