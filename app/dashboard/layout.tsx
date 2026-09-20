"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useState } from "react";
import { removeAuthToken } from "@/lib/auth";

type NavItem = {
    label: string;
    href: string;
    icon: string;
};

const navItems: NavItem[] = [
    {
        label: "Dashboard",
        href: "/dashboard",
        icon: "⌂",
    },
    {
        label: "Services",
        href: "/dashboard/services",
        icon: "◉",
    },
    {
        label: "Incidents",
        href: "/dashboard/incidents",
        icon: "⚠",
    },
    {
        label: "SLA",
        href: "/dashboard/sla",
        icon: "◫",
    },
    {
        label: "Notifications",
        href: "/dashboard/notifications",
        icon: "🔔",
    },
];

export default function DashboardLayout({
    children,
}: {
    children: ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();

    const [mobileOpen, setMobileOpen] =
        useState(false);

    function handleLogout() {
        removeAuthToken();
        router.replace("/login");
    }

    return (
        <div className="dashboard-shell">
            <aside
                className={`dashboard-sidebar ${
                    mobileOpen
                        ? "dashboard-sidebar-open"
                        : ""
                }`}
            >
                <div className="sidebar-header">
                    <div className="logo-mark">
                        SLA
                    </div>

                    <div>
                        <h2>SLA Monitor</h2>
                        <span>Monitoring System</span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <p className="nav-heading">
                        MAIN
                    </p>

                    {navItems.map((item) => {
                        const active =
                            pathname ===
                            item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`nav-link ${
                                    active
                                        ? "nav-link-active"
                                        : ""
                                }`}
                                onClick={() =>
                                    setMobileOpen(
                                        false
                                    )
                                }
                            >
                                <span className="nav-icon">
                                    {item.icon}
                                </span>

                                <span>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="sidebar-bottom">
                    <button
                        className="logout-button"
                        onClick={handleLogout}
                    >
                        <span className="nav-icon">
                            ↪
                        </span>

                        Logout
                    </button>
                </div>
            </aside>

            {mobileOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={() =>
                        setMobileOpen(false)
                    }
                />
            )}

            <div className="dashboard-main">
                <header className="dashboard-header">
                    <button
                        className="mobile-menu-button"
                        onClick={() =>
                            setMobileOpen(
                                !mobileOpen
                            )
                        }
                    >
                        ☰
                    </button>

                    <div>
                        <strong>
                            SLA Monitoring
                        </strong>
                    </div>

                    <div className="header-status">
                        <span className="status-dot" />
                        System Online
                    </div>
                </header>

                <div className="dashboard-content">
                    {children}
                </div>
            </div>

            <style jsx global>{`
                * {
                    box-sizing: border-box;
                }

                body {
                    margin: 0;
                    background: #f5f7fb;
                }

                .dashboard-shell {
                    min-height: 100vh;
                    display: flex;
                    background: #f5f7fb;
                    color: #1f2937;
                }

                .dashboard-sidebar {
                    width: 250px;
                    min-height: 100vh;
                    background: #111827;
                    color: #fff;
                    display: flex;
                    flex-direction: column;
                    position: fixed;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    z-index: 1000;
                }

                .sidebar-header {
                    height: 80px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 20px;
                    border-bottom: 1px solid
                        rgba(255, 255, 255, 0.08);
                }

                .logo-mark {
                    width: 40px;
                    height: 40px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #2563eb;
                    font-size: 13px;
                    font-weight: 700;
                }

                .sidebar-header h2 {
                    margin: 0;
                    font-size: 16px;
                }

                .sidebar-header span {
                    display: block;
                    margin-top: 3px;
                    color: #1a1a1b;
                    font-size: 11px;
                }

                .sidebar-nav {
                    padding: 24px 12px;
                    flex: 1;
                }

                .nav-heading {
                    margin: 0 12px 10px;
                    color: #6b7280;
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 1px;
                }

                .nav-link,
                .logout-button {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px;
                    margin-bottom: 5px;
                    border-radius: 8px;
                    color: #9ca3af;
                    text-decoration: none;
                    border: none;
                    background: transparent;
                    font-size: 14px;
                    cursor: pointer;
                    text-align: left;
                    transition:
                        background 0.2s,
                        color 0.2s;
                }

                .nav-link:hover,
                .logout-button:hover {
                    background: #1f2937;
                    color: #fff;
                }

                .nav-link-active {
                    background: #2563eb;
                    color: #fff;
                }

                .nav-link-active:hover {
                    background: #2563eb;
                }

                .nav-icon {
                    width: 22px;
                    text-align: center;
                    font-size: 16px;
                }

                .sidebar-bottom {
                    padding: 12px;
                    border-top: 1px solid
                        rgba(255, 255, 255, 0.08);
                }

                .dashboard-main {
                    flex: 1;
                    margin-left: 250px;
                    min-width: 0;
                }

                .dashboard-header {
                    height: 70px;
                    padding: 0 30px;
                    background: #fff;
                    border-bottom: 1px solid #e5e7eb;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    position: sticky;
                    top: 0;
                    z-index: 900;
                }

                .header-status {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #4b5563;
                    font-size: 13px;
                }

                .status-dot {
                    width: 8px;
                    height: 8px;
                    background: #22c55e;
                    border-radius: 50%;
                }

                .dashboard-content {
                    padding: 30px;
                }

                .mobile-menu-button {
                    display: none;
                    border: none;
                    background: transparent;
                    font-size: 24px;
                    cursor: pointer;
                }

                .sidebar-overlay {
                    display: none;
                }

                @media (max-width: 768px) {
                    .dashboard-sidebar {
                        transform: translateX(-100%);
                        transition: transform 0.25s
                            ease;
                    }

                    .dashboard-sidebar-open {
                        transform: translateX(0);
                    }

                    .dashboard-main {
                        margin-left: 0;
                    }

                    .dashboard-header {
                        padding: 0 18px;
                    }

                    .mobile-menu-button {
                        display: block;
                    }

                    .header-status {
                        font-size: 12px;
                    }

                    .dashboard-content {
                        padding: 20px;
                    }

                    .sidebar-overlay {
                        display: block;
                        position: fixed;
                        inset: 0;
                        background: rgba(
                            0,
                            0,
                            0,
                            0.45
                        );
                        z-index: 999;
                    }
                }
            `}</style>
        </div>
    );
}