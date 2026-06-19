import { createBrowserRouter, Navigate } from "react-router";
import { MobileFrame } from "./components/MobileFrame";
import { AppLayout } from "./layouts/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { SplashScreen } from "./screens/SplashScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { AuthScreen } from "./screens/AuthScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { ScanTargetScreen } from "./screens/ScanTargetScreen";
import { ScanProgressScreen } from "./screens/ScanProgressScreen";
import { ScanResultsScreen } from "./screens/ScanResultsScreen";
import { OpenPortsScreen } from "./screens/OpenPortsScreen";
import { ServiceDetailsScreen } from "./screens/ServiceDetailsScreen";
import { MisconfigScreen } from "./screens/MisconfigScreen";
import { RiskSeverityScreen } from "./screens/RiskSeverityScreen";
import { MitigationScreen } from "./screens/MitigationScreen";
import { ScheduledScansScreen } from "./screens/ScheduledScansScreen";
import { NotificationsScreen } from "./screens/NotificationsScreen";
import { ReportExportScreen } from "./screens/ReportExportScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { AdminDashboardScreen } from "./screens/AdminDashboardScreen";
import { UserManagementScreen } from "./screens/UserManagementScreen";
import { AnalystDashboardScreen } from "./screens/AnalystDashboardScreen";
import { AgentsScreen } from "./screens/AgentsScreen";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: MobileFrame,
    children: [
      { index: true, Component: SplashScreen },
      { path: "onboarding", Component: OnboardingScreen },
      { path: "auth", Component: AuthScreen },
      {
        path: "app",
        Component: ProtectedRoute,
        children: [
          {
            Component: AppLayout,
            children: [
              { index: true, Component: DashboardScreen },
              { path: "scan", Component: ScanTargetScreen },
              { path: "scan/progress", Component: ScanProgressScreen },
              { path: "scan/results", Component: ScanResultsScreen },
              { path: "scan/results/ports", Component: OpenPortsScreen },
              { path: "scan/results/ports/:id", Component: ServiceDetailsScreen },
              { path: "scan/results/misconfig", Component: MisconfigScreen },
              { path: "scan/results/risk", Component: RiskSeverityScreen },
              { path: "scan/results/mitigation", Component: MitigationScreen },
              { path: "history", Component: HistoryScreen },
              { path: "schedule", Component: ScheduledScansScreen },
              { path: "notifications", Component: NotificationsScreen },
              { path: "reports", Component: ReportExportScreen },
              { path: "profile", Component: ProfileScreen },
              { path: "agents", Component: AgentsScreen },
              
              // Admin Only routes
              {
                element: <ProtectedRoute allowedRoles={["SUPER_ADMIN"]} />,
                children: [
                  { path: "admin", Component: AdminDashboardScreen },
                  { path: "admin/users", Component: UserManagementScreen },
                ],
              },
              
              // Analyst & Admin routes
              {
                element: <ProtectedRoute allowedRoles={["SECURITY_ANALYST", "SUPER_ADMIN"]} />,
                children: [
                  { path: "analyst", Component: AnalystDashboardScreen },
                ],
              },
            ],
          },
        ],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
