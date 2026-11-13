import { notFound } from "next/navigation";

// app.com/ has no page of its own (every shop lives at app.com/<shop>) → 404, shown by not-found.tsx
export default function Home() {
  notFound();
}
