"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

interface AppBarProps {
  /** Title shown in the center of the app bar */
  title?: string;

  hideTitle?: boolean;

  /** Whether to show the back button. Defaults to true on subpages and false on HomePage ("/") */
  showBack?: boolean;
  /** Custom destination for the back button. Defaults to HomePage ("/") */
  backHref?: string;
  /** Custom click handler for back button */
  onBack?: () => void;
  /** Optional element or buttons on the right side */
  rightAction?: React.ReactNode;
  /** Additional CSS classes for header container */
  className?: string;
}

export default function AppBar({
  title,
  hideTitle = false,
  showBack,
  backHref = "/",
  onBack,
  rightAction,
  className = "",
}: AppBarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // If showBack is not explicitly provided, show back button when not on HomePage ("/")
  const isHome = pathname === "/";
  const shouldShowBack = showBack !== undefined ? showBack : !isHome;

  const handleBackClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onBack) {
      e.preventDefault();
      onBack();
    } else if (backHref && backHref !== "/") {
      // Follow standard navigation to custom backHref
    } else if (typeof window !== "undefined" && window.history.length > 1) {
      e.preventDefault();
      router.back();
    }
  };

  return (
    <header
      className={`sticky top-0 left-0 right-0 z-40 border-b border-surface-subtle bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90 pt-safe ${className}`}
    >
      <div className="flex h-14 items-center justify-between px-3">
        {/* Left: Back Button (44x44px minimum touch target for iOS HIG & Android) */}
        <div className="flex min-w-11 shrink-0 items-center justify-start">
          {shouldShowBack && (
            <Link
              href={backHref}
              onClick={handleBackClick}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-subtle hover:text-text-main active:scale-95 touch-manipulation dark:text-zinc-300 dark:hover:bg-zinc-800"
              aria-label="ย้อนกลับ"
              title="ย้อนกลับ"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
        </div>

        {/* Center: Title */}
        {title && !hideTitle ? (
          <div className="flex-1 min-w-0 px-2 text-center">
            <h1 className="truncate text-base font-semibold text-text-main dark:text-gray-100">
              {title}
            </h1>
          </div>
        ) : (
          <div className="flex-1 pointer-events-none" />
        )}

        {/* Right: Actions or Spacer + ThemeToggle */}
        <div className="relative z-50 flex min-w-11 shrink-0 items-center justify-end gap-1.5">
          <ThemeToggle size="sm" />
          {rightAction ?? null}
        </div>
      </div>
    </header>
  );
}
