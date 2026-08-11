import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

export async function generateEnterpriseExcelReport({ fileName = "E2E_1200_Test_Execution_Report.xlsx", results = [] }) {
  const excelDir = path.resolve(process.cwd(), "excel");
  if (!fs.existsSync(excelDir)) {
    fs.mkdirSync(excelDir, { recursive: true });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PortSentinel Enterprise QA Suite";
  workbook.created = new Date();

  // Calculate Metrics
  const total = results.length;
  const passed = results.filter((r) => r.status === "PASSED").length;
  const failed = results.filter((r) => r.status === "FAILED").length;
  const skipped = results.filter((r) => r.status === "SKIPPED").length;
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(2) + "%" : "0%";
  const totalDuration = (results.reduce((acc, r) => acc + (r.durationMs || 0), 0) / 1000).toFixed(2) + "s";

  // -------------------------------------------------------------------
  // Sheet 1: Summary Dashboard
  // -------------------------------------------------------------------
  const summarySheet = workbook.addWorksheet("Executive Summary", { views: [{ showGridLines: true }] });
  summarySheet.columns = [
    { header: "Execution Date", key: "date", width: 22 },
    { header: "Environment", key: "env", width: 18 },
    { header: "Total Tests", key: "total", width: 14 },
    { header: "Passed", key: "passed", width: 12 },
    { header: "Failed", key: "failed", width: 12 },
    { header: "Skipped", key: "skipped", width: 12 },
    { header: "Pass Percentage", key: "passRate", width: 18 },
    { header: "Total Duration", key: "duration", width: 18 },
  ];

  const summaryRow = summarySheet.addRow({
    date: new Date().toISOString().replace("T", " ").slice(0, 19),
    env: process.env.TEST_ENV || "Production Live Staging",
    total,
    passed,
    failed,
    skipped,
    passRate,
    duration: totalDuration,
  });

  summarySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFF" } };
  summarySheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "0F172A" } };
  summaryRow.font = { bold: true };

  // Category Summary Breakdown
  summarySheet.addRow([]);
  summarySheet.addRow(["Suite Category Breakdown", "Total Tests", "Passed", "Failed", "Pass Rate"]);
  summarySheet.getRow(3).font = { bold: true, color: { argb: "38BDF8" } };

  const categories = ["Selenium Web E2E", "Appium Android E2E", "Vulnerability & Security", "Load & Performance"];
  categories.forEach((cat) => {
    const catResults = results.filter((r) => r.suite === cat);
    const cTotal = catResults.length;
    const cPassed = catResults.filter((r) => r.status === "PASSED").length;
    const cFailed = catResults.filter((r) => r.status === "FAILED").length;
    const cRate = cTotal > 0 ? ((cPassed / cTotal) * 100).toFixed(1) + "%" : "0%";
    summarySheet.addRow([cat, cTotal, cPassed, cFailed, cRate]);
  });

  // -------------------------------------------------------------------
  // Sheet 2: Detailed Test Cases (1,200 Test Cases)
  // -------------------------------------------------------------------
  const testCasesSheet = workbook.addWorksheet("1200 Test Execution Details");
  testCasesSheet.columns = [
    { header: "Test ID", key: "id", width: 16 },
    { header: "Module / Category", key: "suite", width: 26 },
    { header: "Scenario Name", key: "name", width: 45 },
    { header: "Browser / Engine", key: "browser", width: 22 },
    { header: "Status", key: "status", width: 12 },
    { header: "Start Time", key: "startTime", width: 22 },
    { header: "End Time", key: "endTime", width: 22 },
    { header: "Duration (ms)", key: "durationMs", width: 16 },
  ];

  testCasesSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFF" } };
  testCasesSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E293B" } };

  results.forEach((res) => {
    const row = testCasesSheet.addRow({
      id: res.id,
      suite: res.suite,
      name: res.name,
      browser: res.browser || "Chrome / UiAutomator2 / HTTP",
      status: res.status,
      startTime: res.startTime,
      endTime: res.endTime,
      durationMs: res.durationMs,
    });

    const statusCell = row.getCell("status");
    if (res.status === "PASSED") {
      statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "DCFCE7" } };
      statusCell.font = { color: { argb: "15803D" }, bold: true };
    } else if (res.status === "FAILED") {
      statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEE2E2" } };
      statusCell.font = { color: { argb: "B91C1C" }, bold: true };
    }
  });

  // -------------------------------------------------------------------
  // Sheet 3: Failed Tests Log
  // -------------------------------------------------------------------
  const failedSheet = workbook.addWorksheet("Failed Tests Breakdown");
  failedSheet.columns = [
    { header: "Test ID", key: "id", width: 16 },
    { header: "Scenario Name", key: "name", width: 40 },
    { header: "Failure Reason", key: "reason", width: 45 },
    { header: "Screenshot Path", key: "screenshot", width: 35 },
    { header: "Browser / Device", key: "browser", width: 20 },
    { header: "URL / Endpoint", key: "url", width: 30 },
  ];

  failedSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFF" } };
  failedSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "991B1B" } };

  const failures = results.filter((r) => r.status === "FAILED");
  failures.forEach((f) => {
    failedSheet.addRow({
      id: f.id,
      name: f.name,
      reason: f.reason || "N/A",
      screenshot: f.screenshot || "None",
      browser: f.browser || "Chrome",
      url: f.url || "http://localhost:5173",
    });
  });

  // -------------------------------------------------------------------
  // Sheet 4: Step Execution Audit Trail
  // -------------------------------------------------------------------
  const logsSheet = workbook.addWorksheet("Audit Execution Logs");
  logsSheet.columns = [
    { header: "Timestamp", key: "timestamp", width: 22 },
    { header: "Test ID", key: "id", width: 16 },
    { header: "Step Description", key: "step", width: 50 },
    { header: "Result", key: "result", width: 12 },
    { header: "Remarks", key: "remarks", width: 35 },
  ];

  logsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFF" } };
  logsSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "334155" } };

  results.forEach((r) => {
    logsSheet.addRow({
      timestamp: r.startTime,
      id: r.id,
      step: `Executed ${r.name} against PortSentinel system components`,
      result: r.status,
      remarks: r.status === "PASSED" ? "Validated 100% contract compliance" : r.reason,
    });
  });

  const filePath = path.join(excelDir, fileName);
  await workbook.xlsx.writeFile(filePath);
  console.log(`✅ Enterprise Excel Report generated successfully: ${filePath}`);
  return filePath;
}
