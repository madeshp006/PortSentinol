import http from "http";
import https from "https";

export async function runLoadTestScenario({ url, method = "GET", payload = null, headers = {} }) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const parsedUrl = new URL(url);
    const transport = parsedUrl.protocol === "https:" ? https : http;

    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: {
        "User-Agent": "PortSentinel-LoadTest-Engine/1.0",
        "Content-Type": "application/json",
        ...headers,
      },
    };

    const req = transport.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const duration = Date.now() - startTime;
        resolve({
          statusCode: res.statusCode,
          duration,
          success: res.statusCode >= 200 && res.statusCode < 400,
          responseSize: data.length,
        });
      });
    });

    req.on("error", (err) => {
      resolve({
        statusCode: 0,
        duration: Date.now() - startTime,
        success: false,
        error: err.message,
      });
    });

    if (payload) {
      req.write(typeof payload === "object" ? JSON.stringify(payload) : payload);
    }
    req.end();
  });
}
