import Link from "next/link";
import { Wordmark } from "@/src/components/brand/Wordmark";
import { buttonVariants } from "@/components/ui/button";

const navLinks = [
  { href: "#modules", label: "Modules" },
  { href: "#platform", label: "Platform" },
  { href: "#pricing", label: "Pricing" },
];

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Wordmark size="sm" />
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground sm:flex">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>
        <Link href="/login" className={buttonVariants({ size: "sm" })}>
          Sign in
        </Link>
      </div>
    </header>
  );
}
