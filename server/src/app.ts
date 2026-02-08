import express from "express";
import cors from "cors";
import { getDrivers } from "./controllers/driver.controller";
import { riskFactor } from "./controllers/riskFactor.controller";
import { getSummary } from "./controllers/summary.controller";
import { getRecommendations } from "./controllers/recommendations.controller";
import { getClosedWonByRep } from "./controllers/chartClosedWonByRep.controller";

import {
  getPipelineByMonth,
  getWinRateByMonth,
  getSalesCycleByMonth,
  getAvgDealSizeByMonth,
  getRevenueByMonth,
} from "./controllers/charts.controller";

import { getDealsByStage } from "./controllers/chartDealByStages.controller";
import { getClosedLostByRep } from "./controllers/chartClosedLostByRep.controller";
import { getStageByRepHeatmap } from "./controllers/chartStageByRepHeatmap.controller";
import { getSalesCycleByRep } from "./controllers/chartSalesCycleByRep.controller";
import { getSegmentStageIndustry } from "./controllers/chartSegmentStageIndustry.controller";
import { getStaleOpenDeals } from "./controllers/chartStaleOpenDeals.controller";
import { getOpenDealsLatestActivity } from "./controllers/chartOpenDealsLatestActivity.controller";
import { getClosedWonRevenueByRep } from "./controllers/chartClosedWonRevenueByRep.controller";




const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/summary", getSummary);

app.get("/api/drivers", getDrivers);

app.get("/api/risk-factors", riskFactor);

app.get("/api/recommendations", getRecommendations);

app.get("/api/charts/pipeline-by-month", getPipelineByMonth);
app.get("/api/charts/winrate-by-month", getWinRateByMonth);
app.get("/api/charts/salescycle-by-month", getSalesCycleByMonth);
app.get("/api/charts/avgdealsize-by-month", getAvgDealSizeByMonth);
app.get("/api/charts/revenue-by-month", getRevenueByMonth);
app.get("/api/charts/deals-by-stage", getDealsByStage);
app.get("/api/charts/closed-won-by-rep", getClosedWonByRep);
app.get("/api/charts/closed-lost-by-rep", getClosedLostByRep);
app.get("/api/charts/stage-by-rep-heatmap", getStageByRepHeatmap);
app.get("/api/charts/sales-cycle-by-rep", getSalesCycleByRep);
app.get("/api/charts/segment-stage-industry", getSegmentStageIndustry);
app.get("/api/charts/stale-open-deals", getStaleOpenDeals);
app.get("/api/charts/open-deals-latest-activity", getOpenDealsLatestActivity);
app.get("/api/charts/closed-won-revenue-by-rep", getClosedWonRevenueByRep);



export default app;
