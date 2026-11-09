import { useState, useMemo } from "react";
import type { ReactNode } from "react";
import {
    Box, Paper, Typography, ToggleButtonGroup, ToggleButton,
    IconButton, Tooltip, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, TablePagination, TableSortLabel, Dialog,
    DialogTitle, DialogContent, DialogActions, Button, Stack
} from "@mui/material";
import BarChartIcon from "@mui/icons-material/BarChart";
import TableChartIcon from "@mui/icons-material/TableChart";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import CloseFullscreenIcon from "@mui/icons-material/CloseFullscreen";
import CloseIcon from "@mui/icons-material/Close";
import type { ChartDisplayMode, TableBreakdownRow } from "../types/chartTypes";

export type ColumnSpec = {
    key: string;
    label: string;
    align?: "left" | "center" | "right";
    isCount?: boolean;
    format?: (value: unknown, row: TableBreakdownRow) => ReactNode;
};

export type DashboardChartCardProps = {
    title: string;
    subtitle?: string;
    tableColumns: ColumnSpec[];
    tableData: TableBreakdownRow[];
    onCountClick?: (row: TableBreakdownRow, fieldKey: string, count: number) => void;
    children: ReactNode;
    initialMode?: ChartDisplayMode;
    height?: number;
};

type SortOrder = "asc" | "desc";

export default function DashboardChartCard({
    title, subtitle, tableColumns, tableData, onCountClick, children, initialMode = "graph", height = 320
}: DashboardChartCardProps) {
    const [mode, setMode] = useState<ChartDisplayMode>(initialMode);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [orderBy, setOrderBy] = useState<string>(tableColumns[0]?.key ?? "category");
    const [order, setOrder] = useState<SortOrder>("asc");
    const [dialogOpen, setDialogOpen] = useState(false);

    const handleSort = (columnKey: string) => {
        const isAsc = orderBy === columnKey && order === "asc";
        setOrder(isAsc ? "desc" : "asc");
        setOrderBy(columnKey);
    };

    const sortedData = useMemo(() => {
        return [...tableData].sort((a, b) => {
            const valA = a[orderBy];
            const valB = b[orderBy];

            if (typeof valA === "number" && typeof valB === "number") {
                return order === "asc" ? valA - valB : valB - valA;
            }
            const strA = String(valA ?? "");
            const strB = String(valB ?? "");
            return order === "asc" ? strA.localeCompare(strB, undefined, { numeric: true }) : strB.localeCompare(strA, undefined, { numeric: true });
        });
    }, [tableData, orderBy, order]);

    const paginatedData = useMemo(() => {
        const start = page * rowsPerPage;
        return sortedData.slice(start, start + rowsPerPage);
    }, [sortedData, page, rowsPerPage]);
    // Totals row calculation
    const totals = useMemo(() => {
        const acc: Record<string, number> = {};
        tableColumns.forEach(col => {
            if (col.isCount) { acc[col.key] = tableData.reduce((sum, row) => sum + Number(row[col.key] ?? 0), 0); }
        });
        return acc;
    }, [tableColumns, tableData]);

    const renderTable = (isEnlarged = false) => (
        <Box sx={{ width: "100%", minHeight: isEnlarged ? 450 : height, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <TableContainer sx={{ maxHeight: isEnlarged ? 520 : height - 52, overflowY: "auto" }}>
                <Table size="small" stickyHeader sx={{ minWidth: 280 }}>
                    <TableHead>
                        <TableRow>
                            {tableColumns.map(col => (
                                <TableCell key={col.key} align={col.align ?? (col.isCount ? "right" : "left")} sx={{ bgcolor: "#17324d", color: "#ffffff", fontWeight: 700, fontSize: "0.8rem", py: 1, "& .MuiTableSortLabel-root, & .MuiTableSortLabel-root:hover, & .MuiTableSortLabel-root.Mui-active": { color: "#ffffff !important" }, "& .MuiTableSortLabel-icon": { color: "#ffffff !important" } }} >
                                    <TableSortLabel active={orderBy === col.key} direction={orderBy === col.key ? order : "asc"} onClick={() => handleSort(col.key)} > {col.label} </TableSortLabel>
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {!tableData.length ? (
                            <TableRow>
                                <TableCell colSpan={tableColumns.length} align="center" sx={{ py: 4, color: "text.secondary" }}> No records available </TableCell>
                            </TableRow>
                        ) : (
                            paginatedData.map((row, idx) => (
                                <TableRow key={row.id ?? `${row.category}-${idx}`} hover sx={{ "&:nth-of-type(even)": { bgcolor: "rgba(0, 0, 0, 0.02)" }, "&:hover": { bgcolor: "rgba(37, 99, 235, 0.06)" } }} > {tableColumns.map(col => {
                                        const rawVal = row[col.key];
                                        const countNum = Number(rawVal ?? 0);
                                        if (col.isCount && onCountClick && countNum > 0) {
                                            return (
                                                <TableCell key={col.key} align={col.align ?? "right"} sx={{ py: 0.75, fontSize: "0.85rem" }}>
                                                    <Button variant="text" size="small" onClick={() => onCountClick(row, col.key, countNum)} sx={{ p: 0.25, minWidth: 0, fontWeight: 700, color: "primary.main", fontSize: "0.85rem", textTransform: "none", borderRadius: 1, "&:hover": { textDecoration: "underline", bgcolor: "rgba(37, 99, 235, 0.1)" } }}> {col.format ? col.format(rawVal, row) : countNum.toLocaleString()} </Button>
                                                </TableCell>
                                            );
                                        }
                                        return (
                                            <TableCell key={col.key} align={col.align ?? (col.isCount ? "right" : "left")} sx={{ py: 0.75, fontSize: "0.85rem", fontWeight: col.key === "category" ? 600 : 400 }} >
                                                {col.format ? col.format(rawVal, row) : String(rawVal ?? "-")}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))
                        )}
                        {/* Summary / Totals Row */}
                        {tableData.length > 1 && (
                            <TableRow sx={{ bgcolor: "rgba(15, 23, 42, 0.04)", borderTop: "2px solid #cbd5e1" }}>
                                {tableColumns.map((col, idx) => (
                                    <TableCell key={col.key} align={col.align ?? (col.isCount ? "right" : "left")} sx={{ py: 1, fontWeight: 800, fontSize: "0.85rem", color: "#0f172a" }} >
                                        {idx === 0 ? "Total" : col.isCount ? totals[col.key]?.toLocaleString() ?? "-" : "-"}
                                    </TableCell>
                                ))}
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
            <TablePagination rowsPerPageOptions={[5, 10, 20]} component="div" count={tableData.length} rowsPerPage={rowsPerPage} page={page} onPageChange={(_, newPage) => setPage(newPage)}
                onRowsPerPageChange={e => {
                    setRowsPerPage(parseInt(e.target.value, 10));
                    setPage(0);
                }}
                sx={{ borderTop: "1px solid #f1f5f9", "& .MuiTablePagination-toolbar": { minHeight: 40, px: 1 }, "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": { fontSize: "0.75rem", m: 0 } }} />
        </Box>
    );

    return (
        <>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, borderColor: "divider", bgcolor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transition: "box-shadow 0.2s ease, transform 0.2s ease", display: "flex", flexDirection: "column", minWidth: 0, "&:hover": { boxShadow: "0 6px 18px rgba(0,0,0,0.07)" }}} >
                {/* Header Controls */}
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mb: 1.5, pb: 1, borderBottom: "1px solid #f1f5f9" }} >
                    <Stack direction="row" spacing={1} alignItems="center">
                        <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_, nextMode: ChartDisplayMode | null) => { if (nextMode) setMode(nextMode); }} sx={{ height: 32, "& .MuiToggleButton-root": { px: 1.25, py: 0.25, fontSize: "0.75rem", fontWeight: 600, textTransform: "none" }, "& .Mui-selected": { bgcolor: "#17324d !important", color: "#ffffff !important" } }} >
                            <ToggleButton value="graph"> <BarChartIcon sx={{ fontSize: 16, mr: 0.5 }} /> Graph </ToggleButton>
                            <ToggleButton value="table"> <TableChartIcon sx={{ fontSize: 16, mr: 0.5 }} /> Table </ToggleButton>
                        </ToggleButtonGroup>
                    </Stack>
                    <Box sx={{ flex: 1, textAlign: { xs: "left", sm: "center" }, minWidth: 160 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "text.primary", lineHeight: 1.2 }}> {title} </Typography>
                        {subtitle && ( <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.75rem" }}> {subtitle} </Typography> )}
                    </Box>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                        <Tooltip title="Expand to Dialog">
                            <IconButton size="small" onClick={() => setDialogOpen(true)} sx={{ color: "text.secondary", "&:hover": { color: "primary.main" } }} > <OpenInFullIcon sx={{ fontSize: 18 }} /> </IconButton>
                        </Tooltip>
                    </Stack>
                </Box>
                {/* Content View */}
                <Box sx={{ width: "100%", minHeight: height }}> {mode === "graph" ? children : renderTable(false)} </Box>
            </Paper>
            {/* Fullscreen / Enlarged Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3, p: 1 } }} >
                <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_, nextMode: ChartDisplayMode | null) => { if (nextMode) setMode(nextMode); }} sx={{ height: 32, "& .Mui-selected": { bgcolor: "#17324d !important", color: "#ffffff !important" } }} >
                            <ToggleButton value="graph"> <BarChartIcon sx={{ fontSize: 16, mr: 0.5 }} /> Graph </ToggleButton>
                            <ToggleButton value="table"> <TableChartIcon sx={{ fontSize: 16, mr: 0.5 }} /> Table </ToggleButton>
                        </ToggleButtonGroup>
                        <Box>
                            <Typography variant="h6" fontWeight={700}>{title}</Typography> {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
                        </Box>
                    </Stack>
                    <IconButton onClick={() => setDialogOpen(false)}> <CloseIcon /> </IconButton>
                </DialogTitle>
                <DialogContent dividers sx={{ minHeight: 460 }}> {mode === "graph" ? children : renderTable(true)} </DialogContent>
                <DialogActions sx={{ px: 2, py: 1 }}>
                    <Button variant="outlined" onClick={() => setDialogOpen(false)} startIcon={<CloseFullscreenIcon />}> Close </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}