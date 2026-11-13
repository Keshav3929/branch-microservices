import { useEffect, useMemo, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import type { MRT_ColumnDef } from "material-react-table";
import DataTable from "../../components/Table";
import { showError } from "../../components/SweetAlert";
import type { Branch } from "../../types/BranchSchema";
import { viewCols, NA, nameOf, parseIdList } from "../branchUtils";
import { getBranchHistory, getUserName } from "../branchApi";
import type { UserOption } from "../branchApi";
import type { OptionsData as SharedOptionsData } from "../branchUtils";

export type BranchHistory = Partial<Branch> & {
    historyId: number;
    branchId: number;
    action: string;
    updatedBy: number | null;
    updatedAt: string | null;
};

type OptionsData = Pick<SharedOptionsData, | "organizations" | "regions" | "countries" | "states" | "cities" | "contactPersons" | "workingHours">;
type Props = {
    branch: Branch | null;
    onClose: () => void;
    optionsData: OptionsData;
    users: UserOption[];
};

const lookup = {
    organizationId: "organizations", regionId: "regions", countryId: "countries", stateId: "states",
    cityId: "cities", contactPerson: "contactPersons", workingHoursId: "workingHours"
} as const;

const actionLabels: Record<string, string> = { CREATE: "Created", UPDATE: "Updated", DELETE: "Deleted" };
const cellProps = { sx: { whiteSpace: "normal", wordBreak: "break-word" } };
const field = (row: object, key: string) => (row as Record<string, unknown>)[key];
const isEmpty = (v: unknown) => v == null || (typeof v === "string" && (!v.trim() || v.trim() === NA));
const formatValue = (
    key: string,
    row: object,
    options: OptionsData,
    users: UserOption[]
): string => {
    const value = field(row, key);

    if (key === "createdBy" || key === "updatedBy") {
        return getUserName(value as number | null, users);
    }
    if (key in lookup) {
        return nameOf(options[lookup[key as keyof typeof lookup]], value as number | null);
    }
    if (value == null || value === "") return NA;
    if (key === "status") return value ? "Active" : "Inactive";
    if (key === "departmentIds" || key === "serviceIds") {
        return parseIdList(value).join(", ") || NA;
    }
    return Array.isArray(value) ? value.join(", ") : String(value);
};

const StatusPill = ({ active }: { active: boolean }) => (
    <span className={`status-pill ${active ? "active" : "inactive"}`}>
        {active ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : <CancelIcon sx={{ fontSize: 16 }} />}
        {active ? "Active" : "Inactive"}
    </span>
);

export default function BranchHistoryDialog({
    branch,
    onClose,
    optionsData,
    users
}: Props) {
    const [history, setHistory] = useState<BranchHistory[]>([]);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        if (!branch) return;

        let cancelled = false;
        const currentBranch = branch;

        const timer = window.setTimeout(() => {
            setLoading(true);
            getBranchHistory(currentBranch.id)
                .then(({ data }) => {
                    if (cancelled) return;

                    const records: BranchHistory[] = data?.length ? data : [{ historyId: 0, branchId: currentBranch.id, action: "CREATE" } as BranchHistory];
                    setHistory(records.map(record => ({
                        ...currentBranch, ...Object.fromEntries(Object.entries(record).filter(([, v]) => v != null)),
                        historyId: record.historyId, branchId: record.branchId, action: record.action || "CREATE",
                        updatedBy: record.updatedBy ?? record.createdBy ?? currentBranch.updatedBy ?? currentBranch.createdBy ?? null,
                        updatedAt: record.updatedAt ?? record.createdAt ?? currentBranch.updatedAt ?? currentBranch.createdAt ?? null
                    })));
                })
                .catch(() => { if (!cancelled) { void showError("Error!", "Failed to load branch history."); } })
                .finally(() => { if (!cancelled) setLoading(false); });
        }, 0);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [branch]);

    const columns = useMemo<MRT_ColumnDef<BranchHistory>[]>(() => [
        {
            id: "updatedAt",
            header: "Updated On",
            accessorFn: h => h.updatedAt ?? NA,
            enableSorting: false
        },
        {
            id: "updatedBy",
            header: "Updated By",
            accessorFn: h => getUserName(h.updatedBy, users),
            enableSorting: false
        },
        {
            id: "action",
            header: "Action",
            enableSorting: false,
            accessorFn: h => actionLabels[h.action?.toUpperCase()] ?? h.action ?? NA
        },
        ...viewCols
            .filter(([, key]) => key !== "updatedAt" && key !== "updatedBy")
            .map(([header, key]) => ({
                id: key,
                header,
                enableSorting: false,
                muiTableBodyCellProps: cellProps,
                accessorFn: (h: BranchHistory) =>
                    formatValue(key, h, optionsData, users),
                Cell: ({ row }: {
                    row: { original: BranchHistory; index: number }
                }) => {
                    const h = row.original;
                    const currentIndex = history.findIndex(item => item.historyId === h.historyId);
                    const older = history[currentIndex + 1];
                    const current = field(h, key);
                    const changed =
                        !!older &&
                        !isEmpty(current) &&
                        !isEmpty(field(older, key)) &&
                        JSON.stringify(current) !==
                        JSON.stringify(field(older, key));
                    return (
                        <Box sx={{ bgcolor: changed ? "#fff3cd" : "transparent", borderRadius: 1, px: changed ? 1 : 0, py: 0.5, minHeight: 24, whiteSpace: "normal", overflowWrap: "anywhere" }} >
                            {key === "status" && current != null ? <StatusPill active={!!current} /> : formatValue(key, h, optionsData, users)}
                        </Box>
                    );
                }
            }))
    ], [history, optionsData, users]);
    return (
        <Dialog open={!!branch} onClose={onClose} maxWidth="xl" fullWidth>
            <DialogTitle sx={{ bgcolor: "#0f172a", color: "#fff", fontWeight: 700, py: 2 }}>
                Branch History & Details
            </DialogTitle>
            <DialogContent sx={{ pt: 2, pb: 0 }}>
                {branch && (
                    <DataTable<BranchHistory>
                        data={history}
                        columns={columns}
                        getRowId={h => String(h.historyId)}
                        emptyMessage={loading ? "Loading branch history..." : "No history records available"}
                        enablePagination
                        maxHeight={550}
                    />
                )}
            </DialogContent>
            <DialogActions sx={{ px: 1, pt: 0, pb: 1, minHeight: 0 }}>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}