import net from "node:net";
import process from "node:process";

/**
 * PortSentinel Automated Decoy Sensor CLI
 * Runs on any host (Parrot OS, Ubuntu, Raspberry Pi, Laptop) to trap network probes
 * and automatically report live threat intelligence to your Cloud Backend.
 */

const BACKEND_URL = process.env.BACKEND_URL || "https://portsentinel-backend.onrender.com";
const PORTS = {
  ssh: Number(process.env.SSH_PORT || 2222),
  ftp: Number(process.env.FTP_PORT || 2121),
  http: Number(process.env.HTTP_PORT || 8080),
};

console.log("=================================================");
console.log("🛡️  PortSentinel Automated Decoy Sensor CLI");
console.log(`🌐 Cloud Backend: ${BACKEND_URL}`);
console.log("=================================================");

async function reportProbeToCloud(probeData) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/decoys/simulate-probe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(probeData),
    });
    if (res.ok) {
      console.log(`[+] 🚀 Probe alert reported live to Render Cloud Backend!`);
    } else {
      console.log(`[-] Backend responded with status: ${res.status}`);
    }
  } catch (err) {
    console.error(`[-] Cloud reporting error: ${err.message}`);
  }
}

function startSshSensor() {
  const server = net.createServer((socket) => {
    const sourceIp = socket.remoteAddress?.replace(/^.*:/, "") || "127.0.0.1";
    const sourcePort = socket.remotePort || 0;

    console.log(`\n🚨 [SSH TRAP HIT] Probe from ${sourceIp}:${sourcePort} on port ${PORTS.ssh}`);
    socket.write("SSH-2.0-OpenSSH_7.2p2 Ubuntu-4ubuntu2.8\r\n");

    let buffer = "";
    socket.on("data", (data) => {
      buffer += data.toString("utf8");
      const userMatch = buffer.match(/(root|admin|professor[^\s]*|user[^\s]*|[a-zA-Z0-9_-]{3,15})/i);
      const user = userMatch ? userMatch[1] : "admin";

      reportProbeToCloud({
        type: "ssh",
        port: PORTS.ssh,
        sourceIp,
        sourcePort,
        attemptedUser: user,
        attemptedPass: "********",
      });

      socket.write("\r\nAccess denied. Permission denied (publickey,password).\r\n");
      socket.end();
    });
  });

  server.listen(PORTS.ssh, "0.0.0.0", () => {
    console.log(`[✓] Fake SSH Trap listening on 0.0.0.0:${PORTS.ssh}`);
  });
}

function startFtpSensor() {
  const server = net.createServer((socket) => {
    const sourceIp = socket.remoteAddress?.replace(/^.*:/, "") || "127.0.0.1";
    const sourcePort = socket.remotePort || 0;

    console.log(`\n🚨 [FTP TRAP HIT] Probe from ${sourceIp}:${sourcePort} on port ${PORTS.ftp}`);
    socket.write("220 (vsFTPd 2.3.4)\r\n");

    socket.on("data", (data) => {
      const text = data.toString("utf8");
      const userMatch = text.match(/USER\s+([^\r\n]+)/i);
      const user = userMatch ? userMatch[1] : "anonymous";

      reportProbeToCloud({
        type: "ftp",
        port: PORTS.ftp,
        sourceIp,
        sourcePort,
        attemptedUser: user,
        attemptedPass: "guest@local",
      });

      socket.write("530 Login incorrect.\r\n");
      socket.end();
    });
  });

  server.listen(PORTS.ftp, "0.0.0.0", () => {
    console.log(`[✓] Fake FTP Trap listening on 0.0.0.0:${PORTS.ftp}`);
  });
}

function startHttpSensor() {
  const server = net.createServer((socket) => {
    const sourceIp = socket.remoteAddress?.replace(/^.*:/, "") || "127.0.0.1";
    const sourcePort = socket.remotePort || 0;

    console.log(`\n🚨 [HTTP TRAP HIT] Probe from ${sourceIp}:${sourcePort} on port ${PORTS.http}`);

    reportProbeToCloud({
      type: "http",
      port: PORTS.http,
      sourceIp,
      sourcePort,
      attemptedUser: "http_client",
      attemptedPass: "GET /",
    });

    socket.write("HTTP/1.1 200 OK\r\nServer: Apache/2.4.7 (Ubuntu)\r\nContent-Type: text/html\r\n\r\n<html><body><h1>PortSentinel Security Gateway</h1></body></html>\r\n");
    socket.end();
  });

  server.listen(PORTS.http, "0.0.0.0", () => {
    console.log(`[✓] Fake HTTP Trap listening on 0.0.0.0:${PORTS.http}`);
  });
}

startSshSensor();
startFtpSensor();
startHttpSensor();
