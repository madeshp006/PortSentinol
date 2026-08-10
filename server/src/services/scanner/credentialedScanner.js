import { Client } from "ssh2";

function executeSshCommand(conn, command, timeoutMs = 4000) {
  return new Promise((resolve) => {
    let output = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(output.trim());
      }
    }, timeoutMs);

    conn.exec(command, (err, stream) => {
      if (err) {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          resolve("");
        }
        return;
      }

      stream
        .on("data", (data) => {
          output += data.toString("utf8");
        })
        .stderr.on("data", (data) => {
          output += data.toString("utf8");
        })
        .on("close", () => {
          clearTimeout(timer);
          if (!settled) {
            settled = true;
            resolve(output.trim());
          }
        });
    });
  });
}

function testSingleSshCredential(host, port, username, password, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const conn = new Client();
    let settled = false;

    const finish = (result) => {
      if (!settled) {
        settled = true;
        try { conn.end(); } catch {}
        resolve(result);
      }
    };

    const timer = setTimeout(() => finish(false), timeoutMs);

    conn
      .on("ready", () => finish(true))
      .on("error", () => finish(false))
      .on("timeout", () => finish(false));

    try {
      conn.connect({
        host,
        port: Number(port || 22),
        username,
        password,
        readyTimeout: timeoutMs,
      });
    } catch {
      finish(false);
    }
  });
}

/**
 * Runs authenticated SSH security checks on a target host.
 * Returns array of structured credentialed findings.
 */
export async function runCredentialedSshChecks({ host, port = 22, credentials = {}, options = {} }) {
  const { username, password, privateKey } = credentials.ssh || credentials || {};

  if (!host || (!password && !privateKey)) {
    return [];
  }

  const findings = [];
  const conn = new Client();

  const connectPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      conn.end();
      reject(new Error("SSH connection timed out"));
    }, 6000);

    conn
      .on("ready", () => {
        clearTimeout(timer);
        resolve(conn);
      })
      .on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });

    try {
      const connectOpts = {
        host,
        port: Number(port || 22),
        username: username || "root",
        readyTimeout: 5000,
      };
      if (privateKey) {
        connectOpts.privateKey = privateKey;
      } else if (password) {
        connectOpts.password = password;
      }
      conn.connect(connectOpts);
    } catch (err) {
      clearTimeout(timer);
      reject(err);
    }
  });

  let activeConn = null;
  try {
    activeConn = await connectPromise;
  } catch (err) {
    console.warn(`[credentialedScanner] SSH authentication failed for ${host}:${port}:`, err.message);
    // Return graceful finding logging failed authentication without retries
    return [
      {
        code: "CRED-SSH-AUTH-FAILED",
        title: "Authenticated SSH Audit Connection Failed",
        severity: "medium",
        checkType: "credentialed_check",
        source: "authenticated_ssh",
        port: Number(port || 22),
        service: "ssh",
        product: "SSH Server",
        version: "Unknown",
        description: `Failed to authenticate to ${host}:${port} using supplied SSH credentials (${err.message}).`,
        recommendation: "Verify SSH username, password/private key, and target firewall permissions.",
        riskDetails: {
          compositeScore: 0.35,
          scoringMethod: "credentialed_audit",
          note: "SSH authentication check failed",
        },
      },
    ];
  }

  try {
    // 1. Audit PasswordAuthentication setting in sshd_config
    const passAuthOutput = await executeSshCommand(
      activeConn,
      'grep -E -i "^PasswordAuthentication\\s+" /etc/ssh/sshd_config || echo "PasswordAuthentication yes"'
    );
    if (passAuthOutput.toLowerCase().includes("yes") || !passAuthOutput.toLowerCase().includes("no")) {
      findings.push({
        code: "CRED-SSH-PASS-AUTH",
        title: "SSH Password Authentication Enabled",
        severity: "medium",
        checkType: "credentialed_check",
        source: "authenticated_ssh",
        port: Number(port || 22),
        service: "ssh",
        product: "OpenSSH",
        version: "Unknown",
        description: "SSH daemon allows password-based authentication. Public key authentication is recommended to prevent brute-force attacks.",
        recommendation: "Set 'PasswordAuthentication no' in /etc/ssh/sshd_config and enforce SSH public key authentication.",
        riskDetails: {
          compositeScore: 0.40,
          scoringMethod: "credentialed_audit",
          note: "internal sshd_config audit finding",
        },
      });
    }

    // 2. Audit PermitRootLogin setting in sshd_config
    const rootLoginOutput = await executeSshCommand(
      activeConn,
      'grep -E -i "^PermitRootLogin\\s+" /etc/ssh/sshd_config || echo "PermitRootLogin yes"'
    );
    if (rootLoginOutput.toLowerCase().includes("yes") || rootLoginOutput.toLowerCase().includes("without-password")) {
      findings.push({
        code: "CRED-SSH-ROOT-LOGIN",
        title: "SSH Direct Root Login Permitted (PermitRootLogin)",
        severity: "high",
        checkType: "credentialed_check",
        source: "authenticated_ssh",
        port: Number(port || 22),
        service: "ssh",
        product: "OpenSSH",
        version: "Unknown",
        description: "SSH configuration permits direct root user authentication on target host.",
        recommendation: "Set 'PermitRootLogin no' or 'PermitRootLogin prohibit-password' in /etc/ssh/sshd_config and restart sshd.",
        riskDetails: {
          compositeScore: 0.65,
          scoringMethod: "credentialed_audit",
          note: "internal sshd_config audit finding",
        },
      });
    }

    // 3. Audit sensitive file permissions (/etc/shadow, /etc/passwd, /etc/sudoers)
    const filePermsOutput = await executeSshCommand(activeConn, "ls -l /etc/shadow /etc/passwd /etc/sudoers 2>/dev/null");
    if (filePermsOutput.includes("rwxrwxrwx") || filePermsOutput.includes("rw-rw-rw-") || filePermsOutput.includes("-rw-r--r-- 1 root root") === false && filePermsOutput.includes("shadow")) {
      const isShadowWorldReadable = filePermsOutput.match(/-rw-[rwx-]{4}r/);
      if (isShadowWorldReadable || filePermsOutput.includes("shadow")) {
        findings.push({
          code: "CRED-FILE-PERM-SHADOW",
          title: "Overly Permissive File Permissions on /etc/shadow",
          severity: "high",
          checkType: "credentialed_check",
          source: "authenticated_ssh",
          port: Number(port || 22),
          service: "ssh",
          product: "Linux Security",
          version: "Unknown",
          description: "Internal permission audit detected readable or permissive file attributes on /etc/shadow.",
          recommendation: "Restrict /etc/shadow permissions immediately: run 'chmod 600 /etc/shadow' and set owner to root.",
          riskDetails: {
            compositeScore: 0.70,
            scoringMethod: "credentialed_audit",
            note: "internal Linux file permissions check",
          },
        });
      }
    }

    // 4. Audit running SSH daemon version
    const sshVersionOutput = await executeSshCommand(activeConn, "sshd -V 2>&1 || ssh -V 2>&1");
    if (sshVersionOutput) {
      const verMatch = sshVersionOutput.match(/OpenSSH[_\-\/]?([0-9a-z\.]+)/i);
      if (verMatch) {
        const detectedVer = verMatch[1];
        findings.push({
          code: "CRED-SSH-VERSION-VERIFIED",
          title: `Verified OpenSSH Daemon Version (${detectedVer})`,
          severity: "low",
          checkType: "credentialed_check",
          source: "authenticated_ssh",
          port: Number(port || 22),
          service: "ssh",
          product: "OpenSSH",
          version: detectedVer,
          description: `Internal authenticated check verified running SSH daemon version: OpenSSH ${detectedVer}.`,
          recommendation: "Ensure SSH daemon is regularly patched and updated via package manager.",
          riskDetails: {
            compositeScore: 0.15,
            scoringMethod: "credentialed_audit",
            note: "internal authenticated version check",
          },
        });
      }
    }

    activeConn.end();
  } catch (err) {
    console.warn(`[credentialedScanner] Error running SSH checks on ${host}:`, err.message);
    try { activeConn.end(); } catch {}
  }

  // 5. OPTIONAL: Weak Credential Test (Only if explicitly enabled by user)
  if (options.enableWeakCredsCheck === true) {
    const DEFAULT_PAIRS = [
      { u: "admin", p: "admin" },
      { u: "root", p: "root" },
      { u: "ubuntu", p: "ubuntu" },
      { u: "admin", p: "password123" },
    ];

    for (const pair of DEFAULT_PAIRS) {
      // Don't test if it matches user's provided credentials
      if (pair.u === username && pair.p === password) continue;

      const success = await testSingleSshCredential(host, port, pair.u, pair.p, 2500);
      if (success) {
        findings.push({
          code: "CRED-WEAK-DEFAULT-CREDS",
          title: `Default / Weak SSH Credentials Accepted (${pair.u}:${pair.p})`,
          severity: "critical",
          checkType: "credentialed_check",
          source: "authenticated_ssh",
          port: Number(port || 22),
          service: "ssh",
          product: "SSH Server",
          version: "Unknown",
          description: `Target SSH service accepts weak default credentials (${pair.u}:${pair.p}).`,
          recommendation: "Change default user passwords immediately using passwd command and enforce strong password policies.",
          riskDetails: {
            compositeScore: 0.95,
            scoringMethod: "credentialed_audit",
            note: "weak credential check finding",
          },
        });
        break; // Stop on first weak credential match to prevent lockouts
      }
    }
  }

  return findings;
}
