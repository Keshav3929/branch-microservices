import { useState } from "react";
import { Box, Button, Paper, Card, CardContent, Typography, Stack, Tooltip, IconButton, Collapse } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import ResetIcon from "@mui/icons-material/RestartAlt";
import TuneIcon from "@mui/icons-material/Tune";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { Dayjs } from "dayjs";
import MultiSelectAutoComplete from "../../components/MultiSelectAutoComplete";
import { today, parseDate, formatDate, pickerErrors, dateKeyDown, popperSx, DateKey, buildSelectOptions, stringKeys, toIds, optId } from "../filterUtils";
import { getFilterChips } from "../branchUtils";

export interface BranchFilters {
    search: string; createdDateFrom: string; createdDateTo: string;
    branchType: string[]; organizationId: (string | number)[]; regionId: (string | number)[];
    countryId: (string | number)[]; status: string[];
}
interface Option { id: number; name: string; }
export interface FilterChip { key: keyof BranchFilters; value: string | number; label: string; }
interface SearchFormProps {
    filters: BranchFilters; appliedFilters: BranchFilters;
    setFilters: React.Dispatch<React.SetStateAction<BranchFilters>>;
    onApply: (nextFilters?: BranchFilters) => void; onReset: () => void;
    showMoreFilters: boolean; setShowMoreFilters: React.Dispatch<React.SetStateAction<boolean>>;
    optionsData: { organizations: Option[]; branchTypes: string[]; regions: Option[]; countries: Option[]; states: Option[]; cities: Option[]; contactPersons: Option[]; workingHours: Option[]; };
    renderChips?: (chips: FilterChip[]) => React.ReactNode; renderBelowFilters?: React.ReactNode;
}

const gridStyle = { display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2 };

export default function SearchForm({ filters, appliedFilters, setFilters, onApply, onReset, showMoreFilters, setShowMoreFilters, optionsData, renderChips, renderBelowFilters
}: SearchFormProps) {
    const [errors, setErrors] = useState<Record<DateKey, string>>({ createdDateFrom: "", createdDateTo: "" });
    const [draftSearch, setDraftSearch] = useState(filters.search);
    const set = (patch: Partial<BranchFilters>) => setFilters(prev => ({ ...prev, ...patch }));
    const setError = (field: DateKey, msg: string) => setErrors(prev => ({ ...prev, [field]: msg }));
    const fromDate = parseDate(filters.createdDateFrom);
    const toDate = parseDate(filters.createdDateTo);
    const dates: Record<DateKey, Dayjs | null> = { createdDateFrom: fromDate, createdDateTo: toDate };
    // Single submit handler for Enter and Search icon
    const onSearchSubmit = () => {
        const trimmed = draftSearch.trim();
        if (!trimmed) return; // Empty/whitespace → no API call
        onApply({ ...filters, search: trimmed });
    };
    const validateDate = (field: DateKey, date: Dayjs | null) => {
        if (!date) return "";
        if (!date.isValid()) return pickerErrors.invalidDate;
        if (date.isAfter(today(), "day")) return pickerErrors.maxDate;
        if (field === "createdDateFrom" && dates.createdDateTo && date.isAfter(dates.createdDateTo, "day"))
            return "From date cannot be after To date";
        if (field === "createdDateTo" && dates.createdDateFrom && date.isBefore(dates.createdDateFrom, "day"))
            return pickerErrors.minDate;
        return "";
    };
    const updateDate = (field: DateKey, date: Dayjs | null) => {
        const error = validateDate(field, date);
        if (error) return setError(field, error);
        set({ [field]: date ? formatDate(date.startOf("day")) : "" });
        setError(field, "");
    };
    const validateTypedDate = (field: DateKey, value: string) => {
        if ((value.match(/\//g) || []).length > 2)
            return setError(field, "A date cannot contain more than 2 slashes");
        setError(field, value ? validateDate(field, parseDate(value)) : "");
    };
    const datePicker = (field: DateKey, label: string) => (
        <DatePicker label={label} value={dates[field]} format="DD-MM-YYYY" views={["year", "month", "day"]} openTo="day" maxDate={today()} minDate={field === "createdDateTo" ? fromDate ?? undefined : undefined}
            onChange={date => updateDate(field, date)}
            onError={reason => {
                if (!reason) setError(field, "");
                else if (pickerErrors[reason]) setError(field, pickerErrors[reason]);
            }}
            slotProps={{
                actionBar: { actions: ["today"], sx: { m: 0, p: 0.5 } }, popper: { sx: popperSx },
                textField: { size: "small", fullWidth: true, error: !!errors[field], helperText: errors[field], onKeyDown: dateKeyDown, onBlur: event => validateTypedDate(field, event.currentTarget.querySelector("input")?.value ?? "") },
                day: ownerState => ({ sx: { opacity: ownerState.day.isAfter(today(), "day") ? 0.4 : 1 } })
            }}
        />
    );
    // Use shared chip generation from branchUtils
    const chips = getFilterChips(filters, optionsData);

    return (
        <Box sx={{ minWidth: 0 }}>
            <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2.5 }, mb: 1, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                    <Box sx={{ width: 42, height: 42, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "primary.main", color: "primary.contrastText" }}>
                        <TuneIcon />
                    </Box>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>Search Filters</Typography>
                        <Typography variant="body2" color="text.secondary"> Find branches by keyword, creation date, or other criteria.</Typography>
                    </Box>
                </Stack>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) minmax(0, 1fr)" }, gap: 2, alignItems: "stretch", minWidth: 0 }}>
                    <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "divider", minWidth: 0 }}>
                        <CardContent sx={{ p: { xs: 1.5, sm: 2.5 }, "&:last-child": { pb: 2.5 } }}>
                            <Box sx={{ mb: 2 }}>
                                <MultiSelectAutoComplete
                                    label="Search Branch Code / Name"
                                    placeholder="Type branch code or select branch name..."
                                    options={[]}
                                    value={draftSearch}
                                    disableSuggestions
                                    inputValue={draftSearch}
                                    onInputChange={text => setDraftSearch(text)}
                                    freeSolo
                                    disableClearable
                                    endAdornment={
                                        <Tooltip title="Search">
                                            <IconButton size="small" onClick={onSearchSubmit}>
                                                <SearchIcon sx={{ color: "#fff", bgcolor: "#0f172a", width: 32, height: 32, borderRadius: "50%", p: 0.75 }} />
                                            </IconButton>
                                        </Tooltip>
                                    }
                                    onChange={val => {
                                        const text = val == null ? "" : Array.isArray(val) ? "" : typeof val === "object" ? (val as { name?: string }).name ?? "" : String(val);
                                        setDraftSearch(text);
                                    }}
                                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); onSearchSubmit(); (e.target as HTMLElement).blur(); } }}
                                />
                            </Box>
                            <Box sx={{ ...gridStyle, mb: 2.5 }}>
                                <LocalizationProvider dateAdapter={AdapterDayjs}>
                                    {datePicker("createdDateFrom", "Created Date From")}
                                    {datePicker("createdDateTo", "Created Date To")}
                                </LocalizationProvider>
                            </Box>
                            <Collapse in={showMoreFilters}>
                                <Box sx={{ ...gridStyle, mb: 2.5 }}>
                                    {buildSelectOptions(optionsData).map(({ key, label, options }) => {
                                        const selected = (filters[key] as (string | number)[]).map(String);
                                        return (
                                            <MultiSelectAutoComplete key={key} label={label} multiple options={options}
                                                value={options.filter(o => selected.includes(optId(o)))}
                                                onChange={val => {
                                                    const ids = toIds(val);
                                                    set({ [key]: stringKeys.includes(key) ? ids.map(String) : ids } as Partial<BranchFilters>);
                                                }}
                                            />
                                        );
                                    })}
                                </Box>
                            </Collapse>
                        </CardContent>
                    </Card>
                    <Box sx={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                        {renderBelowFilters}
                    </Box>
                </Box>
            </Paper>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.5fr) minmax(0, 1fr)" }, gap: 2, mt: 1, mb: 2 }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}
                    justifyContent="center" alignItems={{ xs: "stretch", sm: "center" }}>
                    <Button variant="contained" startIcon={<SearchIcon />} onClick={() => onApply({ ...filters, search: appliedFilters.search })} sx={{ bgcolor: "#17324d", "&:hover": { bgcolor: "#0f2032" } }}> Apply Filters </Button>
                    <Button variant="contained" startIcon={<FilterListIcon />} onClick={() => setShowMoreFilters(prev => !prev)}> {showMoreFilters ? "Less Filters" : "More Filters"} </Button>
                    <Button variant="contained" color="warning" startIcon={<ResetIcon />} onClick={onReset}> Reset </Button>
                </Stack>
            </Box>
            {renderChips?.(chips)}
        </Box>
    );
}