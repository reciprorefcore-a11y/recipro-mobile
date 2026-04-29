"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "ホーム", icon: "/icons/icon-home.svg" },
  { href: "/search", label: "食材", icon: "/icons/icon-vegetable.svg" },
  { href: "/recipes", label: "レシピ", icon: "/icons/icon-recipe.svg" },
  { href: "/history", label: "履歴", icon: "/icons/icon-history.svg" },
  { href: "/menu", label: "メニュー", icon: "/icons/icon-menu.svg" },
] as const;

const HIDDEN_PATHS = ["/login", "/signup", "/onboarding"];

const ACTIVE_FILTER =
  "brightness(0) saturate(100%) invert(39%) sepia(92%) saturate(600%) hue-rotate(346deg) brightness(100%)";
const INACTIVE_FILTER = "brightness(0) opacity(0.35)";

export default function BottomNavigation() {
  const pathname = usePathname();

  if (HIDDEN_PATHS.includes(pathname)) return null;

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "60px",
        backgroundColor: "#fff",
        borderTop: "1px solid #eee",
        zIndex: 100,
        display: "flex",
        alignItems: "stretch",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {TABS.map((tab) => {
        const isActive =
          tab.href === "/"
            ? pathname === "/"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "2px",
              minHeight: "44px",
              color: isActive ? "#E85D2C" : "#999999",
              textDecoration: "none",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tab.icon}
              alt=""
              width={24}
              height={24}
              style={{
                filter: isActive ? ACTIVE_FILTER : INACTIVE_FILTER,
              }}
            />
            <span
              style={{
                fontSize: "10px",
                fontWeight: isActive ? 600 : 400,
                lineHeight: 1,
              }}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
