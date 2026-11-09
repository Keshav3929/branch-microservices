import { isAxiosError } from "axios";
import type { BranchFilters, FilterChip } from "./pages/branch-filter";
import type { DropdownOptions } from "./branchApi";

export const NA = "N/A";

export const parseIdList = (v: unknown): string[] =>
    String(v ?? "").replace(/[[\]"\\]/g, "").split(",").map(s => s.trim()).filter(Boolean);
const toJsonList = (v: unknown) => { const list = parseIdList(v); return list.length ? JSON.stringify(list) : null; };


export const splitCsv = (s: string | null | undefined): string[] => (s ? s.split(",").filter(Boolean) : []);
export const joinCsv = (v: unknown) => (Array.isArray(v) ? v : v == null ? [] : [v]).map(String).join(",");
export const orUndef = <T,>(a: T[]) => (a.length ? a : undefined);

export const pickId = (v: unknown): number | null =>
    v && typeof v === "object" && !Array.isArray(v) && "id" in v ? Number(v.id) : null;

export const nameOf = (options: { id: number | string; name: string }[], id: number | string | null | undefined): string =>
    id == null ? NA : options.find(o => String(o.id) === String(id))?.name ?? String(id);

// reads plain-text bodies (e.g. 409 "Branch name already exists...") and JSON bodies
export const getErrorMessage = (err: unknown, fallback: string): string => {
    if (!isAxiosError(err)) return fallback;
    const d = err.response?.data;
    return (typeof d === "string" && d.trim()) || d?.message || d?.error || d?.detail || fallback;
};

export const parseApiError = (err: unknown) => {
    const d = isAxiosError(err) ? err.response?.data : undefined;
    return {
        message: typeof d === "string" ? d : d?.message as string | undefined,
        fields: (d?.errors ?? {}) as Record<string, string>,
        invalidRows: d?.invalidRows as { row: number; errors: string[] }[] | undefined
    };
};

export const toPayload = <T extends Record<string, unknown>>(f: T) => ({
    ...f,
    ...Object.fromEntries(["workingHoursId", "contactPerson", "latitude", "longitude"]
        .map(k => [k, f[k] === "" || f[k] == null ? null : Number(f[k])])),
    mobile: f.mobile || null,
    departmentIds: toJsonList(f.departmentIds),
    serviceIds: toJsonList(f.serviceIds)
})

export interface OptionItem {
    id: number | string;
    name: string;
}

export interface OptionsData {
    organizations: OptionItem[];
    branchTypes: string[];
    regions: OptionItem[];
    countries: OptionItem[];
    states: OptionItem[];
    cities: OptionItem[];
    contactPersons: OptionItem[];
    workingHours: OptionItem[];
}

export const initialForm = {
    branchCode: "", branchName: "", communicationName: "", branchType: "",
    organizationId: null as number | null, regionId: null as number | null,
    countryId: null as number | null, stateId: null as number | null,
    cityId: null as number | null, area: "", zipCode: "", address1: "",
    address2: "", latitude: "", longitude: "", contactPerson: "",
    mobile: "", telephone: "", email: "", workingDays: "",
    workingHoursId: "", departmentIds: "", serviceIds: "",
    status: true, branchLogo: "", documentPath: "", remarks: ""
};

export const gridStyle = {
    display: "grid",
    gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
    gap: 2
};


export function getFilterChips(filters: BranchFilters, options: DropdownOptions): FilterChip[] {
    const chips: FilterChip[] = [];
    if (filters.createdDateFrom) {
        chips.push({ key: "createdDateFrom", value: filters.createdDateFrom, label: `Created From: ${filters.createdDateFrom}` });
    }
    if (filters.createdDateTo) {
        chips.push({ key: "createdDateTo", value: filters.createdDateTo, label: `Created To: ${filters.createdDateTo}` });
    }

    const configs: { key: keyof BranchFilters; label: string; list: (OptionItem | string)[] }[] = [
        { key: "organizationId", label: "Organization", list: options.organizations },
        { key: "regionId", label: "Region", list: options.regions },
        { key: "branchType", label: "Branch Type", list: options.branchTypes },
        { key: "status", label: "Status", list: ["Active", "Inactive"] },
        { key: "countryId", label: "Country", list: options.countries }
    ];

    configs.forEach(({ key, label, list }) => {
        const valArr = (filters[key] as (string | number)[]) ?? [];
        valArr.forEach(val => {
            const match = list.find(item => {
                if (typeof item === "string") return item.toLowerCase() === String(val).toLowerCase();
                return String(item.id) === String(val);
            });
            const display = match ? (typeof match === "string" ? match : match.name) : val;
            chips.push({ key, value: val, label: `${label}: ${display}` });
        });
    });

    return chips;
}
