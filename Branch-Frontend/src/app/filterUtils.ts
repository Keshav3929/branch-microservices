import dayjs, { type Dayjs } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

export const DATE_FMT = "DD-MM-YYYY";

export const today = () => dayjs().startOf("day");

export const parseDate = (v: string): Dayjs | null => {
    const d = dayjs(v, DATE_FMT, true);
    return v && d.isValid() ? d.startOf("day") : null;
};

export const formatDate = (d: Dayjs) => d.format(DATE_FMT);

export const pickerErrors: Record<string, string> = {
    invalidDate: "Enter a valid date in DD-MM-YYYY format",
    maxDate: "Future dates are not allowed",
    minDate: "To date cannot be before From date",
};

export const dateKeyDown = (event: React.KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey ||
        ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "Enter"].includes(event.key)) return;
    if (!/^[0-9/-]$/.test(event.key)) event.preventDefault();
};

export const popperSx = {
    "& .MuiDateCalendar-root": { height: "auto", paddingBottom: 0 },
    "& .MuiPickersLayout-contentWrapper": { paddingBottom: 0 },
    "& .MuiPickersLayout-actionBar": { paddingTop: 0, paddingBottom: "2px", minHeight: "auto", marginTop: "-18px" }
};

export type DateKey = "createdDateFrom" | "createdDateTo";

export const createDatePicker = (
    field: DateKey,
    label: string,
    dates: Record<DateKey, Dayjs | null>,
    errors: Record<DateKey, string>,
    fromDate: Dayjs | null,
    setError: (field: DateKey, msg: string) => void,
    set: (patch: { createdDateFrom?: string; createdDateTo?: string }) => void
) => {
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

    return (
        {
            label,
            value: dates[field],
            format: DATE_FMT,
            views: ["year", "month", "day"] as const,
            openTo: "day" as const,
            maxDate: today(),
            minDate: field === "createdDateTo" ? fromDate ?? undefined : undefined,
            onChange: (date: Dayjs | null) => updateDate(field, date),
            onError: (reason: string) => {
                if (!reason) setError(field, "");
                else if (pickerErrors[reason]) setError(field, pickerErrors[reason]);
            },
            slotProps: {
                actionBar: { actions: ["today"], sx: { m: 0, p: 0.5 } },
                popper: { sx: popperSx },
                textField: { size: "small", fullWidth: true, error: !!errors[field], helperText: errors[field], onKeyDown: dateKeyDown },
                day: (ownerState: { day: Dayjs }) => ({ sx: { opacity: ownerState.day.isAfter(today(), "day") ? 0.4 : 1 } })
            }
        }
    );
};

export const DASHBOARD_QUICK_RANGES = [
    ["today", "Today"],
    ["7days", "7 Days"],
    ["30days", "30 Days"],
    ["thisMonth", "This Month"],
    ["thisYear", "This Year"],
    ["all", "All Time"]
] as const;

export const getQuickRangeDates = (range: typeof DASHBOARD_QUICK_RANGES[number][0], now = dayjs()) => {
    let from = "";
    let to = formatDate(now);
    if (range === "today") from = formatDate(now);
    else if (range === "7days") from = formatDate(now.subtract(7, "day"));
    else if (range === "30days") from = formatDate(now.subtract(30, "day"));
    else if (range === "thisMonth") from = formatDate(now.startOf("month"));
    else if (range === "thisYear") from = formatDate(now.startOf("year"));
    else if (range === "all") { from = ""; to = ""; }
    return { from, to };
};

interface Option { id: number | string; name: string; }

export const optId = (o: Option | string) => String(typeof o === "string" ? o : o.id);

export const toIds = (val: unknown): (string | number)[] =>
    (Array.isArray(val) ? val : [val]).filter(v => v != null && v !== "")
        .map(v => typeof v === "object" ? (v as Option).id : v as string | number);

export const buildSelectOptions = (optionsData: {
    organizations: { id: number; name: string }[];
    branchTypes: string[];
    regions: { id: number; name: string }[];
    countries: { id: number; name: string }[];
    states: { id: number; name: string }[];
    cities: { id: number; name: string }[];
    contactPersons: { id: number; name: string }[];
    workingHours: { id: number; name: string }[];
}) => [
    { key: "organizationId" as const, label: "Organization", options: optionsData.organizations },
    { key: "regionId" as const, label: "Region", options: optionsData.regions },
    { key: "countryId" as const, label: "Country", options: optionsData.countries },
    { key: "branchType" as const, label: "Branch Type", options: optionsData.branchTypes },
    { key: "status" as const, label: "Status", options: ["Active", "Inactive"] as string[] }
];

export const stringKeys = ["organizationId", "regionId", "countryId", "branchType", "status"] as const;