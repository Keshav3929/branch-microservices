import { isAxiosError } from "axios";
import { utils, writeFile, type WorkBook } from "xlsx-js-style";
import type { BranchFilters, FilterChip } from "./pages/branch-filter";
import type { DropdownOptions, UserOption } from "./branchApi";
import { getUserName } from "./branchApi";
import type { Branch } from "../types/BranchSchema";

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

export const viewCols = [
    ["Branch Code", "branchCode"], ["Branch Name", "branchName"], ["Communication Name", "communicationName"], ["Organization", "organizationId"],
    ["Branch Type", "branchType"], ["Working Hours", "workingHoursId"], ["Region", "regionId"], ["Country", "countryId"], ["State", "stateId"],
    ["City", "cityId"], ["Area", "area"], ["Zip Code", "zipCode"], ["Latitude", "latitude"], ["Longitude", "longitude"],
    ["Address Line 1", "address1"], ["Address Line 2", "address2"], ["Contact Person", "contactPerson"], ["Mobile Number", "mobile"],
    ["Telephone", "telephone"], ["Email ID", "email"], ["Working Days", "workingDays"], ["Departments", "departmentIds"], ["Services", "serviceIds"],
    ["Status", "status"], ["Branch Logo", "branchLogo"], ["Supporting Documents", "documentPath"],
    ["Remarks", "remarks"], ["Created By", "createdBy"], ["Created On", "createdAt"], ["Updated By", "updatedBy"], ["Updated On", "updatedAt"]
] as const;

export const mandatoryHeaders = new Set([
    "Branch Code", "Branch Name", "Organization", "Branch Type",
    "Region", "Country", "State", "City", "Address Line 1", "Status"
]);

export type OptionFields = Record<string, { id: number | string; name: string }[] | undefined>;

export const getOptionFields = (options: DropdownOptions): OptionFields => ({
    organizationId: options.organizations,
    regionId: options.regions,
    countryId: options.countries,
    stateId: options.states,
    cityId: options.cities,
    contactPerson: options.contactPersons,
    workingHoursId: options.workingHours
});

export const excelValue = (key: string, value: unknown, optionFields: OptionFields, users?: UserOption[]) => {
    if (value == null || value === "") return "";
    const option = optionFields[key]?.find(item => Number(item.id) === Number(value));
    if (option) return option.name;
    if (key === "status") return value === true || String(value).toLowerCase() === "true" ? "Active" : "Inactive";
    if (key === "departmentIds" || key === "serviceIds") return parseIdList(value).join(", ");
    if ((key === "createdBy" || key === "updatedBy") && users?.length) {
        return getUserName(Number(value), users);
    }
    return String(value);
};

export const formatBranchWorkbook = (workbook: WorkBook) => {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error("Excel sheet not found");
    const headers = utils.sheet_to_json<string[]>(sheet, { header: 1 })[1] ?? utils.sheet_to_json<string[]>(sheet, { header: 1 })[0];
    if (!headers?.length) throw new Error("Template headers not found");
    headers.forEach((header, i) => {
        const mandatory = String(header).endsWith("*");
        const labelAddress = utils.encode_cell({ r: 0, c: i });
        const headerAddress = utils.encode_cell({ r: 1, c: i });
        sheet[labelAddress] ??= { t: "s", v: mandatory ? "Mandatory" : "Optional" };
        sheet[headerAddress] ??= { t: "s", v: String(header) };
        sheet[labelAddress].v = mandatory ? "Mandatory" : "Optional";
        sheet[labelAddress].s = {
            font: { bold: true, color: { rgb: mandatory ? "FFFF0000" : "FF008000" } },
            alignment: { horizontal: "center" }
        };
        sheet[headerAddress].s = {
            fill: { patternType: "solid", fgColor: { rgb: "FF0F172A" } },
            font: { bold: true, color: { rgb: "FFFFFFFF" } },
            alignment: { horizontal: "center", vertical: "center", wrapText: true }
        };
        sheet["!cols"] ??= [];
        sheet["!cols"][i] = { wch: 20 };
    });
    sheet["!ref"] = utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: Math.max(1, utils.decode_range(sheet["!ref"] ?? "A1").e.r), c: headers.length - 1 }
    });
    sheet["!rows"] = [{ hpt: 22 }, { hpt: 32 }];
    sheet["!freeze"] = { xSplit: 0, ySplit: 2 };
    return workbook;
};

export const downloadExcel = (rows: Record<string, unknown>[], headers: string[], filename: string, sheetName: string) => {
    const displayHeaders = headers.map(header => mandatoryHeaders.has(header) ? `${header}*` : header);
    const workbook = utils.book_new();
    const sheet = utils.aoa_to_sheet([
        displayHeaders.map(header => header.endsWith("*") ? "Mandatory" : "Optional"),
        displayHeaders,
        ...rows.map(row => displayHeaders.map(header => row[header.replace(/\*$/, "")] ?? row[header] ?? ""))
    ]);
    utils.book_append_sheet(workbook, sheet, sheetName);
    formatBranchWorkbook(workbook);
    writeFile(workbook, filename);
};

export const exportBranchExcel = (
    branches: Branch[],
    options: DropdownOptions,
    users: UserOption[] = [],
    filename = "branches.xlsx",
    sheetName = "Branches"
) => {
    const optionFields = getOptionFields(options);
    const rows = branches.map(branch =>
        Object.fromEntries(viewCols.map(([label, key]) => [label, excelValue(key, branch[key as keyof Branch], optionFields, users)]))
    );
    downloadExcel(rows, viewCols.map(([label]) => label), filename, sheetName);
};