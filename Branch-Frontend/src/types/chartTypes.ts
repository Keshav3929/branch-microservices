export type ChartEngine = "recharts" | "amcharts" | "apexcharts";

export type ChartDisplayMode = "graph" | "table";

export type ChartValueField = {
    field: string;
    name: string;
    color?: string | number;
};

export type TableBreakdownRow = {
    id?: string | number;
    category: string;
    count?: number;
    active?: number;
    inactive?: number;
    total?: number;
    percentage?: number | string;
    [key: string]: unknown;
};

export type DrilldownPayload = {
    source: "trends" | "organization" | "status" | "region" | "type" | "tile";
    title: string;
    field?: string;
    value?: string | number | boolean;
    label: string;
    count?: number;
    extraFilters?: Record<string, unknown>;
};