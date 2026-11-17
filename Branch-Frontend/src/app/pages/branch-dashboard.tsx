import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { isCancel } from "axios";
import {
    Alert, Box, CircularProgress, Typography, Stack,
    ToggleButton, ToggleButtonGroup, Card, IconButton, Tooltip, Chip, Paper, Button, FormControl, InputLabel, Select, MenuItem
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import AssessmentIcon from "@mui/icons-material/Assessment";
import FilterListIcon from "@mui/icons-material/FilterList";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import BranchHeader from "../../components/Header";
import ColumnChart from "../../components/ColumnChart";
import PieChart from "../../components/PieChart";
import GaugeChart from "../../components/GaugeChart";
import DashboardChartCard from "../../components/DashboardChartCard";
import DashboardStatTiles from "../../components/DashboardStatTiles";
import DashboardFilterBar from "./dashboard-filter";
import BranchDrilldownDialog from "../../components/BranchDrilldownDialog";
import { getFilterChips, exportBranchExcel } from "../branchUtils";
import { searchBranches, getBranches, getAnalytics, getCreationTrends } from "../branchApi";
import type { BranchAnalytics, DropdownOptions, BranchSearchRequest, CreationTrendsResponse } from "../branchApi";
import type { Branch } from "../../types/BranchSchema";
import type { ChartEngine, TableBreakdownRow, DrilldownPayload } from "../../types/chartTypes";
import type { BranchFilters, FilterChip } from "./branch-filter";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch } from "../../redux/store";
import { fetchAnalytics, fetchDropdownOptions, fetchUsers, selectFreshAnalytics, selectFreshDropdownOptions, selectFreshUsers } from "../../redux/cacheSlice";
import { formatDate } from "../filterUtils";
import dayjs from "dayjs";

const defaultFilters = (): BranchFilters => {
    const now = dayjs();
    const to = formatDate(now);
    const from = formatDate(now.subtract(7, "day"));
    return {
        search: "",
        branchType: [],
        organizationId: [],
        regionId: [],
        countryId: [],
        status: [],
        createdDateFrom: from,
        createdDateTo: to
    };
};

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
        creationTrends: Array.from(trendsMap, ([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date))
    };
}

type TrendLevel = "yearly" | "monthly" | "weekly" | "daily";

function getIsoWeekPeriod(dateValue: string): string {
    const date = new Date(`${dateValue}T00:00:00`);
    const isoDay = date.getDay() || 7;
    date.setDate(date.getDate() + 4 - isoDay);

    const year = date.getFullYear();
    const yearStart = new Date(year, 0, 1);
    const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
    return `${year}-W${String(week).padStart(2, "0")}`;
}

function getTrendDateRange(period: string): { from: string; to: string } | null {
    if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
        return { from: formatDate(dayjs(period)), to: formatDate(dayjs(period)) };
    }
    if (/^\d{4}-\d{2}$/.test(period)) {
        const month = dayjs(`${period}-01`);
        return { from: formatDate(month.startOf("month")), to: formatDate(month.endOf("month")) };
    }
    if (/^\d{4}$/.test(period)) {
        const year = dayjs(`${period}-01-01`);
        return { from: formatDate(year.startOf("year")), to: formatDate(year.endOf("year")) };
    }

    const weeklyMatch = /^(\d{4})-W(\d{2})$/.exec(period);
    if (weeklyMatch) {
        const year = Number(weeklyMatch[1]);
        const week = Number(weeklyMatch[2]);
        const fourthJanuary = dayjs(`${year}-01-04`);
        const firstIsoWeekStart = fourthJanuary.subtract((fourthJanuary.day() + 6) % 7, "day");
        const weekStart = firstIsoWeekStart.add(week - 1, "week");
        return { from: formatDate(weekStart), to: formatDate(weekStart.add(6, "day")) };
    }

    return null;
}

export default function BranchDashboard() {
    const dispatch = useDispatch<AppDispatch>();
    const [engine, setEngine] = useState<ChartEngine>("recharts");
    const [analytics, setAnalytics] = useState<BranchAnalytics | null>(null);
    const [overallAnalytics, setOverallAnalytics] = useState<BranchAnalytics | null>(null);
    const [allBranches, setAllBranches] = useState<Branch[]>([]);
    const [totalFilteredCount, setTotalFilteredCount] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [filters, setFilters] = useState<BranchFilters>(defaultFilters);
    const [appliedFilters, setAppliedFilters] = useState<BranchFilters>(defaultFilters);
    const [drilldown, setDrilldown] = useState<DrilldownPayload | null>(null);
    const [drilldownBranches, setDrilldownBranches] = useState<Branch[]>([]);
    const [drilldownOpen, setDrilldownOpen] = useState(false);
    const [drilldownLoading, setDrilldownLoading] = useState(false);
    const drilldownRequestId = useRef(0);
    const isInitialMount = useRef(true);
    // Creation Trends state
    const [creationTrendsLevel, setCreationTrendsLevel] = useState<TrendLevel>("monthly");
    const [creationTrendsData, setCreationTrendsData] = useState<CreationTrendsResponse | null>(null);
    const [creationTrendsLoading, setCreationTrendsLoading] = useState(false);
    const [creationTrendsError, setCreationTrendsError] = useState<string | null>(null);
    const [weeklySelectedMonth, setWeeklySelectedMonth] = useState<string>("");
    // Use shared Redux cache for dropdown options, analytics, and users
    const optionsData = useSelector(selectFreshDropdownOptions) ?? emptyOptions;
    const rawUsers = useSelector(selectFreshUsers);
    const users = useMemo(() => rawUsers ?? [], [rawUsers]);
    const cachedAnalytics = useSelector(selectFreshAnalytics);
    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        (analytics?.creationTrends ?? []).forEach(item => {
            if (/^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
                months.add(item.date.slice(0, 7));
            }
        });
        return Array.from(months).sort((a, b) => b.localeCompare(a));
    }, [analytics]);
    const currentMonth = useMemo(
        () => availableMonths[0] ?? dayjs().format("YYYY-MM"),
        [availableMonths]
    );
    const totalBranchesCountRef = useRef(1);
    useEffect(() => {
        const t = overallAnalytics?.total ?? analytics?.total;
        if (t) totalBranchesCountRef.current = Math.max(t, 1);
    }, [overallAnalytics?.total, analytics?.total]);
    // Build search request from applied filters
    const buildSearchRequest = useCallback((filterObj: BranchFilters): BranchSearchRequest => {
        const statusVal = filterObj.status.length === 1 ? filterObj.status[0] === "Active" : undefined;
        return {
            organizationId: filterObj.organizationId.length ? filterObj.organizationId : undefined,
            regionId: filterObj.regionId.length ? filterObj.regionId : undefined,
            countryId: filterObj.countryId.length ? filterObj.countryId : undefined,
            branchType: filterObj.branchType.length ? filterObj.branchType : undefined,
            status: statusVal,
            createdDateFrom: filterObj.createdDateFrom || undefined,
            createdDateTo: filterObj.createdDateTo || undefined
        };
    }, []);
    // Fetch creation trends from API
    const fetchCreationTrends = useCallback(async (
        level: TrendLevel,
        filterObj: BranchFilters,
        signal: AbortSignal,
        month?: string
    ) => {
        setCreationTrendsLoading(true);
        setCreationTrendsError(null);
        const searchReq = buildSearchRequest(filterObj);
        // For weekly, add the selected month to the request
        if (level === "weekly" && month) {
            const [year, monthNum] = month.split("-").map(Number);
            const startOfMonth = dayjs().year(year).month(monthNum - 1).startOf("month");
            const endOfMonth = dayjs().year(year).month(monthNum - 1).endOf("month");
            searchReq.createdDateFrom = formatDate(startOfMonth);
            searchReq.createdDateTo = formatDate(endOfMonth);
        }
        try {
            const response = await getCreationTrends(level, searchReq, signal);
            if (signal.aborted) return;
            setCreationTrendsData(response.data);
        } catch (err) {
            if (!isCancel(err) && !signal.aborted) setCreationTrendsError("Failed to load creation trends");
        } finally {
            if (!signal.aborted) setCreationTrendsLoading(false);
        }
    }, [buildSearchRequest]);
    // Initial load: Fetch from shared cache
    const initialAppliedFilters = useRef(appliedFilters);
    useEffect(() => {
        const controller = new AbortController();
        const loadDashboard = async () => {
            try {
                const [initialOptions, , analyticsResult] = await Promise.all([
                    dispatch(fetchDropdownOptions()).unwrap(),
                    dispatch(fetchUsers()).unwrap(),
                    dispatch(fetchAnalytics()).unwrap(),
                ]);
                if (controller.signal.aborted) return;
                const analyticsData = analyticsResult;
                if (analyticsData) {
                    setOverallAnalytics(analyticsData);
                    const initialSearch = buildSearchRequest(initialAppliedFilters.current);
                    const branchRes = await searchBranches(
                        initialSearch,
                        { page: 0, size: Math.max(analyticsData.total || 1, 1) },
                        controller.signal
                    );
                    if (controller.signal.aborted) return;
                    const list = branchRes.data?.content ?? [];
                    setAllBranches(list);
                    setTotalFilteredCount(branchRes.data?.totalElements ?? list.length);
                    setAnalytics(computeAnalytics(list, initialOptions));
                }
            } catch (err) {
                if (!isCancel(err)) setFailed(true);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        loadDashboard();
        return () => controller.abort();
    }, [dispatch, buildSearchRequest]);
    // Filter change effect
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        const searchReq = buildSearchRequest(appliedFilters);
        const hasFilter = Object.values(searchReq).some(v => v !== undefined);
        const controller = new AbortController();
        setLoading(true);

        const pageSize = Math.max(totalBranchesCountRef.current, 1);
        const fetchPromise = hasFilter
            ? searchBranches(searchReq, { page: 0, size: pageSize }, controller.signal)
            : getBranches({ page: 0, size: pageSize }, controller.signal);

        fetchPromise.then(res => {
            const page = res.data;
            const list = page?.content ?? [];
            setAllBranches(list);
            setTotalFilteredCount(page?.totalElements ?? list.length);
            if (hasFilter) {
                setAnalytics(computeAnalytics(list, optionsData));
            } else {
                if (cachedAnalytics) {
                    setAnalytics(cachedAnalytics);
                    setOverallAnalytics(cachedAnalytics);
                } else {
                    getAnalytics(controller.signal)
                        .then(aRes => {
                            setAnalytics(aRes.data);
                            setOverallAnalytics(aRes.data);
                        })
                        .catch(() => { });
                }
            }
            setLoading(false);
        }).catch(err => {
            if (!isCancel(err)) setFailed(true);
            setLoading(false);
        });
        return () => controller.abort();
    }, [appliedFilters, optionsData, cachedAnalytics, buildSearchRequest]);

    // Fetch creation trends when level or appliedFilters change
    useEffect(() => {
        const controller = new AbortController();
        const month = creationTrendsLevel === "weekly"
            ? (weeklySelectedMonth || currentMonth)
            : undefined;

        void fetchCreationTrends(creationTrendsLevel, appliedFilters, controller.signal, month);
        return () => controller.abort();
    }, [creationTrendsLevel, appliedFilters, weeklySelectedMonth, currentMonth, fetchCreationTrends]);

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
            (next[chip.key] as (string | number)[]) = (next[chip.key] as (string | number)[]).filter(v => String(v) !== String(chip.value));
        }
        setFilters(next);
        setAppliedFilters(next);
    };
    // KPI tiles update the dashboard's status filter; they never open a drilldown table.
    const handleTileClick = (type: "total" | "active" | "inactive") => {
        if (type === "total") {
            const clearedFilters: BranchFilters = {
                search: "",
                branchType: [],
                organizationId: [],
                regionId: [],
                countryId: [],
                status: [],
                createdDateFrom: "",
                createdDateTo: ""
            };
            setFilters(clearedFilters);
            setAppliedFilters(clearedFilters);
            return;
        }

        const status = type === "total" ? [] : [type === "active" ? "Active" : "Inactive"];
        const next = { ...appliedFilters, status };
        setFilters(next);
        setAppliedFilters(next);
    };

    // Drilldown from table counts (not from charts anymore)
    const handleTableDrilldown = useCallback(async (payload: DrilldownPayload) => {
        setDrilldown(payload);
        setDrilldownOpen(true);

        if (payload.source === "trends") {
            const period = String(payload.value ?? "");
            const dateRange = getTrendDateRange(period);
            if (!dateRange) {
                setDrilldownBranches([]);
                return;
            }

            const requestId = ++drilldownRequestId.current;
            setDrilldownLoading(true);
            setDrilldownBranches([]);
            try {
                const searchRequest = {
                    ...buildSearchRequest(appliedFilters),
                    createdDateFrom: dateRange.from,
                    createdDateTo: dateRange.to
                };
                const result = await searchBranches(
                    searchRequest,
                    { page: 0, size: Math.max(Number(payload.count ?? 0), 1) }
                );
                if (requestId === drilldownRequestId.current) {
                    setDrilldownBranches(result.data?.content ?? []);
                }
            } catch (err) {
                if (!isCancel(err)) setFailed(true);
            } finally {
                if (requestId === drilldownRequestId.current) setDrilldownLoading(false);
            }
            return;
        }

        let list = [...allBranches];
        if (payload.source === "status") {
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
        }
        setDrilldownBranches(list);
    }, [allBranches, optionsData, appliedFilters, buildSearchRequest]);

    const handleExportDashboard = useCallback(async () => {
        const searchReq = buildSearchRequest(appliedFilters);
        const hasFilter = Object.values(searchReq).some(v => v !== undefined);
        const controller = new AbortController();

        try {
            const fetchPromise = hasFilter
                ? searchBranches(searchReq, { page: 0, size: totalFilteredCount }, controller.signal)
                : getBranches({ page: 0, size: totalFilteredCount }, controller.signal);

            const res = await fetchPromise;
            const list = res.data?.content ?? [];
            if (list.length === 0) return;
            exportBranchExcel(list, optionsData, users, "dashboard-branches.xlsx", "Branches");
        } catch (err) {
            if (!isCancel(err)) console.error("Export failed:", err);
        }
    }, [appliedFilters, buildSearchRequest, totalFilteredCount, optionsData, users]);

    const appliedChips = useMemo(() => getFilterChips(appliedFilters, optionsData), [appliedFilters, optionsData]);
    const total = analytics?.total || 1;
    const trendsTableData: TableBreakdownRow[] = useMemo(() =>
        creationTrendsData?.trends?.map(item => ({ category: item.period, count: item.count })) ?? [], [creationTrendsData]);
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
                        <Chip label="All Time Records" size="small" sx={{ fontWeight: 600, bgcolor: "#f1f5f9", color: "#334155" }} />
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

            {/* KPI Stat Tiles */}
            <DashboardStatTiles
                total={overallAnalytics?.total ?? 0}
                active={overallAnalytics?.active ?? 0}
                inactive={overallAnalytics?.inactive ?? 0}
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

            {/* Applied Filter Chips Bar */}
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
                        <Stack direction="row" spacing={0.5} alignItems="center">
                            <Button size="small" variant="text" startIcon={<FileDownloadIcon fontSize="small" />} onClick={handleExportDashboard} sx={{ fontSize: "0.75rem", p: 0.5, minWidth: 0, textTransform: "none", fontWeight: 700, color: "#17324d" }}> Export ({totalFilteredCount}) </Button>
                            <Button size="small" variant="text" color="error" onClick={handleResetFilters} sx={{ fontSize: "0.75rem", p: 0.5, minWidth: 0, textTransform: "none", fontWeight: 700 }}> Clear All </Button>
                        </Stack>
                    </Stack>
                </Paper>
            )}

            {loading && !analytics ? (
                <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 10 }}>
                    <CircularProgress size={48} sx={{ color: "#17324d" }} />
                </Box>
            ) : analytics ? (
                <Box sx={{ display: "grid", gap: 2.5 }}>
                    {/* Chart 1: Creation Trends - API Driven */}
                    <DashboardChartCard
                        title="Branch Creation Trends"
                        subtitle="Growth trajectory and timeline distribution"
                        tableColumns={[
                            { key: "category", label: "Period" },
                            { key: "count", label: "Branches Created", isCount: true }
                        ]}
                        tableData={trendsTableData}
                        onCountClick={row => handleTableDrilldown({ source: "trends", title: `Branches Created in ${row.category}`, label: String(row.category), value: String(row.category), count: Number(row.count ?? 0) })}
                    >
                        <Box sx={{ width: "100%" }}>
                            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 1.5 }}>
                                <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1, color: "text.secondary" }}> Granularity </Typography>
                                <ToggleButtonGroup size="small" exclusive value={creationTrendsLevel} onChange={(_, nextLevel: TrendLevel | null) => { if (nextLevel) setCreationTrendsLevel(nextLevel); }} >
                                    <ToggleButton value="yearly" sx={{ px: 1.5, py: 0.25, fontSize: "0.75rem" }}>Yearly</ToggleButton>
                                    <ToggleButton value="monthly" sx={{ px: 1.5, py: 0.25, fontSize: "0.75rem" }}>Monthly</ToggleButton>
                                    <ToggleButton value="weekly" sx={{ px: 1.5, py: 0.25, fontSize: "0.75rem" }}>Weekly</ToggleButton>
                                    <ToggleButton value="daily" sx={{ px: 1.5, py: 0.25, fontSize: "0.75rem" }}>Daily</ToggleButton>
                                </ToggleButtonGroup>
                                {creationTrendsLevel === "weekly" && (
                                    <FormControl size="small" sx={{ minWidth: 140 }}>
                                        <InputLabel sx={{ fontSize: "0.8rem" }}>Month</InputLabel>
                                        <Select value={weeklySelectedMonth || currentMonth} label="Month" sx={{ fontSize: "0.8rem" }} onChange={event => setWeeklySelectedMonth(event.target.value)} >
                                            {availableMonths.map(item => (
                                                <MenuItem key={item} value={item} sx={{ fontSize: "0.8rem" }}>
                                                    {dayjs(item).format("MMMM YYYY")}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                )}
                            </Box>
                            {creationTrendsLoading ? (
                                <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 10 }}>
                                    <CircularProgress size={48} sx={{ color: "#17324d" }} />
                                </Box>
                            ) : creationTrendsError ? (
                                <Typography color="error" textAlign="center" py={5}> {creationTrendsError} </Typography>
                            ) : !creationTrendsData?.trends?.length ? (
                                <Typography color="text.secondary" textAlign="center" py={5}> No creation trend data available for the selected period. </Typography>
                            ) : (
                                <ColumnChart
                                    title="Branch Creation Trends"
                                    data={creationTrendsData.trends.map(t => ({ date: t.period, count: t.count }))}
                                    categoryField="date"
                                    valueFields={[{ field: "count", name: "Branches", color: "#1976d2" }]}
                                    drillDown={false}
                                    engine={engine}
                                />
                            )}
                        </Box>
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
                            onCountClick={row => handleTableDrilldown({ source: "organization", title: `Branches — ${row.category}`, label: String(row.category), value: String(row.category), count: Number(row.count ?? 0) })}
                        >
                            <ColumnChart
                                title="Branches by Organization"
                                data={analytics.branchesByOrganization.map(item => ({ category: item.name, count: item.count }))}
                                categoryField="category"
                                valueFields={[{ field: "count", name: "Branches", color: "#2563eb" }]}
                                engine={engine}
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
                            onCountClick={row => handleTableDrilldown({ source: "status", title: `${row.category} Branches`, label: String(row.category), value: String(row.category), count: Number(row.count ?? 0) })}
                        >
                            <GaugeChart
                                title="Active Share"
                                value={analytics.total ? (analytics.active / analytics.total) * 100 : 0}
                                max={100}
                                suffix="% Active"
                                engine={engine}
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
                                handleTableDrilldown({
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
                            onCountClick={row => handleTableDrilldown({ source: "type", title: `Branches — Type: ${row.category}`, label: String(row.category), value: String(row.category), count: Number(row.count ?? 0) })}
                        >
                            <PieChart
                                title="Branches by Type"
                                data={analytics.branchesByType.map(item => ({ category: item.name, count: item.count }))}
                                categoryField="category"
                                valueField="count"
                                engine={engine}
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
                loading={drilldownLoading}
            />
        </>
    );
}
