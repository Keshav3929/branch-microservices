import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
    Box, Button, Typography, ToggleButton, ToggleButtonGroup,
    FormControl, InputLabel, Select, MenuItem, useTheme
} from "@mui/material";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip as RechartsTooltip, Legend as RechartsLegend
} from "recharts";
import Chart from "react-apexcharts";
import type { ChartEngine, ChartValueField } from "../types/chartTypes";

type ChartRow = Record<string, unknown>;

export type ColumnChartProps = {
    title: string;
    subtitle?: string;
    data: object[];
    categoryField: string;
    valueFields: ChartValueField[];
    stacked?: boolean;
    drillDown?: boolean;
    height?: number;
    engine?: ChartEngine;
    onBarClick?: (category: string, field?: string, value?: number) => void;
};

type TrendLevel = "year" | "month" | "day";

const toHexColor = (c: string | number | undefined, defaultColor = "#1976d2"): string => {
    if (!c) return defaultColor;
    if (typeof c === "string") return c.startsWith("#") ? c : `#${c}`;
    return `#${c.toString(16).padStart(6, "0")}`;
};

export default function ColumnChart({
    title,
    data,
    categoryField,
    valueFields,
    stacked = false,
    drillDown = false,
    height = 320,
    engine = "amcharts",
    onBarClick
}: ColumnChartProps) {
    const theme = useTheme();
    const am5Ref = useRef<HTMLDivElement>(null);
    const [level, setLevel] = useState<TrendLevel>("year");
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);

    const availableYears = useMemo(() => {
        const years = new Set<number>();
        (data as ChartRow[]).forEach(item => {
            const date = String(item[categoryField] ?? "");
            if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                years.add(Number(date.slice(0, 4)));
            }
        });
        return Array.from(years).sort((a, b) => b - a);
    }, [data, categoryField]);

    const selectedYear = availableYears.includes(year) ? year : availableYears[0] ?? year;
    const rows = useMemo<ChartRow[]>(() => { const source = data as ChartRow[];
        if (!drillDown) {
            return source.map(item => ({ ...item, category: String(item[categoryField] ?? "") }));
        }
        const grouped = new Map<string, number>();
        const prefix = `${selectedYear}-${String(month).padStart(2, "0")}`;
        const countField = valueFields[0]?.field ?? "count";
        source.forEach(item => {
            const date = String(item[categoryField] ?? "");
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
            let key: string;

            if (level === "year") {
                key = date.slice(0, 4);
            } else if (level === "month") {
                if (!date.startsWith(`${selectedYear}-`)) return;
                key = date.slice(0, 7);
            } else {
                if (!date.startsWith(`${prefix}-`)) return;
                key = date.slice(8, 10);
            }
            const count = Number(item[countField] ?? 0);
            grouped.set(key, (grouped.get(key) ?? 0) + count);
        });
        return Array.from(grouped, ([category, count]) => ({
            category, [countField]: count
        })).sort((a, b) => a.category.localeCompare(b.category));
    }, [data, categoryField, valueFields, drillDown, level, selectedYear, month]);

    const chartTitle = !drillDown ? title : level === "year" ? title : level === "month" ? `Branch Creations in ${selectedYear}` : `Daily Creations — ${selectedYear}-${String(month).padStart(2, "0")}`;
    const handleCategoryDrilldown = useCallback((category: string) => {
        if (!drillDown) return;
        if (level === "year") {
            setYear(Number(category));
            setLevel("month");
        } else if (level === "month") {
            const [selectedYr, selectedMo] = category.split("-").map(Number);
            setYear(selectedYr);
            setMonth(selectedMo);
            setLevel("day");
        }
    }, [drillDown, level]);
    // ----------------- AmCharts 5 Build -----------------
    const buildAmCharts = useCallback(() => {
        if (!am5Ref.current || !rows.length || engine !== "amcharts") return;

        const root = am5.Root.new(am5Ref.current);
        root.setThemes([am5themes_Animated.new(root)]);

        const chart = root.container.children.push( am5xy.XYChart.new(root, { panX: false, panY: false }) );
        const xRenderer = am5xy.AxisRendererX.new(root, { minGridDistance: 30 });
        xRenderer.labels.template.setAll({ rotation: -35, centerY: am5.p50, centerX: am5.p100, paddingRight: 10, fontSize: 12 });
        const xAxis = chart.xAxes.push( am5xy.CategoryAxis.new(root, { categoryField: "category", renderer: xRenderer }) );
        const yAxis = chart.yAxes.push( am5xy.ValueAxis.new(root, { min: 0, renderer: am5xy.AxisRendererY.new(root, {}) }) );

        valueFields.forEach(field => {
            const fieldHex = toHexColor(field.color, "#1976d2");
            const series = chart.series.push(
                am5xy.ColumnSeries.new(root, { name: field.name, xAxis, yAxis, categoryXField: "category", valueYField: field.field, stacked, tooltip: am5.Tooltip.new(root, { labelText: "{name} - {categoryX}: {valueY}" }), fill: am5.color(fieldHex), stroke: am5.color(fieldHex) })
            );
            series.columns.template.setAll({ tooltipText: "{name} - {categoryX}: {valueY}", cornerRadiusTL: 4, cornerRadiusTR: 4, cursorOverStyle: (drillDown || onBarClick) ? "pointer" : "default" });
            series.columns.template.events.on("click", event => {
                const row = event.target.dataItem?.dataContext as ChartRow | undefined;
                if (!row) return;
                const cat = String(row.category ?? "");
                const val = Number(row[field.field] ?? 0);
                if (drillDown && level !== "day") {
                    handleCategoryDrilldown(cat);
                } else if (onBarClick) {
                    onBarClick(cat, field.field, val);
                }
            });
            series.data.setAll(rows);
            series.appear(600);
        });

        xAxis.data.setAll(rows);

        if (valueFields.length > 1) {
            const legend = chart.children.push(
                am5.Legend.new(root, { centerX: am5.p50, x: am5.p50 })
            );
            legend.data.setAll(chart.series.values);
        }
        return root;
    }, [rows, valueFields, stacked, drillDown, level, engine, onBarClick, handleCategoryDrilldown]);

    useLayoutEffect(() => {
        if (engine !== "amcharts") return;
        const root = buildAmCharts();
        return () => root?.dispose();
    }, [buildAmCharts, engine]);

    const goBack = () => {
        if (level === "day") {
            setLevel("month");
        } else if (level === "month") {
            setLevel("year");
        }
    };
    // ----------------- ApexCharts Options -----------------
    const apexSeries = useMemo(() => {
        return valueFields.map(vf => ({
            name: vf.name,
            data: rows.map(r => Number(r[vf.field] ?? 0))
        }));
    }, [valueFields, rows]);

    const apexOptions = useMemo<ApexCharts.ApexOptions>(() => {
        return {
            chart: { type: "bar", stacked, toolbar: { show: false }, animations: { enabled: true, speed: 600 }, fontFamily: theme.typography.fontFamily,
                events: {
                    dataPointSelection: (_, __, config) => {
                        if (!config) return;
                        const index = config.dataPointIndex;
                        const row = rows[index];
                        if (!row) return;
                        const cat = String(row.category ?? "");
                        const sIndex = config.seriesIndex ?? 0;
                        const f = valueFields[sIndex];
                        const val = Number(row[f?.field ?? "count"] ?? 0);
                        if (drillDown && level !== "day") {
                            handleCategoryDrilldown(cat);
                        } else if (onBarClick) {
                            onBarClick(cat, f?.field, val);
                        }
                    }
                }
            },
            plotOptions: { bar: { horizontal: false, columnWidth: "55%", borderRadius: 4 } },
            colors: valueFields.map((f, i) => toHexColor(f.color, ["#1976d2", "#2e7d32", "#d32f2f", "#f9a825"][i % 4]) ),
            xaxis: { categories: rows.map(r => String(r.category)), labels: { rotate: -35, style: { fontSize: "11px", colors: "#64748b" } } },
            yaxis: { labels: { style: { fontSize: "11px", colors: "#64748b" }, formatter: val => Math.round(val).toString() } },
            grid: { borderColor: "#f1f5f9", strokeDashArray: 3 },
            tooltip: { shared: true, intersect: false, theme: "light" },
            legend: { show: valueFields.length > 1, position: "top", horizontalAlign: "center" }
        };
    }, [stacked, theme.typography.fontFamily, rows, valueFields, drillDown, level, handleCategoryDrilldown, onBarClick]);

    return (
        <Box sx={{ width: "100%" }}>
            {drillDown && (
                <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 1.5 }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1, color: "text.secondary" }}> {chartTitle} </Typography>
                    <ToggleButtonGroup size="small" exclusive value={level} onChange={(_, nextLevel: TrendLevel | null) => { if (nextLevel) setLevel(nextLevel); }} >
                        <ToggleButton value="year" sx={{ px: 1.5, py: 0.25, fontSize: "0.75rem" }}>Yearly</ToggleButton>
                        <ToggleButton value="month" sx={{ px: 1.5, py: 0.25, fontSize: "0.75rem" }}>Monthly</ToggleButton>
                        <ToggleButton value="day" sx={{ px: 1.5, py: 0.25, fontSize: "0.75rem" }}>Daily</ToggleButton>
                    </ToggleButtonGroup>
                    {level !== "year" && (
                        <FormControl size="small" sx={{ minWidth: 90 }}>
                            <InputLabel sx={{ fontSize: "0.8rem" }}>Year</InputLabel>
                            <Select value={selectedYear} label="Year" sx={{ fontSize: "0.8rem" }} onChange={event => setYear(Number(event.target.value))} >
                                {availableYears.map(item => ( <MenuItem key={item} value={item} sx={{ fontSize: "0.8rem" }}>{item}</MenuItem> ))}
                            </Select>
                        </FormControl>
                    )}
                    {level === "day" && (
                        <FormControl size="small" sx={{ minWidth: 110 }}>
                            <InputLabel sx={{ fontSize: "0.8rem" }}>Month</InputLabel>
                            <Select value={month} label="Month" sx={{ fontSize: "0.8rem" }} onChange={event => setMonth(Number(event.target.value))} >
                                {Array.from({ length: 12 }, (_, index) => index + 1).map(item => (
                                    <MenuItem key={item} value={item} sx={{ fontSize: "0.8rem" }}> {new Date(2000, item - 1).toLocaleString("en", { month: "short" })} </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}
                    {level !== "year" && (
                        <Button size="small" variant="outlined" onClick={goBack} sx={{ textTransform: "none", py: 0.25, fontSize: "0.75rem" }}> Back </Button>
                    )}
                </Box>
            )}
            {!rows.length ? (
                <Typography color="text.secondary" textAlign="center" py={5}> No chart data available. </Typography>
            ) : engine === "amcharts" ? (
                <div ref={am5Ref} style={{ width: "100%", height }} />
            ) : engine === "recharts" ? (
                <ResponsiveContainer width="100%" height={height}>
                    <BarChart data={rows} margin={{ top: 15, right: 20, left: -10, bottom: 35 }} >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="category" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 11, fill: "#64748b" }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                        <RechartsTooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: "12px" }} />
                        {valueFields.length > 1 && <RechartsLegend wrapperStyle={{ paddingTop: 8 }} />}
                        {valueFields.map((field, idx) => {
                            const barColor = toHexColor(field.color, ["#1976d2", "#2e7d32", "#d32f2f", "#f9a825"][idx % 4]);
                            return (
                                <Bar key={field.field} dataKey={field.field} name={field.name} fill={barColor} stackId={stacked ? "stack" : undefined} radius={stacked ? [0, 0, 0, 0] : [4, 4, 0, 0]} cursor={(drillDown || onBarClick) ? "pointer" : "default"}
                                    onClick={(entry: unknown) => {
                                        const row = entry as ChartRow | undefined;
                                        if (!row) return;
                                        const cat = String(row.category ?? "");
                                        const val = Number(row[field.field] ?? 0);
                                        if (drillDown && level !== "day") {
                                            handleCategoryDrilldown(cat);
                                        } else if (onBarClick) {
                                            onBarClick(cat, field.field, val);
                                        }
                                    }}
                                />
                            );
                        })}
                    </BarChart>
                </ResponsiveContainer>
            ) : (
                <Chart type="bar" height={height} series={apexSeries} options={apexOptions} />
            )}
        </Box>
    );
}