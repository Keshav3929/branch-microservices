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
import { searchBranches, getAnalytics, getCreationTrends } from "../branchApi";
import type { BranchAnalytics, DropdownOptions, BranchSearchRequest, CreationTrendsResponse } from "../branchApi";
import type { Branch } from "../../types/BranchSchema";
import type { ChartEngine, TableBreakdownRow, DrilldownPayload } from "../../types/chartTypes";
import type { BranchFilters, FilterChip } from "./branch-filter";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch } from "../../redux/store";
import { fetchDropdownOptions, fetchUsers, selectFreshDropdownOptions, selectFreshUsers } from "../../redux/cacheSlice";
import { formatDate } from "../filterUtils";
import dayjs from "dayjs";
import type { MRT_PaginationState, MRT_SortingState } from "material-react-table";

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

type TrendLevel = "yearly" | "monthly" | "weekly" | "daily";

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
    const [totalFilteredCount, setTotalFilteredCount] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [filters, setFilters] = useState<BranchFilters>(defaultFilters);
    const [appliedFilters, setAppliedFilters] = useState<BranchFilters>(defaultFilters);
    const [drilldown, setDrilldown] = useState<DrilldownPayload | null>(null);
    const [drilldownBranches, setDrilldownBranches] = useState<Branch[]>([]);
    const [drilldownOpen, setDrilldownOpen] = useState(false);
    const [drilldownLoading, setDrilldownLoading] = useState(false);
    const [drilldownPagination, setDrilldownPagination] = useState<MRT_PaginationState>({
        pageIndex: 0, pageSize: 10
    });
    const [drilldownSorting, setDrilldownSorting] = useState<MRT_SortingState>([]);
    const [drilldownRowCount, setDrilldownRowCount] = useState(0);
    const [drilldownError, setDrilldownError] = useState(false);
    const drilldownRequestId = useRef(0);
    const initialLoadComplete = useRef(false);
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
    const trendAbortRef = useRef<AbortController | null>(null);
    const analyticsAbortRef = useRef<AbortController | null>(null);
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

    // Refresh handler - preserves filters, refreshes data in place
    const handleRefresh = useCallback(() => {
        const searchReq = buildSearchRequest(appliedFilters);

        analyticsAbortRef.current?.abort();

        const controller = new AbortController();
        analyticsAbortRef.current = controller;

        setFailed(false);
        setLoading(true);

        getAnalytics(searchReq, controller.signal)
            .then(res => {
                if (controller.signal.aborted) return;
                setAnalytics(res.data);
                setOverallAnalytics(res.data);
                setTotalFilteredCount(res.data.total);
            })
            .catch(err => {
                if (!isCancel(err) && !controller.signal.aborted) {
                    setFailed(true);
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            });

        trendAbortRef.current?.abort();

        const trendController = new AbortController();
        trendAbortRef.current = trendController;

        fetchCreationTrends(
            creationTrendsLevel,
            appliedFilters,
            trendController.signal,
            creationTrendsLevel === "weekly" ? weeklySelectedMonth : undefined
        );
    }, [
        appliedFilters,
        creationTrendsLevel,
        weeklySelectedMonth,
        buildSearchRequest,
        fetchCreationTrends
    ]);

    useEffect(() => {

        const controller = new AbortController();
        const loadDashboard = async () => {
            try {
                const [, , analyticsResult] = await Promise.all([
                    dispatch(fetchDropdownOptions()).unwrap(),
                    dispatch(fetchUsers()).unwrap(),
                    getAnalytics(buildSearchRequest(appliedFilters), controller.signal),
                ]);

                if (controller.signal.aborted) return;

                setOverallAnalytics(analyticsResult.data);
                setAnalytics(analyticsResult.data);
                setTotalFilteredCount(analyticsResult.data.total);

                initialLoadComplete.current = true;
            } catch (err) {
                if (!controller.signal.aborted && !isCancel(err)) {
                    setFailed(true);
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        loadDashboard();

        return () => controller.abort();
    }, [dispatch]);
    // Filter change effect
    useEffect(() => {
        if (!initialLoadComplete.current) return;

        const searchReq = buildSearchRequest(appliedFilters);
        analyticsAbortRef.current?.abort();

        const controller = new AbortController();
        analyticsAbortRef.current = controller;

        setFailed(false);
        setLoading(true);

        getAnalytics(searchReq, controller.signal)
            .then(res => {
                if (controller.signal.aborted) return;
                setAnalytics(res.data);
                setOverallAnalytics(res.data);
                setTotalFilteredCount(res.data.total);
            })
            .catch(err => {
                if (!isCancel(err) && !controller.signal.aborted) {
                    setFailed(true);
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            });

        return () => controller.abort();
    }, [appliedFilters, buildSearchRequest]);

    // Fetch creation trends when level or appliedFilters change
    useEffect(() => {
        // Abort previous trend request
        if (trendAbortRef.current) {
            trendAbortRef.current.abort();
        }
        const controller = new AbortController();
        trendAbortRef.current = controller;
        const month = creationTrendsLevel === "weekly"
            ? (weeklySelectedMonth || currentMonth)
            : undefined;

        void fetchCreationTrends(creationTrendsLevel, appliedFilters, controller.signal, month);
        return () => controller.abort();
    }, [creationTrendsLevel, appliedFilters, weeklySelectedMonth, currentMonth, fetchCreationTrends]);

    useEffect(() => {
        return () => {
            analyticsAbortRef.current?.abort();
            trendAbortRef.current?.abort();
        };
    }, []);

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

        const status = [type === "active" ? "Active" : "Inactive"];
        const next = { ...appliedFilters, status };
        setFilters(next);
        setAppliedFilters(next);
    };

    // Drilldown from table counts (not from charts anymore)
    const handleTableDrilldown = useCallback((payload: DrilldownPayload) => {
        setDrilldown(payload);
        setDrilldownBranches([]);
        setDrilldownRowCount(0);
        setDrilldownPagination(prev => ({ ...prev, pageIndex: 0 }));
        setDrilldownSorting([]);
        setDrilldownOpen(true);
    }, []);
    useEffect(() => {
        if (!drilldownOpen || !drilldown) return;

        const controller = new AbortController();
        const requestId = ++drilldownRequestId.current;
        setDrilldownLoading(false);
        const filters = buildSearchRequest(appliedFilters);
        const value = String(drilldown.value ?? "");

        if (drilldown.source === "status") {
            if (value.toLowerCase() !== "active" && value.toLowerCase() !== "inactive") {
                setDrilldownBranches([]);
                setDrilldownRowCount(0);
                return;
            }
            filters.status = value.toLowerCase() === "active";
        } else if (drilldown.source === "organization") {
            const org = optionsData.organizations.find(item => item.name === value || String(item.id) === value);
            if (!org) {
                setDrilldownBranches([]);
                setDrilldownRowCount(0);
                return;
            }
            filters.organizationId = [org.id];
        } else if (drilldown.source === "region") {
            const region = optionsData.regions.find(item => item.name === value || String(item.id) === value);
            if (!region) {
                setDrilldownBranches([]);
                setDrilldownRowCount(0);
                return;
            }
            filters.regionId = [region.id];

            if (drilldown.field === "active") filters.status = true;
            else if (drilldown.field === "inactive") filters.status = false;
        } else if (drilldown.source === "type") {
            if (!value) {
                setDrilldownBranches([]);
                setDrilldownRowCount(0);
                return;
            }
            filters.branchType = [value];
        } else if (drilldown.source === "trends") {
            const dateRange = getTrendDateRange(value);
            if (!dateRange) {
                setDrilldownBranches([]);
                setDrilldownRowCount(0);
                return;
            }
            filters.createdDateFrom = dateRange.from;
            filters.createdDateTo = dateRange.to;
        } else {
            setDrilldownBranches([]);
            setDrilldownRowCount(0);
            return;
        }

        const sortableColumns = ["branchCode", "branchName", "branchType", "createdAt"];
        const sortColumn = drilldownSorting[0];
        const sort = sortColumn && sortableColumns.includes(sortColumn.id) ? `${sortColumn.id},${sortColumn.desc ? "desc" : "asc"}` : undefined;
        setDrilldownError(false);
        setDrilldownLoading(true);

        searchBranches(filters, { page: drilldownPagination.pageIndex, size: drilldownPagination.pageSize, sort }, controller.signal)
            .then(result => {
                if (requestId !== drilldownRequestId.current) return;
                setDrilldownBranches(result.data?.content ?? []);
                setDrilldownRowCount(result.data?.totalElements ?? 0);
            })
            .catch(error => {
                if (!isCancel(error) && requestId === drilldownRequestId.current) {
                    setDrilldownError(true);
                }
            })
            .finally(() => {
                if (requestId === drilldownRequestId.current) {
                    setDrilldownLoading(false);
                }
            });
        return () => controller.abort();
    }, [
        drilldownOpen,
        drilldown,
        drilldownPagination,
        drilldownSorting,
        appliedFilters,
        buildSearchRequest,
        optionsData
    ]);
    const handleExportDashboard = useCallback(async () => {
        const searchReq = buildSearchRequest(appliedFilters);
        const controller = new AbortController();
        try {
            const fetchPromise = searchBranches(searchReq, { page: 0, size: totalFilteredCount }, controller.signal);
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
                    <Tooltip title="Refresh Dashboard Data">
                        <IconButton size="small" onClick={handleRefresh} sx={{ border: "1px solid #cbd5e1", bgcolor: "#fff", "&:hover": { bgcolor: "#f1f5f9" } }}>
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
            {drilldownError && drilldownOpen && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    Failed to load branch records. Please try again.
                </Alert>
            )}
            <BranchDrilldownDialog
                open={drilldownOpen}
                onClose={() => setDrilldownOpen(false)}
                title={drilldown?.title ?? "Branch Records"}
                subtitle={drilldown ? `Filtered by ${drilldown.label}` : undefined}
                branches={drilldownBranches}
                optionsData={optionsData}
                users={users}
                loading={drilldownLoading}
                serverSide={{
                    rowCount: drilldownRowCount,
                    pagination: drilldownPagination,
                    sorting: drilldownSorting,
                    onPaginationChange: setDrilldownPagination,
                    onSortingChange: setDrilldownSorting
                }}
            />
        </>
    );
}