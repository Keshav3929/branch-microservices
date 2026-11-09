import { useLayoutEffect, useRef, useMemo } from "react";
import { Box, Typography } from "@mui/material";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import * as am5radar from "@amcharts/amcharts5/radar";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from "recharts";
import Chart from "react-apexcharts";
import type { ChartEngine } from "../types/chartTypes";

export type GaugeChartProps = {
    title?: string;
    value: number;
    max?: number;
    suffix?: string;
    height?: number;
    engine?: ChartEngine;
    onClick?: () => void;
};

export default function GaugeChart({
    value,
    max = 100,
    suffix = "% Active",
    height = 320,
    engine = "amcharts",
    onClick
}: GaugeChartProps) {
    const am5Ref = useRef<HTMLDivElement>(null);
    const safeValue = Math.max(0, Math.min(value, max));
    const roundedValue = Math.round(safeValue * 10) / 10;
    // ----------------- AmCharts 5 Build -----------------
    useLayoutEffect(() => {
        if (!am5Ref.current || engine !== "amcharts") return;
        const root = am5.Root.new(am5Ref.current);
        root.setThemes([am5themes_Animated.new(root)]);

        const chart = root.container.children.push( am5radar.RadarChart.new(root, { panX: false, panY: false, startAngle: 160, endAngle: 380, innerRadius: -20 }) );
        const renderer = am5radar.AxisRendererCircular.new(root, { innerRadius: -10, strokeOpacity: 0.1 });
        renderer.grid.template.set("visible", false);

        const axis = chart.xAxes.push( am5xy.ValueAxis.new(root, { min: 0, max, strictMinMax: true, maxDeviation: 0, renderer }) );
        const ranges = max === 100
            ? [ { start: 0, end: 40, color: 0xd32f2f }, { start: 40, end: 70, color: 0xf9a825 }, { start: 70, end: 100, color: 0x2e7d32 } ]
            : [ { start: 0, end: max / 3, color: 0xd32f2f }, { start: max / 3, end: (max * 2) / 3, color: 0xf9a825 }, { start: (max * 2) / 3, end: max, color: 0x2e7d32 } ];
        ranges.forEach(({ start, end, color }) => {
            const range = axis.createAxisRange(axis.makeDataItem({ value: start, endValue: end }));
            range.get("axisFill")?.setAll({ visible: true, fill: am5.color(color), fillOpacity: 0.85 });
            range.get("label")?.set("forceHidden", true);
        });

        const handItem = axis.makeDataItem({ value: 0 });
        handItem.set("bullet", am5xy.AxisBullet.new(root, { sprite: am5radar.ClockHand.new(root, { radius: am5.percent(95), pinRadius: 16, bottomWidth: 24 }) }) );

        axis.createAxisRange(handItem);
        handItem.animate({ key: "value", to: safeValue, duration: 1200, easing: am5.ease.out(am5.ease.cubic) });

        chart.radarContainer.children.push( am5.Label.new(root, { text: `${roundedValue}${suffix}`, centerX: am5.p50, centerY: am5.p50, y: 60, fontSize: 22, fontWeight: "700" }) );
        return () => root.dispose();
    }, [safeValue, max, suffix, engine, roundedValue]);
    // ----------------- Recharts Data -----------------
    const rechartsData = useMemo(() => {
        const activeColor = safeValue >= 70 ? "#2e7d32" : safeValue >= 40 ? "#f9a825" : "#d32f2f";
        return [
            { name: "Active", value: safeValue, color: activeColor },
            { name: "Remaining", value: Math.max(0, max - safeValue), color: "#e2e8f0" }
        ];
    }, [safeValue, max]);
    // ----------------- ApexCharts Options -----------------
    const apexOptions = useMemo<ApexCharts.ApexOptions>(() => {
        const gaugeColor = safeValue >= 70 ? "#2e7d32" : safeValue >= 40 ? "#f9a825" : "#d32f2f";
        return {
            chart: { type: "radialBar", offsetY: -10, sparkline: { enabled: true } },
            plotOptions: {
                radialBar: { startAngle: -120, endAngle: 120, track: { background: "#f1f5f9", strokeWidth: "90%", margin: 5 },
                    dataLabels: {
                        name: { show: true, fontSize: "14px", color: "#64748b", offsetY: 20 },
                        value: { offsetY: -20, fontSize: "26px", fontWeight: "800", color: "#0f172a", formatter: () => `${roundedValue}%` }
                    }
                }
            },
            colors: [gaugeColor],
            labels: [suffix ? suffix.replace(/^%?\s*/, "") : "Active Share"]
        };
    }, [safeValue, roundedValue, suffix]);

    return (
        <Box onClick={onClick} sx={{ width: "100%", height, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", cursor: onClick ? "pointer" : "default" }} >
            {engine === "amcharts" ? (
                <div ref={am5Ref} style={{ width: "100%", height }} />
            ) : engine === "recharts" ? (
                <Box sx={{ width: "100%", height, position: "relative" }}>
                    <ResponsiveContainer width="100%" height={height}>
                        <RechartsPieChart>
                            <Pie data={rechartsData} cx="50%" cy="75%" startAngle={180} endAngle={0} innerRadius={height * 0.32} outerRadius={height * 0.44} paddingAngle={2} dataKey="value" >
                                {rechartsData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={entry.color} /> ))}
                            </Pie>
                        </RechartsPieChart>
                    </ResponsiveContainer>
                    <Box sx={{ position: "absolute", bottom: height * 0.16, left: 0, right: 0, textAlign: "center", pointerEvents: "none" }} >
                        <Typography variant="h4" sx={{ fontWeight: 800, color: "text.primary" }}> {roundedValue}% </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}> {suffix ? suffix.replace(/^%?\s*/, "") : "Active Ratio"} </Typography>
                    </Box>
                </Box>
            ) : (
                <Box sx={{ width: "100%", height, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Chart type="radialBar" height={height * 1.05} width="100%" series={[Math.round((safeValue / max) * 100)]} options={apexOptions} />
                </Box>
            )}
        </Box>
    );
}