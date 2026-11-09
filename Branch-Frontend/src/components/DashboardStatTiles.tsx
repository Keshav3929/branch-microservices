import { Box, Card, Typography, Stack, Tooltip } from "@mui/material";
import StorageIcon from "@mui/icons-material/Storage";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

export type DashboardStatTilesProps = {
    total: number;
    active: number;
    inactive: number;
    activeStatusFilter?: boolean | undefined;
    onTileClick: (type: "total" | "active" | "inactive") => void;
};

export default function DashboardStatTiles({
    total,
    active,
    inactive,
    activeStatusFilter,
    onTileClick
}: DashboardStatTilesProps) {
    const rate = total > 0 ? ((active / total) * 100).toFixed(1) : "0.0";

    const tiles = [
        { id: "total" as const, label: "Total Branches", count: total, subtext: "All registered branches", color: "#17324d", lightBg: "linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)", icon: <StorageIcon sx={{ fontSize: 26, color: "#93c5fd" }} />, isSelected: activeStatusFilter === undefined },
        { id: "active" as const, label: "Active", count: active, subtext: `${rate}% operational`, color: "#166534", lightBg: "linear-gradient(135deg, #15803d 0%, #14532d 100%)", icon: <CheckCircleIcon sx={{ fontSize: 26, color: "#86efac" }} />,  isSelected: activeStatusFilter === true },
        { id: "inactive" as const, label: "Inactive", count: inactive, subtext: total > 0 ? `${((inactive / total) * 100).toFixed(1)}% deactivated` : "0%", color: "#991b1b", lightBg: "linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)", icon: <CancelIcon sx={{ fontSize: 26, color: "#fca5a5" }} />, isSelected: activeStatusFilter === false },
        { id: "total" as const, label: "Overall Active Rate", count: `${rate}%`, subtext: `${active} of ${total} active`, color: "#0369a1", lightBg: "linear-gradient(135deg, #0284c7 0%, #075985 100%)", icon: <TrendingUpIcon sx={{ fontSize: 26, color: "#7dd3fc" }} />, isSelected: false }
    ];

    return (
        <Box
            sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 2, mb: 2.5 }}>            {tiles.map((tile, i) => (
                <Tooltip key={`${tile.label}-${i}`} title={`Click to filter by ${tile.label}`}>
                    <Card
                        elevation={0} onClick={() => onTileClick(tile.id)}
                        sx={{ p: 2.5, borderRadius: 3, background: tile.lightBg, color: "#ffffff", cursor: "pointer", position: "relative", overflow: "hidden", transition: "all 0.25s ease", boxShadow: tile.isSelected ? "0 8px 24px rgba(0,0,0,0.25)" : "0 2px 8px rgba(0,0,0,0.08)", transform: tile.isSelected ? "scale(1.02)" : "scale(1)", outline: tile.isSelected ? "3px solid #60a5fa" : "none", "&:hover": { transform: "translateY(-4px)", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" } }}
                    >
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Box>
                                <Typography variant="caption" sx={{ textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, opacity: 0.9, fontSize: "0.75rem" }}> {tile.label} </Typography>
                                <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, lineHeight: 1.1, letterSpacing: -0.5 }}> {typeof tile.count === "number" ? tile.count.toLocaleString() : tile.count} </Typography>
                                <Typography variant="caption" sx={{ display: "block", mt: 0.75, opacity: 0.8, fontSize: "0.75rem", fontWeight: 500 }}> {tile.subtext} </Typography>
                            </Box>
                            <Box
                                sx={{ p: 1, borderRadius: 2, bgcolor: "rgba(255, 255, 255, 0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}> {tile.icon}
                            </Box>
                        </Stack>
                    </Card>
                </Tooltip>
            ))}
        </Box>
    );
}