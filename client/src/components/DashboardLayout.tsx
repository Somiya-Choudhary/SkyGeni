import { Box } from "@mui/material";
import RevenueDriversCard from "./RevenueDriversCard";
import TopRiskFactorsCard from "./TopRiskFactorsCard";
import RecommendedActionsCard from "./RecommendedActionsCard";
// import Barchart from "./Barchart";
import RevenueTrend6Months from "./charts/RevenueTrend6Months";

export default function DashboardLayout() {
  return (
    <Box
      sx={{
        p: 2,
        bgcolor: "#f5f7fb",
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      <Box
        sx={{
          maxWidth: 1250,
          mx: "auto",
          display: "grid",
          gridTemplateColumns: "380px 1fr 1fr",
          gridTemplateRows: "auto auto",
          gap: 2,
          alignItems: "start",
        }}
      >
        {/* Left tall card */}
        <Box sx={{ gridColumn: "1 / 2", gridRow: "1 / span 2" }}>
          <RevenueDriversCard />
        </Box>

        {/* Top row: two cards */}
        <Box sx={{ gridColumn: "2 / 3", gridRow: "1 / 2" }}>
          <TopRiskFactorsCard />
        </Box>

        <Box sx={{ gridColumn: "3 / 4", gridRow: "1 / 2" }}>
          <RecommendedActionsCard />
        </Box>

        {/* Bottom row: wide chart spanning 2 columns */}
        <Box sx={{ gridColumn: "2 / 4", gridRow: "2 / 3" }}>
          {/* Your Barchart currently wraps itself in page padding + card.
              If you want it to fit inside this grid perfectly,
              you should REMOVE the outer <Box sx={{ p: 2, bgcolor..., minHeight... }}> from Barchart
              and return only the Card.
              
              For now, it'll still render, but will add extra padding. */}
          <RevenueTrend6Months />
        </Box>
      </Box>
    </Box>
  );
}
