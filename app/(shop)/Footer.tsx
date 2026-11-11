import { Separator } from "@/components/ui/separator";

// ponytail: address and social icons left out for now (they are in Admin → Settings)
export function Footer({ name }: { name: string }) {
  return (
    <footer className="mt-auto pt-10 pb-8 text-center">
      <Separator className="mb-10" />
      <p className="text-sm text-muted-foreground">
        © {new Date().getFullYear()} {name}
      </p>
    </footer>
  );
}
