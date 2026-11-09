import { useMemo, useState } from "react";
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Box, Typography, Chip, Stack, IconButton
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import type { MRT_ColumnDef, MRT_Row } from "material-react-table";
import { utils, writeFile, WorkBook } from "xlsx-js-style";
import DataTable from "./Table";
import BranchHistoryDialog from "../app/pages/branch-history";
import type { Branch } from "../types/BranchSchema";
import type { DropdownOptions, UserOption } from "../app/branchApi";
import { getUserName } from "../app/branchApi";

export type BranchDrilldownDialogProps = {
    open: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    branches: Branch[];
    optionsData: DropdownOptions;
    users: UserOption[];
    loading?: boolean;
};

const headProps = { sx: { backgroundColor: "#17324d", color: "#fff", textAlign: "center", "& .Mui-TableHeadCell-Content": { justifyContent: "center" }, "& .MuiTableSortLabel-root, & .MuiTableSortLabel-icon": { color: "#fff !important" } } };
const bodyProps = { sx: { textAlign: "center", whiteSpace: "normal", wordBreak: "break-word" }};

const StatusPill = ({ active }: { active: boolean }) => (
    <span className={`status-pill ${active ? "active" : "inactive"}`}>
        {active ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : <CancelIcon sx={{ fontSize: 16 }} />}
        {active ? "Active" : "Inactive"}
    </span>
);

export default function BranchDrilldownDialog({
    open,
    onClose,
    title,
    subtitle,
    branches,
    optionsData,
    users,
    loading = false
}: BranchDrilldownDialogProps) {
    const [viewBranch, setViewBranch] = useState<Branch | null>(null);

    const columns: MRT_ColumnDef<Branch>[] = useMemo(() => [
        {
            accessorKey: "branchCode", header: "Branch Code",
            size: 110,
            enableSorting: true,
            Cell: ({ row }: { row: MRT_Row<Branch> }) => (
                <Button variant="text" size="small" onClick={() => setViewBranch(row.original)} sx={{ textTransform: "none", fontWeight: 700, minWidth: 0, p: 0, color: "primary.main", "&:hover": { textDecoration: "underline", bgcolor: "transparent" } }} > {row.original.branchCode} </Button>
            )
        },
        { accessorKey: "branchName", header: "Branch Name", size: 180, enableSorting: true },
        {
            id: "organizationId",
            header: "Organization",
            size: 140,
            accessorFn: (row: Branch) =>
                optionsData.organizations.find(x => Number(x.id) === Number(row.organizationId))?.name ?? "-"
        },
        { accessorKey: "branchType", header: "Branch Type", size: 120, enableSorting: true },
        {
            id: "regionId",
            header: "Region",
            size: 110,
            accessorFn: (row: Branch) =>
                optionsData.regions.find(x => Number(x.id) === Number(row.regionId))?.name ?? "-"
        },
        {
            id: "cityId",
            header: "City",
            size: 130,
            accessorFn: (row: Branch) =>
                optionsData.cities.find(x => Number(x.id) === Number(row.cityId))?.name ?? "-"
        },
        { accessorKey: "mobile", header: "Mobile", size: 130 },
        { accessorKey: "email", header: "Email", size: 200 },
        {
            accessorKey: "status",
            header: "Status",
            size: 120,
            Cell: ({ row }: { row: MRT_Row<Branch> }) => <StatusPill active={!!row.original.status} />
        },
        {
            id: "createdBy",
            header: "Created By",
            size: 120,
            accessorFn: (row: Branch) => getUserName(row.createdBy, users)
        },
        { accessorKey: "createdAt", header: "Created At", size: 170, enableSorting: true }
    ].map(column => ({
        ...column,
        enableSorting: column.enableSorting ?? false,
        muiTableHeadCellProps: headProps,
        muiTableBodyCellProps: bodyProps
    })), [optionsData, users]);

    // Download filtered branches
    const handleDownloadExcel = () => {
        if (!branches.length) return;
        const rows = branches.map(b => {
            const org = optionsData.organizations.find(x => Number(x.id) === Number(b.organizationId))?.name ?? "";
            const reg = optionsData.regions.find(x => Number(x.id) === Number(b.regionId))?.name ?? "";
            const city = optionsData.cities.find(x => Number(x.id) === Number(b.cityId))?.name ?? "";
            return {
                "Branch Code": b.branchCode ?? "",
                "Branch Name": b.branchName ?? "",
                "Organization": org,
                "Branch Type": b.branchType ?? "",
                "Region": reg,
                "City": city,
                "Mobile": b.mobile ?? "",
                "Email": b.email ?? "",
                "Status": b.status ? "Active" : "Inactive",
                "Created At": b.createdAt ?? ""
            };
        });
        const workbook: WorkBook = utils.book_new();
        const sheet = utils.json_to_sheet(rows);
        utils.book_append_sheet(workbook, sheet, "Filtered Branches");
        writeFile(workbook, `branches-drilldown.xlsx`);
    };

    return (
        <>
            <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth PaperProps={{ sx: { borderRadius: 3, maxHeight: "90vh", display: "flex", flexDirection: "column" } }} >
                <DialogTitle sx={{ p: 2, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e2e8f0", bgcolor: "#f8fafc" }} >
                    <Box>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <Typography variant="h6" fontWeight={800} color="#0f172a"> {title} </Typography>
                            <Chip label={`${branches.length} ${branches.length === 1 ? "Record" : "Records"}`} size="small" color="primary" sx={{ fontWeight: 700, borderRadius: 1.5 }} />
                        </Stack>
                        {subtitle && (
                            <Typography variant="body2" color="text.secondary"> {subtitle} </Typography>
                        )}
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Button variant="outlined" size="small" startIcon={<FileDownloadIcon />} onClick={handleDownloadExcel} disabled={!branches.length} sx={{ textTransform: "none", fontWeight: 600 }} > Export </Button>
                        <IconButton onClick={onClose} size="small"> <CloseIcon /> </IconButton>
                    </Stack>
                </DialogTitle>

                <DialogContent sx={{ p: 1.5, flex: 1, overflow: "auto" }}>
                    <DataTable data={branches} columns={columns} loading={loading} maxHeight={520} emptyMessage="No branch records found for this selection." />
                </DialogContent>
                <DialogActions sx={{ px: 2, py: 1.5, borderTop: "1px solid #e2e8f0" }}>
                    <Button variant="contained" onClick={onClose} sx={{ bgcolor: "#17324d", "&:hover": { bgcolor: "#0f2032" } }}> Close </Button>
                </DialogActions>
            </Dialog>

            {/* Nested Branch History Dialog */}
            {viewBranch && (
                <BranchHistoryDialog branch={viewBranch} onClose={() => setViewBranch(null)} optionsData={optionsData} users={users} />
            )}
        </>
    );
}