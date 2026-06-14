export type RiskLevel = "critical" | "high" | "medium" | "low" | "info";

export interface Port {
  id: string;
  number: number;
  protocol: "TCP" | "UDP";
  service: string;
  version: string;
  state: "open" | "filtered" | "closed";
  risk: RiskLevel;
  description: string;
  banner?: string;
  cve?: string[];
}

export interface Misconfiguration {
  id: string;
  title: string;
  description: string;
  port: number;
  service: string;
  risk: RiskLevel;
  affected: string;
  fix: string;
}

export interface ScanResult {
  id: string;
  target: string;
  scanType: string;
  timestamp: string;
  duration: string;
  totalPorts: number;
  openPorts: number;
  filteredPorts: number;
  closedPorts: number;
  servicesDetected: number;
  misconfigurations: number;
  riskScore: number;
  ports: Port[];
  misconfigs: Misconfiguration[];
}

export interface ScheduledScan {
  id: string;
  name: string;
  target: string;
  frequency: string;
  nextRun: string;
  lastRun: string;
  active: boolean;
  scanType: string;
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  target: string;
  risk: RiskLevel;
  timestamp: string;
  read: boolean;
  port?: number;
  service?: string;
}

export const mockPorts: Port[] = [
  {
    id: "p1",
    number: 21,
    protocol: "TCP",
    service: "FTP",
    version: "vsftpd 3.0.3",
    state: "open",
    risk: "high",
    description: "File Transfer Protocol — transmits data in plaintext. Easily intercepted.",
    banner: "220 (vsFTPd 3.0.3)",
    cve: ["CVE-2021-3618", "CVE-2019-20382"],
  },
  {
    id: "p2",
    number: 22,
    protocol: "TCP",
    service: "SSH",
    version: "OpenSSH 7.4",
    state: "open",
    risk: "medium",
    description: "Secure Shell — encrypted remote access. Outdated version may have vulnerabilities.",
    banner: "SSH-2.0-OpenSSH_7.4",
    cve: ["CVE-2018-15473"],
  },
  {
    id: "p3",
    number: 23,
    protocol: "TCP",
    service: "Telnet",
    version: "Unknown",
    state: "open",
    risk: "critical",
    description: "Telnet — unencrypted remote access. Extremely dangerous. Should be disabled.",
    banner: "Linux telnetd",
    cve: ["CVE-2020-10188"],
  },
  {
    id: "p4",
    number: 80,
    protocol: "TCP",
    service: "HTTP",
    version: "Apache 2.4.41",
    state: "open",
    risk: "medium",
    description: "Web server running on unencrypted HTTP. Sensitive data may be exposed.",
    banner: "Apache/2.4.41 (Ubuntu)",
    cve: ["CVE-2021-41773"],
  },
  {
    id: "p5",
    number: 443,
    protocol: "TCP",
    service: "HTTPS",
    version: "nginx 1.18.0",
    state: "open",
    risk: "low",
    description: "Encrypted web traffic. TLS 1.2 in use — consider upgrading to TLS 1.3.",
    banner: "nginx/1.18.0",
  },
  {
    id: "p6",
    number: 3306,
    protocol: "TCP",
    service: "MySQL",
    version: "8.0.23",
    state: "open",
    risk: "high",
    description: "Database exposed to network. Should only be accessible locally.",
    banner: "MySQL 8.0.23",
    cve: ["CVE-2021-2307"],
  },
  {
    id: "p7",
    number: 3389,
    protocol: "TCP",
    service: "RDP",
    version: "Windows RDP",
    state: "open",
    risk: "critical",
    description: "Remote Desktop Protocol — exposed to the internet. High risk of brute-force attacks.",
    banner: "",
    cve: ["CVE-2019-0708"],
  },
  {
    id: "p8",
    number: 8080,
    protocol: "TCP",
    service: "HTTP-Alt",
    version: "Tomcat 9.0.37",
    state: "open",
    risk: "medium",
    description: "Alternative HTTP port running Apache Tomcat. Admin panel may be exposed.",
    banner: "Apache Tomcat/9.0.37",
    cve: ["CVE-2020-1938"],
  },
  {
    id: "p9",
    number: 25,
    protocol: "TCP",
    service: "SMTP",
    version: "Postfix 3.4.13",
    state: "open",
    risk: "low",
    description: "Email sending service. Ensure relay is restricted.",
    banner: "Postfix ESMTP",
  },
  {
    id: "p10",
    number: 445,
    protocol: "TCP",
    service: "SMB",
    version: "Samba 4.11",
    state: "open",
    risk: "high",
    description: "Server Message Block — file sharing. Vulnerable to EternalBlue exploit.",
    banner: "",
    cve: ["CVE-2017-0144", "CVE-2020-0796"],
  },
  {
    id: "p11",
    number: 53,
    protocol: "UDP",
    service: "DNS",
    version: "BIND 9.16",
    state: "open",
    risk: "low",
    description: "Domain Name System resolver. Zone transfer restrictions should be enforced.",
  },
  {
    id: "p12",
    number: 5432,
    protocol: "TCP",
    service: "PostgreSQL",
    version: "13.4",
    state: "open",
    risk: "medium",
    description: "Database port. Ensure authentication is enforced and network access is restricted.",
    banner: "PostgreSQL 13.4",
  },
];

export const mockMisconfigs: Misconfiguration[] = [
  {
    id: "m1",
    title: "Telnet Service Active",
    description: "Telnet transmits data in plaintext including usernames and passwords.",
    port: 23,
    service: "Telnet",
    risk: "critical",
    affected: "192.168.1.10",
    fix: "Disable Telnet immediately. Use SSH for secure remote access. Run: systemctl disable telnet",
  },
  {
    id: "m2",
    title: "RDP Exposed to Internet",
    description: "Remote Desktop Protocol is accessible from external networks without VPN.",
    port: 3389,
    service: "RDP",
    risk: "critical",
    affected: "192.168.1.15",
    fix: "Restrict RDP access to VPN or specific IPs only. Enable Network Level Authentication (NLA).",
  },
  {
    id: "m3",
    title: "FTP Using Plaintext Auth",
    description: "FTP does not encrypt login credentials or data in transit.",
    port: 21,
    service: "FTP",
    risk: "high",
    affected: "192.168.1.10",
    fix: "Replace FTP with SFTP or FTPS. If FTP must be used, enforce strong passwords and restrict IPs.",
  },
  {
    id: "m4",
    title: "MySQL Accessible Remotely",
    description: "MySQL database port is accessible from external hosts.",
    port: 3306,
    service: "MySQL",
    risk: "high",
    affected: "192.168.1.12",
    fix: "Bind MySQL to 127.0.0.1 in my.cnf. Use SSH tunneling for remote database access.",
  },
  {
    id: "m5",
    title: "SMB EternalBlue Risk",
    description: "SMBv1 enabled — vulnerable to the EternalBlue exploit used by WannaCry ransomware.",
    port: 445,
    service: "SMB",
    risk: "high",
    affected: "192.168.1.18",
    fix: "Disable SMBv1. Apply MS17-010 patch. Block port 445 at perimeter firewall.",
  },
  {
    id: "m6",
    title: "HTTP Without TLS",
    description: "Web server running on port 80 without HTTPS redirect.",
    port: 80,
    service: "HTTP",
    risk: "medium",
    affected: "192.168.1.10",
    fix: "Redirect all HTTP traffic to HTTPS. Configure HSTS header. Obtain a TLS certificate (Let's Encrypt).",
  },
  {
    id: "m7",
    title: "Outdated SSH Version",
    description: "OpenSSH 7.4 has known user enumeration vulnerability (CVE-2018-15473).",
    port: 22,
    service: "SSH",
    risk: "medium",
    affected: "192.168.1.10",
    fix: "Update OpenSSH to latest version. Disable password authentication, use SSH keys only.",
  },
  {
    id: "m8",
    title: "Tomcat Manager Exposed",
    description: "Apache Tomcat manager interface may be accessible on port 8080.",
    port: 8080,
    service: "HTTP-Alt",
    risk: "medium",
    affected: "192.168.1.14",
    fix: "Restrict Tomcat manager access to localhost. Change default credentials. Update to latest Tomcat.",
  },
];

export const mockScanResult: ScanResult = {
  id: "scan_001",
  target: "192.168.1.0/24",
  scanType: "Quick Scan",
  timestamp: "2026-04-02T09:15:00Z",
  duration: "4m 32s",
  totalPorts: 1024,
  openPorts: 12,
  filteredPorts: 45,
  closedPorts: 967,
  servicesDetected: 12,
  misconfigurations: 8,
  riskScore: 34,
  ports: mockPorts,
  misconfigs: mockMisconfigs,
};

export const mockScheduledScans: ScheduledScan[] = [
  {
    id: "sched_1",
    name: "Daily Network Check",
    target: "192.168.1.0/24",
    frequency: "Daily",
    nextRun: "Tomorrow at 02:00 AM",
    lastRun: "Today at 02:00 AM",
    active: true,
    scanType: "Quick Scan",
  },
  {
    id: "sched_2",
    name: "Weekly Deep Scan",
    target: "10.0.0.0/16",
    frequency: "Weekly",
    nextRun: "Sun at 11:00 PM",
    lastRun: "Last Sunday",
    active: true,
    scanType: "Deep Scan",
  },
  {
    id: "sched_3",
    name: "Production Server",
    target: "172.16.0.50",
    frequency: "Every 6 hours",
    nextRun: "In 2 hours",
    lastRun: "4 hours ago",
    active: false,
    scanType: "Custom Scan",
  },
];

export const mockAlerts: Alert[] = [
  {
    id: "a1",
    title: "Critical: Telnet Detected",
    description: "Telnet service found open on 192.168.1.10:23. Immediate action required.",
    target: "192.168.1.10",
    risk: "critical",
    timestamp: "2 min ago",
    read: false,
    port: 23,
    service: "Telnet",
  },
  {
    id: "a2",
    title: "Critical: RDP Exposed",
    description: "RDP port 3389 is accessible from external network on 192.168.1.15.",
    target: "192.168.1.15",
    risk: "critical",
    timestamp: "15 min ago",
    read: false,
    port: 3389,
    service: "RDP",
  },
  {
    id: "a3",
    title: "High: Database Port Open",
    description: "MySQL port 3306 is accessible from the network on 192.168.1.12.",
    target: "192.168.1.12",
    risk: "high",
    timestamp: "1 hr ago",
    read: false,
    port: 3306,
    service: "MySQL",
  },
  {
    id: "a4",
    title: "High: SMB Vulnerability",
    description: "SMBv1 enabled on 192.168.1.18. EternalBlue exploit risk.",
    target: "192.168.1.18",
    risk: "high",
    timestamp: "2 hrs ago",
    read: true,
    port: 445,
    service: "SMB",
  },
  {
    id: "a5",
    title: "Medium: Outdated SSH",
    description: "OpenSSH 7.4 detected on 192.168.1.10. User enumeration vulnerability.",
    target: "192.168.1.10",
    risk: "medium",
    timestamp: "3 hrs ago",
    read: true,
    port: 22,
    service: "SSH",
  },
  {
    id: "a6",
    title: "Medium: HTTP Without TLS",
    description: "Port 80 serving HTTP without redirect to HTTPS.",
    target: "192.168.1.10",
    risk: "medium",
    timestamp: "5 hrs ago",
    read: true,
    port: 80,
    service: "HTTP",
  },
  {
    id: "a7",
    title: "Low: DNS Zone Transfer",
    description: "DNS server may allow unrestricted zone transfers.",
    target: "192.168.1.1",
    risk: "low",
    timestamp: "Yesterday",
    read: true,
    port: 53,
    service: "DNS",
  },
  {
    id: "a8",
    title: "Scan Complete",
    description: "192.168.1.0/24 scan completed. 12 open ports, 8 misconfigurations found.",
    target: "192.168.1.0/24",
    risk: "info",
    timestamp: "Yesterday",
    read: true,
  },
];

export const mockScanHistory = [
  {
    id: "h1",
    target: "192.168.1.0/24",
    scanType: "Quick Scan",
    timestamp: "Apr 2, 2026 – 09:15 AM",
    duration: "4m 32s",
    openPorts: 12,
    misconfigurations: 8,
    riskScore: 34,
    devices: 8,
  },
  {
    id: "h2",
    target: "10.0.0.1",
    scanType: "Deep Scan",
    timestamp: "Apr 1, 2026 – 11:00 PM",
    duration: "12m 18s",
    openPorts: 5,
    misconfigurations: 2,
    riskScore: 68,
    devices: 1,
  },
  {
    id: "h3",
    target: "172.16.0.0/16",
    scanType: "Custom Scan",
    timestamp: "Mar 31, 2026 – 03:00 AM",
    duration: "28m 44s",
    openPorts: 34,
    misconfigurations: 17,
    riskScore: 22,
    devices: 23,
  },
  {
    id: "h4",
    target: "192.168.0.50",
    scanType: "Quick Scan",
    timestamp: "Mar 30, 2026 – 10:30 AM",
    duration: "1m 05s",
    openPorts: 3,
    misconfigurations: 0,
    riskScore: 88,
    devices: 1,
  },
  {
    id: "h5",
    target: "10.10.10.0/24",
    scanType: "Deep Scan",
    timestamp: "Mar 28, 2026 – 08:00 PM",
    duration: "19m 52s",
    openPorts: 21,
    misconfigurations: 11,
    riskScore: 45,
    devices: 14,
  },
  {
    id: "h6",
    target: "192.168.1.100",
    scanType: "Custom Scan",
    timestamp: "Mar 27, 2026 – 02:00 AM",
    duration: "7m 30s",
    openPorts: 8,
    misconfigurations: 4,
    riskScore: 55,
    devices: 1,
  },
];

export const riskColors: Record<RiskLevel, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#22c55e",
  info: "#3b82f6",
};

export const riskBgClasses: Record<RiskLevel, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  low: "bg-green-500/15 text-green-400 border-green-500/30",
  info: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};
