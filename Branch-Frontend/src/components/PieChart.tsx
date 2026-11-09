import { useLayoutEffect, useMemo, useRef } from "react";
import { Box, Typography } from "@mui/material";
import * as am5 from "@amcharts/amcharts5";
import * as am5percent from "@amcharts/amcharts5/percent";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import {
    ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell,
    Tooltip as RechartsTooltip, Legend as RechartsLegend
} from "recharts";
import Chart from "react-apexcharts";
import type { ChartEngine } from "../types/chartTypes";

export type PieChartProps = {
    title?: string;
    data: object[];
    categoryField: string;
    valueField: string;
    height?: number;
    engine?: ChartEngine;
    onSliceClick?: (category: string, value: number) => void;
};

const PALETTE = [ "#2563eb", "#06b6d4", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16"];

export default function PieChart({
    data, categoryField, valueField, height = 320, engine = "amcharts", onSliceClick
}: PieChartProps) {
    const am5Ref = useRef<HTMLDivElement>(null);
    const rows = useMemo(() => {
        return data.map(item => {
            const row = item as Record<string, unknown>;
            return {
                category: String(row[categoryField] ?? "Unknown"),
                value: Number(row[valueField] ?? 0)
            };
        });
    }, [data, categoryField, valueField]);
    // ----------------- AmCharts 5 Build -----------------
    useLayoutEffect(() => {
        if (!am5Ref.current || !rows.length || engine !== "amcharts") return;

        const root = am5.Root.new(am5Ref.current);
        root.setThemes([am5themes_Animated.new(root)]);

        const chart = root.container.children.push( am5percent.PieChart.new(root, { innerRadius: am5.percent(55) }));
        const series = chart.series.push( am5percent.PieSeries.new(root, { categoryField: "category", valueField: "value" }) );
        series.data.setAll(rows);
        series.labels.template.setAll({ text: "{category}: {value}", fontSize: 12 });
        series.slices.template.setAll({ tooltipText: "{category}: {value}", cursorOverStyle: onSliceClick ? "pointer" : "default" });

        if (onSliceClick) {
            series.slices.template.events.on("click", ev => {
                const dataContext = ev.target.dataItem?.dataContext as { category?: string; value?: number } | undefined;
                if (dataContext?.category) {
                    onSliceClick(dataContext.category, dataContext.value ?? 0);
                }
            });
        }
        series.appear(800);
        return () => root.dispose();
    }, [rows, engine, onSliceClick]);
    // ----------------- ApexCharts Options -----------------
    const apexSeries = useMemo(() => rows.map(r => r.value), [rows]);
    const apexOptions = useMemo<ApexCharts.ApexOptions>(() => {
        return {
            chart: { type: "donut", animations: { enabled: true, speed: 600 }, events: { dataPointSelection: (_, __, config) => { if (!config) return;
                        const index = config.dataPointIndex;
                        const row = rows[index];
                        if (row && onSliceClick) { onSliceClick(row.category, row.value); }
                    }
                }
            },
            labels: rows.map(r => r.category), colors: PALETTE, legend: { position: "bottom", fontSize: "12px", markers: { size: 6 } },
            plotOptions: { pie: { donut: { size: "55%", labels: { show: true, total: { show: true, label: "Total", fontSize: "14px", fontWeight: 700, color: "#64748b", formatter: () => String(rows.reduce((sum, r) => sum + r.value, 0)) } } } } },
            tooltip: { y: { formatter: val => `${val} branches` }}, dataLabels: { enabled: true, formatter: val => `${Math.round(Number(val))}%` }
        };
    }, [rows, onSliceClick]);
    if (!rows.length) {
        return ( <Typography color="text.secondary" textAlign="center" py={5}> No chart data available. </Typography> );
    }

    return (
        <Box sx={{ width: "100%", height, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {engine === "amcharts" ? (
                <div ref={am5Ref} style={{ width: "100%", height }} />
            ) : engine === "recharts" ? (
                <ResponsiveContainer width="100%" height={height}>
                    <RechartsPieChart>
                        <Pie data={rows} dataKey="value" nameKey="category" cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2}
                            label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine cursor={onSliceClick ? "pointer" : "default"}
                            onClick={(entry: unknown) => {
                                const sector = entry as { category?: string; value?: number } | undefined;
                                if (sector?.category && onSliceClick) {
                                    onSliceClick(sector.category, Number(sector.value ?? 0));
                                }
                            }}
                        >
                            {rows.map((_, index) => ( <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} /> ))}
                        </Pie>
                        <RechartsTooltip
                            formatter={(val: unknown, name: unknown) => [ `${val ?? 0} branches`, String(name ?? "") ]}
                            contentStyle={{ backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: "12px" }}
                        />
                        <RechartsLegend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: "12px" }} />
                    </RechartsPieChart>
                </ResponsiveContainer>
            ) : (
                <Chart type="donut" height={height} width="100%" series={apexSeries} options={apexOptions} />
            )}
        </Box>
    );
}