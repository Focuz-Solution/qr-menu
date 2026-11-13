import { redirect } from "next/navigation";

// /admin/ = the orders list (login, shop switch and old links land here)
export default function AdminHome() {
  redirect("/admin/orders");
}
