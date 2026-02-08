import Header from "./Header";
import SummaryBar from "./SummaryBar";
import DashboardLayout from "./DashboardLayout";
import StageVsDealsChart from "./charts/StageVsDealsChart";
import RepSalesCycleChart from "./charts/RepSalesCycleChart";
import SegmentStageIndustryChart from "./charts/SegmentStageIndustryChart";
import RepClosedWonPie from "./charts/RepClosedWonPie";
import RepClosedLostPie from "./charts/RepClosedLostPie";
import StageVsRepHeatmap from "./charts/StageVsRepHeatmap";
import BlueTitleBar from "./BlueTitleBar";

import StaleDeals30DaysChart from "./charts/StaleDeals30DaysChart";
import DealsByLatestActivityType from "./charts/DealsByLatestActivityType";
import RepRevenueChart from "./charts/RepRevenueChart";

function Home() {

  return (
    <>
      <Header/>
      <SummaryBar/>
      <DashboardLayout />
      <BlueTitleBar title="Other Graph" />
      <StageVsDealsChart />
      <RepClosedWonPie />
      <RepClosedLostPie />
      <StageVsRepHeatmap />
      <RepSalesCycleChart />
      <SegmentStageIndustryChart />
      <StaleDeals30DaysChart />
      <DealsByLatestActivityType />
      <RepRevenueChart />
    </>
  )
}

export default Home;