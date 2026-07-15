"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useState, useEffect } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme ?? (systemPrefersDark ? "dark" : "light");

    setTheme(initialTheme);
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }

  async function handleSignOut() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
        },
      },
    });
  }

  const navLinks = [
    { name: "Dashboard", href: "/" },
    { name: "My Workspace", href: "/documents" },
    { name: "PDF Utilities", href: "/tools" },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl transition-colors duration-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          <div className="flex items-center gap-8">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-xl text-white shadow-lg shadow-indigo-500/20 transition-all duration-300 group-hover:scale-105 group-hover:rotate-3">
                🧠
              </span>
              <span className="bg-gradient-to-r from-violet-600 via-indigo-500 to-cyan-500 dark:from-violet-400 dark:via-indigo-400 dark:to-cyan-400 bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
                ResearchAI
              </span>
            </Link>

            {/* Nav Links */}
            <div className="hidden md:flex md:items-center md:gap-2">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-100 border border-transparent"
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Controls Section */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-800 dark:hover:text-slate-200 transition-all shadow-sm active:scale-95"
              aria-label="Toggle theme"
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>

            {/* User Section */}
            {!isPending && session ? (
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-1.5 pr-3 text-left transition-all hover:bg-slate-50 dark:hover:bg-slate-900 hover:shadow-sm focus:outline-none"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-sm font-semibold text-white">
                    {session.user.email?.[0].toUpperCase() ?? "U"}
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                      {session.user.name || "User"}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 max-w-[120px] truncate leading-none mt-0.5">
                      {session.user.email}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">▼</span>
                </button>

                {isDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-2 shadow-xl z-20">
                      <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-900 sm:hidden">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {session.user.name || "User"}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                          {session.user.email}
                        </p>
                      </div>
                      <div className="py-1">
                        {navLinks.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setIsDropdownOpen(false)}
                            className="block rounded-xl px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-indigo-600 dark:hover:text-indigo-400 md:hidden transition"
                          >
                            {link.name}
                          </Link>
                        ))}
                        <button
                          onClick={() => {
                            setIsDropdownOpen(false);
                            handleSignOut();
                          }}
                          className="w-full text-left rounded-xl px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-700 dark:hover:text-red-400 transition"
                        >
                          Sign out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 transition"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

