import { useState } from "react";
import {
    Box, Button, Paper, Typography, Stack, Collapse, Chip
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import ResetIcon from "@mui/icons-material/RestartAlt";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import MultiSelectAutoComplete from "../../components/MultiSelectAutoComplete";
import type { BranchFilters } from "./branch-filter";
import type { DropdownOptions } from "../branchApi";
import { DATE_FMT, today, parseDate, formatDate, pickerErrors, popperSx, DateKey, toIds, getQuickRangeDates, dateKeyDown, DASHBOARD_QUICK_RANGES } from "../filterUtils";
import { Dayjs } from "dayjs";

const gridStyle = { display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 2};

export type DashboardFilterBarProps = {
    filters: BranchFilters;
    appliedFilters: BranchFilters;
    setFilters: React.Dispatch<React.SetStateAction<BranchFilters>>;
    onApply: (next?: BranchFilters) => void;
    onReset: () => void;
    optionsData: DropdownOptions;
};

export default function DashboardFilterBar({
    filters,
    setFilters,
    onApply,
    onReset,
    optionsData
}: DashboardFilterBarProps) {
    const [showMore, setShowMore] = useState(false);
    const [errors, setErrors] = useState<Record<DateKey, string>>({ createdDateFrom: "", createdDateTo: "" });
    const set = (patch: Partial<BranchFilters>) => setFilters(prev => ({ ...prev, ...patch }));
    const setError = (field: DateKey, msg: string) => setErrors(prev => ({ ...prev, [field]: msg }));
    const fromDate = parseDate(filters.createdDateFrom);
    const toDate = parseDate(filters.createdDateTo);
    const dates: Record<DateKey, Dayjs | null> = { createdDateFrom: fromDate, createdDateTo: toDate };
    const validateDate = (field: DateKey, date: Dayjs | null) => {
        if (!date) return "";
        if (!date.isValid()) return pickerErrors.invalidDate;
        if (date.isAfter(today(), "day")) return pickerErrors.maxDate;
        if (field === "createdDateFrom" && toDate && date.isAfter(toDate, "day"))
            return "From date cannot be after To date";
        if (field === "createdDateTo" && fromDate && date.isBefore(fromDate, "day"))
            return pickerErrors.minDate;
        return "";
    };
    const updateDate = (field: DateKey, date: Dayjs | null) => {
        const error = validateDate(field, date);
        if (error) return setError(field, error);
        set({ [field]: date ? formatDate(date.startOf("day")) : "" });
        setError(field, "");
    };
    const setQuickRange = (range: "today" | "7days" | "30days" | "thisMonth" | "thisYear" | "all") => {
        const { from, to } = getQuickRangeDates(range);
        const next = { ...filters, createdDateFrom: from, createdDateTo: to };
        setFilters(next);
        onApply(next);
    };
    const datePicker = (field: DateKey, label: string) => (
        <DatePicker label={label} value={dates[field]} format={DATE_FMT} views={["year", "month", "day"]} openTo="day" maxDate={today()} minDate={field === "createdDateTo" ? fromDate ?? undefined : undefined}
            onChange={date => updateDate(field, date)}
            onError={reason => {
                if (!reason) setError(field, "");
                else if (pickerErrors[reason]) setError(field, pickerErrors[reason]);
            }}
            slotProps={{ actionBar: { actions: ["today"], sx: { m: 0, p: 0.5 } }, popper: { sx: popperSx },
                textField: { size: "small", fullWidth: true, error: !!errors[field], helperText: errors[field], onKeyDown: dateKeyDown }
            }}
        />
    );

    return (
        <Box sx={{ mb: 2 }}>
            <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 3, border: "1px solid #e2e8f0", bgcolor: "#fff" }}>
                {/* Date Filters & Quick Range */}
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.2fr 2fr" }, gap: 2, alignItems: "center", mb: 2 }}>
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                            {datePicker("createdDateFrom", "From Date")}
                            {datePicker("createdDateTo", "To Date")}
                        </Box>
                    </LocalizationProvider>
                    <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", mr: 0.5 }}> Quick Range: </Typography>
                        {DASHBOARD_QUICK_RANGES.map(([rangeKey, label]) => (
                            <Chip key={rangeKey} label={label} size="small" clickable onClick={() => setQuickRange(rangeKey)} sx={{ fontSize: "0.75rem", fontWeight: 600, bgcolor: "#f1f5f9", color: "#334155", "&:hover": { bgcolor: "#e2e8f0" } }} />
                        ))}
                    </Stack>
                </Box>
                {/* Dropdowns Row: Organization, Region, Branch Type, Status */}
                <Box sx={{ ...gridStyle, mb: showMore ? 2 : 0 }}>
                    <MultiSelectAutoComplete label="Organization" multiple options={optionsData.organizations} value={optionsData.organizations.filter(o => (filters.organizationId as (string | number)[]).map(String).includes(String(o.id)))} onChange={val => set({ organizationId: toIds(val) })} />
                    <MultiSelectAutoComplete label="Region" multiple options={optionsData.regions} value={optionsData.regions.filter(o => (filters.regionId as (string | number)[]).map(String).includes(String(o.id)) )} onChange={val => set({ regionId: toIds(val) })} />
                    <MultiSelectAutoComplete label="Branch Type" multiple options={optionsData.branchTypes} value={optionsData.branchTypes.filter(t => (filters.branchType as string[]).includes(String(t)) )} onChange={val => set({ branchType: toIds(val).map(String) })} />
                    <MultiSelectAutoComplete label="Status" multiple options={["Active", "Inactive"]} value={["Active", "Inactive"].filter(s => (filters.status as string[]).includes(s) )} onChange={val => set({ status: toIds(val).map(String) })} />
                </Box>
                {/* Collapsible Country Filter */}
                <Collapse in={showMore}>
                    <Box sx={{ ...gridStyle, mt: 2 }}>
                        <MultiSelectAutoComplete label="Country" multiple options={optionsData.countries} value={optionsData.countries.filter(c => (filters.countryId as (string | number)[]).map(String).includes(String(c.id)) )} onChange={val => set({ countryId: toIds(val) })}/>
                    </Box>
                </Collapse>
                {/* Actions */}
                <Stack direction="row" spacing={1.5} justifyContent="flex-end" alignItems="center" sx={{ mt: 2, pt: 1.5, borderTop: "1px solid #f1f5f9" }}>
                    <Button variant="outlined" size="small" startIcon={<FilterListIcon />} onClick={() => setShowMore(prev => !prev)} sx={{ textTransform: "none", color: "text.primary", borderColor: "#cbd5e1" }}> {showMore ? "Less Filters" : "More Filters"} </Button>
                    <Button variant="outlined" color="warning" size="small" startIcon={<ResetIcon />} onClick={onReset} sx={{ textTransform: "none", fontWeight: 600 }}> Reset </Button>
                    <Button variant="contained" size="small" startIcon={<SearchIcon />} onClick={() => onApply(filters)} sx={{ bgcolor: "#17324d", fontWeight: 700, textTransform: "none", px: 3, "&:hover": { bgcolor: "#0f2032" } }}> Apply Filters </Button>
                </Stack>
            </Paper>
        </Box>
    );
}