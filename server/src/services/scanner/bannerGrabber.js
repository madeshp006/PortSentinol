import net from "node:net";
import tls from "node:tls";

/**
 * Parses raw banner string or HTTP response headers to extract software product & version.
 */
export function parseBanner(banner = "", port = 0, service = "") {
  const cleanBanner = String(banner || "").trim();
  if (!cleanBanner) {
    return {
      product: "Unknown",
      version: "Unknown",
      confidence: "inferred",
      banner: "",
    };
  }

  // 1. SSH Banners
  // e.g. "SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.6" or "SSH-2.0-dropbear_2020.81"
  if (cleanBanner.startsWith("SSH-") || port === 22 || service === "ssh") {
    const sshMatch = cleanBanner.match(/SSH-\d+\.\d+-([A-Za-z0-9_\-\.]+)/i);
    if (sshMatch) {
      const rawProductStr = sshMatch[1];
      if (rawProductStr.includes("OpenSSH")) {
        const verMatch = rawProductStr.match(/OpenSSH[_\-\/]?([0-9a-z\.]+)/i);
        return {
          product: "OpenSSH",
          version: verMatch ? verMatch[1] : "Unknown",
          confidence: "banner-grabbed",
          banner: cleanBanner.slice(0, 200),
        };
      }
      if (rawProductStr.toLowerCase().includes("dropbear")) {
        const verMatch = rawProductStr.match(/dropbear[_\-\/]?([0-9\.]+)/i);
        return {
          product: "Dropbear SSH",
          version: verMatch ? verMatch[1] : "Unknown",
          confidence: "banner-grabbed",
          banner: cleanBanner.slice(0, 200),
        };
      }
      if (rawProductStr.toLowerCase().includes("libssh")) {
        const verMatch = rawProductStr.match(/libssh[_\-\/]?([0-9\.]+)/i);
        return {
          product: "libssh",
          version: verMatch ? verMatch[1] : "Unknown",
          confidence: "banner-grabbed",
          banner: cleanBanner.slice(0, 200),
        };
      }
      const parts = rawProductStr.split(/[_\-\/]/);
      return {
        product: parts[0] || "SSH",
        version: parts[1] || "Unknown",
        confidence: "banner-grabbed",
        banner: cleanBanner.slice(0, 200),
      };
    }
  }

  // 2. HTTP / HTTPS (Server header or body)
  const serverHeaderMatch = cleanBanner.match(/Server:\s*([^\r\n]+)/i);
  if (serverHeaderMatch) {
    const serverVal = serverHeaderMatch[1].trim();
    if (serverVal.match(/Apache\/([0-9a-z\.]+)/i)) {
      const m = serverVal.match(/Apache\/([0-9a-z\.]+)/i);
      return {
        product: "Apache HTTP Server",
        version: m[1],
        confidence: "banner-grabbed",
        banner: cleanBanner.slice(0, 200),
      };
    }
    if (serverVal.match(/nginx\/([0-9a-z\.]+)/i)) {
      const m = serverVal.match(/nginx\/([0-9a-z\.]+)/i);
      return {
        product: "Nginx",
        version: m[1],
        confidence: "banner-grabbed",
        banner: cleanBanner.slice(0, 200),
      };
    }
    if (serverVal.match(/Microsoft-IIS\/([0-9\.]+)/i)) {
      const m = serverVal.match(/Microsoft-IIS\/([0-9\.]+)/i);
      return {
        product: "Microsoft IIS",
        version: m[1],
        confidence: "banner-grabbed",
        banner: cleanBanner.slice(0, 200),
      };
    }
    if (serverVal.match(/Werkzeug\/([0-9a-z\.]+)/i)) {
      const m = serverVal.match(/Werkzeug\/([0-9a-z\.]+)/i);
      return {
        product: "Werkzeug (Python)",
        version: m[1],
        confidence: "banner-grabbed",
        banner: cleanBanner.slice(0, 200),
      };
    }
    if (serverVal.match(/lighttpd\/([0-9a-z\.]+)/i)) {
      const m = serverVal.match(/lighttpd\/([0-9a-z\.]+)/i);
      return {
        product: "lighttpd",
        version: m[1],
        confidence: "banner-grabbed",
        banner: cleanBanner.slice(0, 200),
      };
    }
    if (serverVal.match(/Caddy/i)) {
      return {
        product: "Caddy Web Server",
        version: "Unknown",
        confidence: "banner-grabbed",
        banner: cleanBanner.slice(0, 200),
      };
    }
    // Generic Server header value splitting product/version
    const serverParts = serverVal.split(" ")[0].split("/");
    return {
      product: serverParts[0] || "HTTP Server",
      version: serverParts[1] || "Unknown",
      confidence: "banner-grabbed",
      banner: cleanBanner.slice(0, 200),
    };
  }

  // 3. FTP Banners
  if (cleanBanner.includes("220") || port === 21 || service === "ftp") {
    if (cleanBanner.match(/vsFTPd\s*([0-9\.]+)/i)) {
      const m = cleanBanner.match(/vsFTPd\s*([0-9\.]+)/i);
      return { product: "vsftpd", version: m[1], confidence: "banner-grabbed", banner: cleanBanner.slice(0, 200) };
    }
    if (cleanBanner.match(/ProFTPD\s*([0-9a-z\.]+)/i)) {
      const m = cleanBanner.match(/ProFTPD\s*([0-9a-z\.]+)/i);
      return { product: "ProFTPD", version: m[1], confidence: "banner-grabbed", banner: cleanBanner.slice(0, 200) };
    }
    if (cleanBanner.match(/Pure-FTPd/i)) {
      return { product: "Pure-FTPd", version: "Unknown", confidence: "banner-grabbed", banner: cleanBanner.slice(0, 200) };
    }
    if (cleanBanner.match(/FileZilla Server\s*([0-9\.]+)/i)) {
      const m = cleanBanner.match(/FileZilla Server\s*([0-9\.]+)/i);
      return { product: "FileZilla Server", version: m[1], confidence: "banner-grabbed", banner: cleanBanner.slice(0, 200) };
    }
  }

  // 4. SMTP Banners
  if (cleanBanner.includes("ESMTP") || cleanBanner.includes("Postfix") || port === 25 || port === 587 || service === "smtp") {
    if (cleanBanner.match(/Postfix/i)) {
      return { product: "Postfix SMTP", version: "Unknown", confidence: "banner-grabbed", banner: cleanBanner.slice(0, 200) };
    }
    if (cleanBanner.match(/Exim\s*([0-9\.]+)/i)) {
      const m = cleanBanner.match(/Exim\s*([0-9\.]+)/i);
      return { product: "Exim SMTP", version: m[1], confidence: "banner-grabbed", banner: cleanBanner.slice(0, 200) };
    }
    if (cleanBanner.match(/Sendmail\s*([0-9\.]+)/i)) {
      const m = cleanBanner.match(/Sendmail\s*([0-9\.]+)/i);
      return { product: "Sendmail", version: m[1], confidence: "banner-grabbed", banner: cleanBanner.slice(0, 200) };
    }
    if (cleanBanner.match(/MailHog/i)) {
      return { product: "MailHog", version: "Unknown", confidence: "banner-grabbed", banner: cleanBanner.slice(0, 200) };
    }
  }

  // 5. Redis
  if (cleanBanner.includes("redis_version:") || port === 6379 || service === "redis") {
    const redisVerMatch = cleanBanner.match(/redis_version:([0-9\.]+)/i);
    if (redisVerMatch) {
      return { product: "Redis", version: redisVerMatch[1], confidence: "banner-grabbed", banner: cleanBanner.slice(0, 200) };
    }
  }

  // 6. MySQL / MariaDB
  if (cleanBanner.match(/([0-9\.]+)-MariaDB/i)) {
    const m = cleanBanner.match(/([0-9\.]+)-MariaDB/i);
    return { product: "MariaDB", version: m[1], confidence: "banner-grabbed", banner: cleanBanner.slice(0, 200) };
  }
  if (cleanBanner.match(/mysql/i) || port === 3306 || service === "mysql") {
    const myMatch = cleanBanner.match(/([58]\.[0-9\.]+)/);
    if (myMatch) {
      return { product: "MySQL", version: myMatch[1], confidence: "banner-grabbed", banner: cleanBanner.slice(0, 200) };
    }
  }

  // 7. POP3 / IMAP
  if (cleanBanner.match(/Dovecot/i)) {
    return { product: "Dovecot", version: "Unknown", confidence: "banner-grabbed", banner: cleanBanner.slice(0, 200) };
  }

  // 8. General version regex fallback (e.g., "Product 1.2.3" or "Product/1.2.3")
  const genMatch = cleanBanner.match(/([A-Za-z0-9_\-]+)[\/\s]([0-9]+\.[0-9]+(?:\.[0-9]+)?(?:[a-z0-9\-]+)?)/i);
  if (genMatch && !["http", "html", "tcp", "get", "post", "head"].includes(genMatch[1].toLowerCase())) {
    return {
      product: genMatch[1],
      version: genMatch[2],
      confidence: "banner-grabbed",
      banner: cleanBanner.slice(0, 200),
    };
  }

  return {
    product: "Unknown",
    version: "Unknown",
    confidence: cleanBanner.length > 0 ? "banner-grabbed" : "inferred",
    banner: cleanBanner.slice(0, 200),
  };
}

/**
 * Connects to target host:port and performs protocol-specific active probing & banner grabbing.
 */
export async function grabBanner(host, port, service = "", timeoutMs = 1200) {
  const isHttps = port === 443 || port === 8443 || service === "https" || service === "https-alt";
  const isHttp = port === 80 || port === 8080 || port === 3000 || port === 5000 || service === "http" || service === "http-alt";

  return new Promise((resolve) => {
    let socket;
    let settled = false;
    let rawData = "";

    const finish = (bannerText = "") => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {}
      const result = parseBanner(bannerText || rawData, port, service);
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish(rawData);
    }, timeoutMs);

    const onData = (chunk) => {
      rawData += chunk.toString("utf8");
      if (rawData.length > 500 || rawData.includes("\r\n\r\n") || rawData.includes("\n")) {
        clearTimeout(timer);
        finish(rawData);
      }
    };

    const onError = () => finish(rawData);

    if (isHttps) {
      socket = tls.connect(
        port,
        host,
        {
          rejectUnauthorized: false,
          timeout: timeoutMs,
          servername: net.isIP(host) ? undefined : host,
        },
        () => {
          socket.write(`HEAD / HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: PortSentinel/1.0\r\nConnection: close\r\n\r\n`);
        }
      );
      socket.on("data", onData);
      socket.on("error", onError);
      socket.on("timeout", onError);
      return;
    }

    socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.on("data", onData);
    socket.on("error", onError);
    socket.on("timeout", onError);

    socket.connect(port, host, () => {
      if (isHttp) {
        socket.write(`HEAD / HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: PortSentinel/1.0\r\nConnection: close\r\n\r\n`);
      } else if (port === 6379 || service === "redis") {
        socket.write("INFO Server\r\n");
      } else {
        // Send a newline after 300ms if server hasn't broadcasted banner automatically
        setTimeout(() => {
          if (!settled && !rawData) {
            try {
              socket.write("\r\n");
            } catch {}
          }
        }, 300);
      }
    });
  });
}
