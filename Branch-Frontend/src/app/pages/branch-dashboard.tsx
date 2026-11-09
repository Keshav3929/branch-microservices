import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isCancel } from "axios";
import {
    Alert, Box, CircularProgress, Typography, Stack,
    ToggleButton, ToggleButtonGroup, Card, IconButton, Tooltip, Chip, Paper, Button
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import AssessmentIcon from "@mui/icons-material/Assessment";
import FilterListIcon from "@mui/icons-material/FilterList";
import BranchHeader from "../../components/Header";
import ColumnChart from "../../components/ColumnChart";
import PieChart from "../../components/PieChart";
import GaugeChart from "../../components/GaugeChart";
import DashboardChartCard from "../../components/DashboardChartCard";
import DashboardStatTiles from "../../components/DashboardStatTiles";
import DashboardFilterBar from "../../components/DashboardFilterBar";
import BranchDrilldownDialog from "../../components/BranchDrilldownDialog";
import { getFilterChips } from "../branchUtils";
import { getAnalytics, getDropdownOptions, getUsers, searchBranches, getBranches } from "../branchApi";
import type { BranchAnalytics, DropdownOptions, UserOption, BranchSearchRequest} from "../branchApi";
import type { Branch } from "../../types/BranchSchema";
import type { ChartEngine, TableBreakdownRow, DrilldownPayload } from "../../types/chartTypes";
import type { BranchFilters, FilterChip } from "./branch-filter";

const defaultFilters = (): BranchFilters => ({
    search: "",
    branchType: [],
    organizationId: [],
    regionId: [],
    countryId: [],
    status: [],
    createdDateFrom: "",
    createdDateTo: ""
});

const emptyOptions: DropdownOptions = {
    organizations: [], branchTypes: [], regions: [], countries: [],
    states: [], cities: [], contactPersons: [], workingHours: []
};

function computeAnalytics(branches: Branch[], options: DropdownOptions): BranchAnalytics {
    const total = branches.length;
    const active = branches.filter(b => b.status).length;
    const inactive = total - active;
    const regMap = new Map<number | string, { name: string; active: number; inactive: number }>();
    const orgMap = new Map<number | string, { name: string; count: number }>();
    const typeMap = new Map<string, number>();
    const trendsMap = new Map<string, number>();
    branches.forEach(b => {
        const rId = b.regionId ?? "Unknown";
        const rName = b.regionId != null ? (options.regions.find(r => r.id === b.regionId)?.name ?? `Region ${b.regionId}`) : "Unknown";
        const reg = regMap.get(rId) ?? { name: rName, active: 0, inactive: 0 };
        if (b.status) reg.active++; else reg.inactive++;
        regMap.set(rId, reg);
        const oId = b.organizationId ?? "Unknown";
        const oName = b.organizationId != null ? (options.organizations.find(o => o.id === b.organizationId)?.name ?? `Org ${b.organizationId}`) : "Unknown";
        const org = orgMap.get(oId) ?? { name: oName, count: 0 };
        org.count++;
        orgMap.set(oId, org);
        const t = b.branchType || "Other";
        typeMap.set(t, (typeMap.get(t) ?? 0) + 1);
        if (b.createdAt) {
            const dateStr = b.createdAt.slice(0, 10);
            trendsMap.set(dateStr, (trendsMap.get(dateStr) ?? 0) + 1);
        }
    });
    return {
        total, active, inactive,
        branchesByRegion: Array.from(regMap.values()),
        branchesByOrganization: Array.from(orgMap.values()),
        branchesByType: Array.from(typeMap, ([name, count]) => ({ name, count })),
        creationTrends: Array.from(trendsMap, ([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month))
    };
}

export default function BranchDashboard() {
    const [engine, setEngine] = useState<ChartEngine>("recharts");
    const [analytics, setAnalytics] = useState<BranchAnalytics | null>(null);
    const [allBranches, setAllBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [optionsData, setOptionsData] = useState<DropdownOptions>(emptyOptions);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [filters, setFilters] = useState<BranchFilters>(defaultFilters);
    const [appliedFilters, setAppliedFilters] = useState<BranchFilters>(defaultFilters);
    const [drilldown, setDrilldown] = useState<DrilldownPayload | null>(null);
    const [drilldownBranches, setDrilldownBranches] = useState<Branch[]>([]);
    const [drilldownOpen, setDrilldownOpen] = useState(false);
    const isInitialMount = useRef(true);

    // Initial load: Runs exactly ONCE on mount
    useEffect(() => {
        const controller = new AbortController();
        Promise.all([
            getDropdownOptions(),
            getUsers(),
            getAnalytics(controller.signal),
            getBranches({ page: 0, size: 5000 }, controller.signal)
        ]).then(([optRes, userRes, analyticsRes, branchRes]) => {
            setOptionsData(optRes.data);
            setUsers(userRes.data);
            setAnalytics(analyticsRes.data);
            setAllBranches(branchRes.data?.content ?? []);
            setLoading(false);
        }).catch(err => {
            if (!isCancel(err)) setFailed(true);
            setLoading(false);
        });
        return () => controller.abort();
    }, []);

    // Filter change effect: Runs only when appliedFilters changes after initial mount
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        const statusVal = appliedFilters.status.length === 1 ? appliedFilters.status[0] === "Active" : undefined;
        const searchReq: BranchSearchRequest = {
            organizationId: appliedFilters.organizationId.length ? appliedFilters.organizationId : undefined,
            regionId: appliedFilters.regionId.length ? appliedFilters.regionId : undefined,
            countryId: appliedFilters.countryId.length ? appliedFilters.countryId : undefined,
            branchType: appliedFilters.branchType.length ? appliedFilters.branchType : undefined,
            status: statusVal,
            createdDateFrom: appliedFilters.createdDateFrom || undefined,
            createdDateTo: appliedFilters.createdDateTo || undefined
        };
        const hasFilter = Object.values(searchReq).some(v => v !== undefined);
        const controller = new AbortController();
        setLoading(true);

        const fetchPromise = hasFilter
            ? searchBranches(searchReq, { page: 0, size: 5000 }, controller.signal)
            : getBranches({ page: 0, size: 5000 }, controller.signal);

        fetchPromise.then(res => {
            const list = res.data?.content ?? [];
            setAllBranches(list);
            setAnalytics(hasFilter ? computeAnalytics(list, optionsData) : null);
            if (!hasFilter) {
                getAnalytics(controller.signal).then(aRes => setAnalytics(aRes.data)).catch(() => {});
            }
            setLoading(false);
        }).catch(err => {
            if (!isCancel(err)) setFailed(true);
            setLoading(false);
        });
        return () => controller.abort();
    }, [appliedFilters, optionsData]);
    const handleApplyFilters = (next?: BranchFilters) => {
        const target = next ? { ...next } : { ...filters };
        setFilters(target);
        setAppliedFilters(target);
    };
    const handleResetFilters = () => {
        const def = defaultFilters();
        setFilters(def);
        setAppliedFilters(def);
    };
    // Remove a single applied filter chip
    const removeAppliedChip = (chip: FilterChip) => {
        const next: BranchFilters = { ...appliedFilters };
        if (chip.key === "createdDateFrom" || chip.key === "createdDateTo") {
            next[chip.key] = "";
        } else {
            (next[chip.key] as (string | number)[]) = (next[chip.key] as (string | number)[]).filter(
                v => String(v) !== String(chip.value)
            );
        }
        setFilters(next);
        setAppliedFilters(next);
    };

    // Clicking KPI Stat Tiles toggles status filter
    const handleTileClick = (type: "total" | "active" | "inactive") => {
        if (type === "total") {
            const next = { ...appliedFilters, status: [] };
            setFilters(next);
            setAppliedFilters(next);
        } else {
            const statusName = type === "active" ? "Active" : "Inactive";
            const current = appliedFilters.status;
            const nextStatus = current.includes(statusName) ? [] : [statusName];
            const next = { ...appliedFilters, status: nextStatus };
            setFilters(next);
            setAppliedFilters(next);
        }
    };

    // Drilldown Click Handler for Graphs & Tables
    const handleDrilldown = useCallback((payload: DrilldownPayload) => {
        setDrilldown(payload);
        let list = [...allBranches];
        if (payload.source === "tile") {
            if (payload.value === "active") list = list.filter(b => b.status === true);
            else if (payload.value === "inactive") list = list.filter(b => b.status === false);
        } else if (payload.source === "status") {
            const isAct = String(payload.value).toLowerCase() === "active";
            list = list.filter(b => b.status === isAct);
        } else if (payload.source === "organization") {
            const org = optionsData.organizations.find(o => o.name === payload.value || String(o.id) === String(payload.value));
            list = list.filter(b => org ? Number(b.organizationId) === Number(org.id) : String(b.organizationId) === String(payload.value));
        } else if (payload.source === "region") {
            const reg = optionsData.regions.find(r => r.name === payload.value || String(r.id) === String(payload.value));
            if (reg) list = list.filter(b => Number(b.regionId) === Number(reg.id));
            if (payload.field === "active") list = list.filter(b => b.status === true);
            else if (payload.field === "inactive") list = list.filter(b => b.status === false);
        } else if (payload.source === "type") {
            list = list.filter(b => b.branchType === payload.value);
        } else if (payload.source === "trends") {
            const dateStr = String(payload.value ?? "");
            list = list.filter(b => b.createdAt && b.createdAt.startsWith(dateStr));
        }
        setDrilldownBranches(list);
        setDrilldownOpen(true);
    }, [allBranches, optionsData]);
    // Applied Filter Chips computed from appliedFilters
    const appliedChips = useMemo(() => getFilterChips(appliedFilters, optionsData), [appliedFilters, optionsData]);
    // Table Data for the 5 Graph Cards
    const total = analytics?.total || 1;
    const trendsTableData: TableBreakdownRow[] = useMemo(() =>
        analytics?.creationTrends?.map(item => ({ category: item.month, count: item.count })) ?? [], [analytics]);
    const orgTableData: TableBreakdownRow[] = useMemo(() =>
        analytics?.branchesByOrganization?.map(item => ({
            category: item.name, count: item.count, percentage: `${((item.count / total) * 100).toFixed(1)}%`
        })) ?? [], [analytics, total]);
    const statusTableData: TableBreakdownRow[] = useMemo(() => [
        { category: "Active", count: analytics?.active ?? 0, percentage: `${(((analytics?.active ?? 0) / total) * 100).toFixed(1)}%` },
        { category: "Inactive", count: analytics?.inactive ?? 0, percentage: `${(((analytics?.inactive ?? 0) / total) * 100).toFixed(1)}%` }
    ], [analytics, total]);
    const regionTableData: TableBreakdownRow[] = useMemo(() =>
        analytics?.branchesByRegion?.map(item => ({
            category: item.name, active: item.active, inactive: item.inactive, count: item.active + item.inactive
        })) ?? [], [analytics]);
    const typeTableData: TableBreakdownRow[] = useMemo(() =>
        analytics?.branchesByType?.map(item => ({
            category: item.name, count: item.count, percentage: `${((item.count / total) * 100).toFixed(1)}%`
        })) ?? [], [analytics, total]);
    const activeTileStatus = appliedFilters.status.length === 1 ? appliedFilters.status[0] === "Active" : undefined;

    return (
        <>
            <BranchHeader />
            {/* Dashboard Header Bar */}
            <Card elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, mb: 2.5, borderRadius: 3, border: "1px solid #e2e8f0", background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", display: "flex", flexDirection: { xs: "column", md: "row" }, alignItems: { xs: "flex-start", md: "center" }, justifyContent: "space-between", gap: 2 }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: "#17324d", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(23, 50, 77, 0.25)" }}>
                        <AssessmentIcon sx={{ fontSize: 24 }} />
                    </Box>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a", letterSpacing: -0.5 }}>Dashboard</Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 500 }}>Branch analytics, performance trends, and operational breakdown</Typography>
                    </Box>
                </Stack>

                <Stack direction="row" spacing={1.5} alignItems="center" useFlexGap flexWrap="wrap">
                    {(appliedFilters.createdDateFrom || appliedFilters.createdDateTo) ? (
                        <Chip label={`From: ${appliedFilters.createdDateFrom || "Start"}  To: ${appliedFilters.createdDateTo || "Now"}`} size="small" sx={{ fontWeight: 600, bgcolor: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1" }} />
                    ) : (
                        <Chip label="All Time Records" size="small" sx={{ fontWeight: 600, bgcolor: "#f1f5f9", color: "#334155" }}/>
                    )}
                    <Tooltip title="Refresh Dashboard Page">
                        <IconButton size="small" onClick={() => window.location.reload()} sx={{ border: "1px solid #cbd5e1", bgcolor: "#fff", "&:hover": { bgcolor: "#f1f5f9" } }}>
                            <RefreshIcon sx={{ fontSize: 20, color: "#17324d" }} />
                        </IconButton>
                    </Tooltip>
                    <ToggleButtonGroup size="small" exclusive value={engine} onChange={(_, next: ChartEngine | null) => { if (next) setEngine(next); }} sx={{ height: 34, bgcolor: "#fff", "& .MuiToggleButton-root": { px: 1.5, py: 0.5, fontSize: "0.75rem", fontWeight: 700, textTransform: "none", borderColor: "#cbd5e1" }, "& .Mui-selected": { bgcolor: "#17324d !important", color: "#ffffff !important" } }}>
                        <ToggleButton value="recharts">React Charts</ToggleButton>
                        <ToggleButton value="amcharts">AmCharts</ToggleButton>
                        <ToggleButton value="apexcharts">ApexCharts</ToggleButton>
                    </ToggleButtonGroup>
                </Stack>
            </Card>

            {failed && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>Failed to load dashboard data. Please try again.</Alert>}

            {/* KPI Stat Tiles: Click tile to filter Status */}
            <DashboardStatTiles
                total={analytics?.total ?? 0}
                active={analytics?.active ?? 0}
                inactive={analytics?.inactive ?? 0}
                activeStatusFilter={activeTileStatus}
                onTileClick={handleTileClick}
            />

            {/* Search Filters Card */}
            <DashboardFilterBar
                filters={filters}
                appliedFilters={appliedFilters}
                setFilters={setFilters}
                onApply={handleApplyFilters}
                onReset={handleResetFilters}
                optionsData={optionsData}
            />

            {/* Applied Filter Chips Bar in Dashboard UI */}
            {appliedChips.length > 0 && (
                <Paper elevation={0} sx={{ p: 1.5, mb: 2.5, bgcolor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 3, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }} >
                    <Stack direction="row" spacing={1.5} alignItems="center" useFlexGap flexWrap="wrap">
                        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: "#17324d", mr: 0.5 }}>
                            <FilterListIcon sx={{ fontSize: 18 }} />
                            <Typography variant="body2" sx={{ fontWeight: 700, color: "#17324d" }}> Applied Filters ({appliedChips.length}): </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ flex: 1, minWidth: 0 }}>
                            {appliedChips.map(chip => (
                                <Chip key={`${chip.key}-${chip.value}`} label={chip.label} size="small" variant="outlined" color="primary"
                                    onDelete={() => removeAppliedChip(chip)}
                                    sx={{ borderRadius: 2, fontWeight: 600, bgcolor: "rgba(23, 50, 77, 0.05)", borderColor: "#cbd5e1", color: "#0f172a", "& .MuiChip-deleteIcon": { color: "#64748b", "&:hover": { color: "#d32f2f" } } }}
                                />
                            ))}
                        </Stack>
                        <Button size="small" variant="text" color="error" onClick={handleResetFilters} sx={{ fontSize: "0.75rem", p: 0.5, minWidth: 0, textTransform: "none", fontWeight: 700 }}> Clear All </Button>
                    </Stack>
                </Paper>
            )}

            {loading && !analytics ? (
                <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 10 }}>
                    <CircularProgress size={48} sx={{ color: "#17324d" }} />
                </Box>
            ) : analytics ? (
                <Box sx={{ display: "grid", gap: 2.5 }}>
                    {/* Chart 1: Creation Trends */}
                    <DashboardChartCard
                        title="Branch Creation Trends"
                        subtitle="Growth trajectory and timeline distribution"
                        tableColumns={[
                            { key: "category", label: "Date / Period" },
                            { key: "count", label: "Branches Created", isCount: true }
                        ]}
                        tableData={trendsTableData}
                        onCountClick={row => handleDrilldown({ source: "trends", title: `Branches Created on ${row.category}`, label: String(row.category), value: String(row.category), count: Number(row.count ?? 0) })}
                    >
                        <ColumnChart
                            title="Branch Creation Trends"
                            data={analytics.creationTrends}
                            categoryField="date"
                            valueFields={[{ field: "count", name: "Branches", color: "#1976d2" }]}
                            drillDown
                            engine={engine}
                            onBarClick={cat => handleDrilldown({ source: "trends", title: `Branches Created on ${cat}`, label: cat, value: cat })}
                        />
                    </DashboardChartCard>

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" }, gap: 2.5 }}>
                        {/* Chart 2: Organizations */}
                        <DashboardChartCard
                            title="Branches by Organization"
                            subtitle="Branch distribution across parent organizations"
                            tableColumns={[
                                { key: "category", label: "Organization" },
                                { key: "count", label: "Branch Count", isCount: true },
                                { key: "percentage", label: "Share" }
                            ]}
                            tableData={orgTableData}
                            onCountClick={row => handleDrilldown({ source: "organization", title: `Branches — ${row.category}`, label: String(row.category), value: String(row.category), count: Number(row.count ?? 0) })}
                        >
                            <ColumnChart
                                title="Branches by Organization"
                                data={analytics.branchesByOrganization.map(item => ({ category: item.name, count: item.count }))}
                                categoryField="category"
                                valueFields={[{ field: "count", name: "Branches", color: "#2563eb" }]}
                                engine={engine}
                                onBarClick={cat => handleDrilldown({ source: "organization", title: `Branches — ${cat}`, label: cat, value: cat })}
                            />
                        </DashboardChartCard>

                        {/* Chart 3: Active Share */}
                        <DashboardChartCard
                            title="Overall Active Percentage"
                            subtitle="Active vs inactive ratio"
                            tableColumns={[
                                { key: "category", label: "Category" },
                                { key: "count", label: "Count", isCount: true },
                                { key: "percentage", label: "Percentage" }
                            ]}
                            tableData={statusTableData}
                            onCountClick={row => handleDrilldown({ source: "status", title: `${row.category} Branches`, label: String(row.category), value: String(row.category), count: Number(row.count ?? 0) })}
                        >
                            <GaugeChart
                                title="Active Share"
                                value={analytics.total ? (analytics.active / analytics.total) * 100 : 0}
                                max={100}
                                suffix="% Active"
                                engine={engine}
                                onClick={() => handleDrilldown({ source: "status", title: "Active Branches", label: "Active", value: "Active", count: analytics.active })}
                            />
                        </DashboardChartCard>

                        {/* Chart 4: Region */}
                        <DashboardChartCard
                            title="Active vs Inactive by Region"
                            subtitle="Regional operational distribution"
                            tableColumns={[
                                { key: "category", label: "Region" },
                                { key: "active", label: "Active", isCount: true },
                                { key: "inactive", label: "Inactive", isCount: true },
                                { key: "count", label: "Total Branches", isCount: true }
                            ]}
                            tableData={regionTableData}
                            onCountClick={(row, fieldKey) => {
                                const isAct = fieldKey === "active";
                                const isTot = fieldKey === "count";
                                handleDrilldown({
                                    source: "region",
                                    title: `${isTot ? "All" : isAct ? "Active" : "Inactive"} Branches in ${row.category}`,
                                    label: String(row.category),
                                    value: String(row.category),
                                    field: isTot ? undefined : fieldKey,
                                    count: Number(row[fieldKey] ?? 0)
                                });
                            }}
                        >
                            <ColumnChart
                                title="Active vs Inactive by Region"
                                data={analytics.branchesByRegion.map(item => ({ category: item.name, active: item.active, inactive: item.inactive }))}
                                categoryField="category"
                                valueFields={[
                                    { field: "active", name: "Active", color: "#2e7d32" },
                                    { field: "inactive", name: "Inactive", color: "#d32f2f" }
                                ]}
                                stacked
                                engine={engine}
                                onBarClick={(cat, field) => handleDrilldown({ source: "region", title: `${field === "inactive" ? "Inactive" : "Active"} Branches in ${cat}`, label: cat, value: cat, field })}
                            />
                        </DashboardChartCard>

                        {/* Chart 5: Type */}
                        <DashboardChartCard
                            title="Branches by Type"
                            subtitle="Distribution according to facility classification"
                            tableColumns={[
                                { key: "category", label: "Branch Type" },
                                { key: "count", label: "Branch Count", isCount: true },
                                { key: "percentage", label: "Share" }
                            ]}
                            tableData={typeTableData}
                            onCountClick={row => handleDrilldown({ source: "type", title: `Branches — Type: ${row.category}`, label: String(row.category), value: String(row.category), count: Number(row.count ?? 0) })}
                        >
                            <PieChart
                                title="Branches by Type"
                                data={analytics.branchesByType.map(item => ({ category: item.name, count: item.count }))}
                                categoryField="category"
                                valueField="count"
                                engine={engine}
                                onSliceClick={cat => handleDrilldown({ source: "type", title: `Branches — Type: ${cat}`, label: cat, value: cat })}
                            />
                        </DashboardChartCard>
                    </Box>
                </Box>
            ) : null}

            {/* Drilldown Records Dialog */}
            <BranchDrilldownDialog
                open={drilldownOpen}
                onClose={() => setDrilldownOpen(false)}
                title={drilldown?.title ?? "Branch Records"}
                subtitle={drilldown ? `Filtered by ${drilldown.label}` : undefined}
                branches={drilldownBranches}
                optionsData={optionsData}
                users={users}
            />
        </>
    );
}