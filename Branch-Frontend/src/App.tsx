import { Component, lazy, Suspense, useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Alert, Avatar, IconButton, Tooltip, Typography } from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DomainIcon from "@mui/icons-material/Domain";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import BranchManagement from "./app/pages/branch-activity-board";
import "./App.css";
import AuthPage from "./app/pages/auth-page";
import { getSession } from "./app/branchApi";

const BranchDashboard = lazy(() => import("./app/pages/branch-dashboard"));
type Page = "dashboard" | "branch";

class Guard extends Component<{ children: ReactNode }, { error: string }> {
    state = { error: "" };

    static getDerivedStateFromError(error: Error) {
        return { error: error.message };
    }

    render() {
        return this.state.error
            ? <Alert severity="error">Dashboard failed: {this.state.error}</Alert>
            : this.props.children;
    }
}

export default function App() {
    const [authenticated, setAuthenticated] = useState(() => !!getSession());
    const [page, setPage] = useState<Page>("branch");
    const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem("branch_sidebar_open") !== "false");

    useEffect(() => {
        const sync = () => { setAuthenticated(!!getSession()); setPage("branch"); };
        window.addEventListener("branch-auth-changed", sync);
        return () => window.removeEventListener("branch-auth-changed", sync);
    }, []);

    const toggleSidebar = useCallback(() => {
        setSidebarOpen(prev => {
            const next = !prev;
            localStorage.setItem("branch_sidebar_open", String(next));
            window.dispatchEvent(new CustomEvent("branch-sidebar-toggled", { detail: { open: next } }));
            return next;
        });
    }, []);

    useEffect(() => {
        const handleExternalToggle = () => toggleSidebar();
        window.addEventListener("toggle-branch-sidebar", handleExternalToggle);
        return () => window.removeEventListener("toggle-branch-sidebar", handleExternalToggle);
    }, [toggleSidebar]);

    if (!authenticated) return <AuthPage />;

    const session = getSession();
    const initials = session?.username ? session.username.slice(0, 2).toUpperCase() : "U";

    const navItems = [
        { id: "dashboard" as const, label: "Dashboard", icon: <DashboardIcon sx={{ fontSize: 20 }} /> },
        { id: "branch" as const, label: "Branch", icon: <DomainIcon sx={{ fontSize: 20 }} /> }
    ];

    return (
        <div className={`branch-container ${sidebarOpen ? "sidebar-open" : "sidebar-collapsed"}`}>
            {/* Floating Expand Pill shown when sidebar is hidden */}
            {!sidebarOpen && (
                <Tooltip title="Show Sidebar" placement="right">
                    <button className="sidebar-expand-pill" onClick={toggleSidebar} aria-label="Show Sidebar">
                        <ChevronRightIcon sx={{ fontSize: 18 }} />
                    </button>
                </Tooltip>
            )}

            {/* Sidebar Navigation */}
            <aside className={`branch-sidebar ${sidebarOpen ? "open" : "collapsed"}`}>
                <div className="sidebar-header">
                    <Typography variant="caption" className="sidebar-section-title">
                        NAVIGATION
                    </Typography>
                    <Tooltip title="Hide Sidebar" placement="right">
                        <IconButton size="small" onClick={toggleSidebar} className="sidebar-collapse-btn" aria-label="Hide Sidebar">
                            <ChevronLeftIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    </Tooltip>
                </div>

                <div className="sidebar-nav-list">
                    {navItems.map(({ id, label, icon }) => (
                        <button key={id} className={`sidebar-nav-btn${page === id ? " active" : ""}`} onClick={() => setPage(id)} >
                            <span className="sidebar-nav-icon">{icon}</span>
                            <span className="sidebar-nav-label">{label}</span>
                        </button>
                    ))}
                </div>

                <div className="sidebar-footer">
                    <div className="sidebar-user-card">
                        <Avatar sx={{ width: 34, height: 34, bgcolor: "#17324d", fontSize: "0.8rem", fontWeight: 700, border: "1px solid rgba(255,255,255,0.2)" }}>
                            {initials}
                        </Avatar>
                        <div className="sidebar-user-info">
                            <Typography variant="body2" className="sidebar-user-name" noWrap>
                                {session?.username ?? "User"}
                            </Typography>
                            <Typography variant="caption" className="sidebar-user-role">
                                {session?.role ?? "MEMBER"}
                            </Typography>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className={`branch-main ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
                {page === "branch" && <BranchManagement />}
                {page === "dashboard" && (
                    <Guard>
                        <Suspense fallback={null}>
                            <div className="branch-content-wrap">
                                <BranchDashboard />
                            </div>
                        </Suspense>
                    </Guard>
                )}
            </main>
        </div>
    );
}