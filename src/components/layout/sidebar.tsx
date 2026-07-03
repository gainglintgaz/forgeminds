"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Only real, reachable routes here. Dead "Soon" stubs (Archive/Content/Analytics —
// Phase 3-6 features that don't exist yet) were removed 2026-07-03: a grey link that
// goes nowhere is dead UI (VIBE Rule 51) and vague "Soon" is banned (GOAL §4.3). They
// return as real nav items when their pages ship — not before (review U-2 / C-5).
const navItems = [
  { href: "/dashboard", label: "Feed", icon: "📡" },
  { href: "/briefs", label: "Briefs", icon: "📰" },
  { href: "/sources", label: "Sources", icon: "🔗" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:bg-zinc-50 md:min-h-screen">
      <div className="p-4 border-b">
        <h1 className="text-lg font-semibold tracking-tight">ForgeMinds</h1>
        <p className="text-xs text-zinc-500">Intelligence OS</p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              pathname === item.href
                ? "bg-zinc-200 text-zinc-900 font-medium"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            )}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
