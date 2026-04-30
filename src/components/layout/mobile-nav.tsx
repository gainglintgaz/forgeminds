"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Feed", icon: "📡" },
  { href: "/sources", label: "Sources", icon: "🔗" },
  { href: "/archive", label: "Archive", icon: "🧠", disabled: true },
  { href: "/content", label: "Content", icon: "✍️", disabled: true },
  { href: "/analytics", label: "Analytics", icon: "📊", disabled: true },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="md:hidden inline-flex shrink-0 items-center justify-center rounded-lg text-sm font-medium hover:bg-muted hover:text-foreground h-7 px-2.5">
        Menu
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <div className="p-4 border-b">
          <h1 className="text-lg font-semibold tracking-tight">ForgeMinds</h1>
        </div>
        <nav className="p-2 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.disabled ? "#" : item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                pathname === item.href
                  ? "bg-zinc-200 text-zinc-900 font-medium"
                  : "text-zinc-600",
                item.disabled && "opacity-40 pointer-events-none"
              )}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
