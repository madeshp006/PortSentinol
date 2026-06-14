import PDFDocument from "pdfkit";

export function generatePdfReport(scan, res) {
  const doc = new PDFDocument({ margin: 50, size: "A4" });

  // Pipe the PDF directly to the Express response stream
  doc.pipe(res);

  const colors = {
    backgroundDark: "#060e1e",
    borderDark: "#1c3254",
    textLight: "#e8f0fe",
    textMuted: "#8899b8",
    primary: "#38bdf8",
    secondary: "#a78bfa",
    critical: "#ef4444",
    high: "#f97316",
    medium: "#f59e0b",
    low: "#22c55e",
    tableHeader: "#0f1e36",
    tableRowEven: "#0b1526",
    tableRowOdd: "#070d1e",
  };

  // ─── PAGE 1: COVER PAGE ────────────────────────────────────────────────────
  // Dark cyber background
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(colors.backgroundDark);

  // Decorative border
  doc.rect(25, 25, doc.page.width - 50, doc.page.height - 50)
     .strokeColor(colors.borderDark)
     .lineWidth(1)
     .stroke();

  // Cyber header glow effect (subtle top line)
  doc.rect(25, 25, doc.page.width - 50, 4)
     .fill("linear-gradient(90deg, #38bdf8, #a78bfa)");

  // Brand Name
  doc.fillColor(colors.primary)
     .fontSize(16)
     .font("Helvetica-Bold")
     .text("PORT", 50, 60, { PageWidth: 100, continued: true })
     .fillColor(colors.textLight)
     .text("SENTINEL");

  // Document Title
  doc.fillColor(colors.textLight)
     .fontSize(32)
     .font("Helvetica-Bold")
     .text("VULNERABILITY ASSESSMENT", 50, 180);

  doc.fillColor(colors.primary)
     .fontSize(22)
     .font("Helvetica-Bold")
     .text("REPORT", 50, 218);

  // Subtitle
  doc.fillColor(colors.textMuted)
     .fontSize(12)
     .font("Helvetica")
     .text("Automated network scanning and configuration analysis report.", 50, 260);

  // Divider
  doc.moveTo(50, 290)
     .lineTo(doc.page.width - 50, 290)
     .strokeColor(colors.borderDark)
     .lineWidth(1)
     .stroke();

  // Target Metadata
  doc.fillColor(colors.textMuted)
     .fontSize(9)
     .font("Helvetica-Bold")
     .text("TARGET HOST", 50, 330);

  doc.fillColor(colors.textLight)
     .fontSize(18)
     .font("Helvetica-Bold")
     .text(scan.target, 50, 345);

  doc.fillColor(colors.textMuted)
     .fontSize(9)
     .font("Helvetica-Bold")
     .text("SCAN WORKER", 50, 395);

  doc.fillColor(colors.textLight)
     .fontSize(11)
     .font("Helvetica")
     .text(scan.workerMode === "agent" ? "Local PortSentinel Agent" : "Cloud Scanner Daemon", 50, 410);

  // Grid details
  doc.fillColor(colors.textMuted)
     .fontSize(9)
     .font("Helvetica-Bold")
     .text("DATE GENERATED", 50, 460, { width: 150, continued: true })
     .text("SCAN TYPE", 200, 460, { width: 150, continued: true })
     .text("DURATION", 350, 460);

  doc.fillColor(colors.textLight)
     .fontSize(11)
     .font("Helvetica")
     .text(new Date(scan.savedAt || scan.createdAt).toLocaleString(), 50, 475, { width: 140, continued: true })
     .text(scan.scanType || "Quick Scan", 200, 475, { width: 140, continued: true })
     .text(scan.duration || "0m 12s", 350, 475);

  // Risk Score Badge (bottom right)
  const badgeX = doc.page.width - 170;
  const badgeY = doc.page.height - 180;
  doc.roundedRect(badgeX, badgeY, 120, 100, 16)
     .fill(colors.tableHeader)
     .strokeColor(colors.borderDark)
     .lineWidth(2)
     .stroke();

  doc.fillColor(colors.textMuted)
     .fontSize(9)
     .font("Helvetica-Bold")
     .text("RISK SCORE", badgeX + 10, badgeY + 15, { width: 100, align: "center" });

  const scoreColor = scan.riskScore > 75 ? colors.low : scan.riskScore > 40 ? colors.medium : colors.critical;
  doc.fillColor(scoreColor)
     .fontSize(36)
     .font("Helvetica-Bold")
     .text(scan.riskScore, badgeX + 10, badgeY + 32, { width: 100, align: "center" });

  doc.fillColor(colors.textMuted)
     .fontSize(9)
     .font("Helvetica")
     .text("/ 100", badgeX + 10, badgeY + 75, { width: 100, align: "center" });

  // ─── PAGE 2: EXECUTIVE SUMMARY & FINDINGS ──────────────────────────────────
  doc.addPage();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(colors.backgroundDark);

  // Header
  doc.fillColor(colors.primary)
     .fontSize(14)
     .font("Helvetica-Bold")
     .text("EXECUTIVE SUMMARY", 50, 50);

  doc.fillColor(colors.textLight)
     .fontSize(11)
     .font("Helvetica")
     .text(
       `PortSentinel performed a security assessment on target host "${scan.target}" on ${new Date(scan.savedAt).toLocaleDateString()}. The host was analyzed for exposed services, open TCP ports, and potential configuration issues.`,
       50,
       80,
       { width: doc.page.width - 100, align: "justify", lineGap: 4 }
     );

  // Metrics grid
  const gridY = 150;
  const colWidth = (doc.page.width - 100) / 4;

  const metrics = [
    { label: "Open Ports", val: scan.openPorts, color: colors.primary },
    { label: "Detected Services", val: scan.servicesDetected, color: colors.secondary },
    { label: "Misconfigurations", val: scan.misconfigurations, color: colors.medium },
    { label: "Risk Penalty", val: 100 - scan.riskScore, color: colors.critical },
  ];

  metrics.forEach((m, idx) => {
    const x = 50 + idx * colWidth;
    doc.roundedRect(x + 5, gridY, colWidth - 10, 60, 10)
       .fill(colors.tableHeader)
       .strokeColor(colors.borderDark)
       .lineWidth(1)
       .stroke();

    doc.fillColor(m.color)
       .fontSize(18)
       .font("Helvetica-Bold")
       .text(m.val, x + 5, gridY + 12, { width: colWidth - 10, align: "center" });

    doc.fillColor(colors.textMuted)
       .fontSize(8)
       .font("Helvetica-Bold")
       .text(m.label.toUpperCase(), x + 5, gridY + 36, { width: colWidth - 10, align: "center" });
  });

  // Open Ports Table Title
  doc.fillColor(colors.primary)
     .fontSize(14)
     .font("Helvetica-Bold")
     .text("OPEN PORTS & SERVICE INVENTORY", 50, 240);

  // Table Headers
  const tableY = 265;
  const tableCols = [
    { label: "PORT", width: 60, align: "left" },
    { label: "PROTOCOL", width: 80, align: "left" },
    { label: "SERVICE", width: 100, align: "left" },
    { label: "RISK LEVEL", width: 80, align: "center" },
    { label: "IDENTIFIED VERSION", width: 170, align: "left" },
  ];

  // Draw header background
  doc.rect(50, tableY, doc.page.width - 100, 24).fill(colors.tableHeader);

  let currentX = 55;
  tableCols.forEach((col) => {
    doc.fillColor(colors.textLight)
       .fontSize(9)
       .font("Helvetica-Bold")
       .text(col.label, currentX, tableY + 7, { width: col.width, align: col.align });
    currentX += col.width;
  });

  // Draw rows
  let rowY = tableY + 24;
  let ports = [];
  try {
    ports = typeof scan.ports === "string" ? JSON.parse(scan.ports) : (Array.isArray(scan.ports) ? scan.ports : []);
  } catch {
    ports = [];
  }

  if (ports.length === 0) {
    doc.rect(50, rowY, doc.page.width - 100, 30).fill(colors.tableRowEven);
    doc.fillColor(colors.textMuted)
       .fontSize(10)
       .font("Helvetica-Oblique")
       .text("No open TCP ports detected.", 60, rowY + 9, { align: "center", width: doc.page.width - 120 });
    rowY += 30;
  } else {
    ports.forEach((p, index) => {
      // Row page-overflow check
      if (rowY > doc.page.height - 80) {
        doc.addPage();
        doc.rect(0, 0, doc.page.width, doc.page.height).fill(colors.backgroundDark);
        rowY = 50;
      }

      // Zebra striping
      doc.rect(50, rowY, doc.page.width - 100, 24)
         .fill(index % 2 === 0 ? colors.tableRowEven : colors.tableRowOdd);

      let x = 55;
      // Port number
      doc.fillColor(colors.textLight)
         .fontSize(9)
         .font("Helvetica-Bold")
         .text(p.number || p.port, x, rowY + 7, { width: tableCols[0].width, align: "left" });
      x += tableCols[0].width;

      // Protocol
      doc.fillColor(colors.textMuted)
         .fontSize(9)
         .font("Helvetica")
         .text(String(p.protocol || "TCP").toUpperCase(), x, rowY + 7, { width: tableCols[1].width, align: "left" });
      x += tableCols[1].width;

      // Service
      doc.fillColor(colors.textLight)
         .fontSize(9)
         .font("Helvetica")
         .text(p.service || "unknown", x, rowY + 7, { width: tableCols[2].width, align: "left" });
      x += tableCols[2].width;

      // Risk
      const riskText = String(p.risk || "low").toUpperCase();
      const rColor = colors[String(p.risk).toLowerCase()] || colors.low;
      doc.fillColor(rColor)
         .fontSize(9)
         .font("Helvetica-Bold")
         .text(riskText, x, rowY + 7, { width: tableCols[3].width, align: "center" });
      x += tableCols[3].width;

      // Version
      doc.fillColor(colors.textLight)
         .fontSize(9)
         .font("Helvetica")
         .text(p.version || "Unknown", x, rowY + 7, { width: tableCols[4].width, align: "left" });

      rowY += 24;
    });
  }

  // ─── PAGE 3: FINDINGS & RECOMMENDATIONS ────────────────────────────────────
  doc.addPage();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(colors.backgroundDark);

  doc.fillColor(colors.primary)
     .fontSize(14)
     .font("Helvetica-Bold")
     .text("VULNERABILITY DETAILS & FIX RECOMMENDATIONS", 50, 50);

  let recY = 80;
  let findings = [];
  try {
    findings = typeof scan.findings === "string" ? JSON.parse(scan.findings) : (Array.isArray(scan.findings) ? scan.findings : []);
  } catch {
    findings = [];
  }

  if (findings.length === 0) {
    doc.fillColor(colors.textMuted)
       .fontSize(11)
       .font("Helvetica")
       .text("No critical or high risk configuration vulnerabilities were identified during this scan. Ensure that standard access lists (ACLs) stay enabled to prevent future exposures.", 50, recY, { width: doc.page.width - 100 });
  } else {
    findings.forEach((f, idx) => {
      // Finding page-overflow check
      if (recY > doc.page.height - 120) {
        doc.addPage();
        doc.rect(0, 0, doc.page.width, doc.page.height).fill(colors.backgroundDark);
        recY = 50;
      }

      const fColor = colors[String(f.severity).toLowerCase()] || colors.medium;

      // Header block for finding
      doc.rect(50, recY, doc.page.width - 100, 20).fill(colors.tableHeader);

      doc.fillColor(fColor)
         .fontSize(9)
         .font("Helvetica-Bold")
         .text(`[${String(f.severity).toUpperCase()}]`, 60, recY + 5, { continued: true })
         .fillColor(colors.textLight)
         .text(`  ${f.title || "Vulnerability Exposure"}`);

      recY += 25;

      // Description
      doc.fillColor(colors.textMuted)
         .fontSize(9)
         .font("Helvetica-Bold")
         .text("Description: ", 60, recY, { continued: true })
         .font("Helvetica")
         .fillColor(colors.textLight)
         .text(f.description, { width: doc.page.width - 120 });

      const descHeight = doc.heightOfString(f.description, { width: doc.page.width - 120 });
      recY += descHeight + 8;

      // Recommendation
      doc.fillColor(colors.primary)
         .fontSize(9)
         .font("Helvetica-Bold")
         .text("Fix Recommendation: ", 60, recY, { continued: true })
         .font("Helvetica")
         .fillColor(colors.textLight)
         .text(f.recommendation || f.fix || "Restrict external access and verify system logs.", { width: doc.page.width - 120 });

      const recHeight = doc.heightOfString(f.recommendation || f.fix || "Restrict external access", { width: doc.page.width - 120 });
      recY += recHeight + 20;
    });
  }

  // Footer on all pages
  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    doc.fillColor(colors.textMuted)
       .fontSize(8)
       .font("Helvetica")
       .text(`Page ${i + 1} of ${totalPages}`, 50, doc.page.height - 35, { align: "right" });

    doc.text(`PortSentinel Security Assessment — Target: ${scan.target}`, 50, doc.page.height - 35, { align: "left" });
  }

  // End the document stream
  doc.end();
}
