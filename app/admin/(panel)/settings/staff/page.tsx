import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { StaffManager } from "./StaffManager";

export default async function StaffPage() {
  const me = await requireUser();
  const now = new Date();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, lockedUntil: true },
  });
  return (
    <StaffManager
      meId={me.id}
      readOnly={me.role !== "owner"}
      users={users.map(({ lockedUntil, ...u }) => ({ ...u, locked: !!lockedUntil && lockedUntil > now }))}
    />
  );
}
