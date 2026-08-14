// Real load test: signs in a number of test accounts (from
// loadtest-accounts.json), then sends concurrent real write requests
// (attendance/listening-progress) to the backend, to measure at what point
// performance actually starts to degrade.
//
// Usage (from inside the server folder):
//   node scripts/loadTestWrites.js

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const accounts = JSON.parse(
  readFileSync(join(__dirname, "loadtest-accounts.json"), "utf8")
).filter((a) => a.ok);

const API_KEY = "AIzaSyAdPQ8qaxcFqNXBAhf-sAKcxqugJE1Dw20"; // Firebase apiKey - public, not secret
const API_URL = "https://quran-tracker-xh2q.onrender.com";
const LEVELS = [10, 50, 100, 250, 500, 1000];

async function signIn(account) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: account.email,
        password: account.password,
        returnSecureToken: true,
      }),
    }
  );
  const data = await res.json();
  if (!data.idToken) throw new Error(`sign-in failed for ${account.email}: ${JSON.stringify(data)}`);
  return data.idToken;
}

async function writeAttendance(account, token) {
  const start = Date.now();
  try {
    const res = await fetch(`${API_URL}/api/listening-progress`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        studentId: account.uid,
        book: "loadtest-book",
        sheikh: "loadtest-sheikh",
        progressPercent: Math.floor(Math.random() * 100),
        downloaded: false,
      }),
    });
    const ms = Date.now() - start;
    return { ok: res.ok, status: res.status, ms };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - start, err: e.message };
  }
}

async function runLevel(n, tokens) {
  const subset = accounts.slice(0, n).map((a, i) => ({ a, token: tokens[i] }));
  const start = Date.now();
  const results = await Promise.all(subset.map(({ a, token }) => writeAttendance(a, token)));
  const totalMs = Date.now() - start;
  const okCount = results.filter((r) => r.ok).length;
  const failCount = n - okCount;
  const latencies = results.map((r) => r.ms).sort((a, b) => a - b);
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const max = latencies[latencies.length - 1];
  console.log(
    `n=${n}\ttotal=${totalMs}ms\tok=${okCount}\tfail=${failCount}\tavg=${avg.toFixed(0)}ms\tp50=${p50}ms\tp95=${p95}ms\tmax=${max}ms`
  );
  if (failCount > 0) {
    const sample = results.find((r) => !r.ok);
    console.log("   sample failure:", sample.status, sample.err || "");
  }
  return { n, okCount, failCount };
}

(async () => {
  if (accounts.length < 1000) {
    console.log(`Warning: only ${accounts.length} accounts available (less than 1000)`);
  }

  console.log("Signing in with all accounts (may take a minute)...");
  const tokens = [];
  const CHUNK = 20;
  for (let i = 0; i < accounts.length; i += CHUNK) {
    const chunk = accounts.slice(i, i + CHUNK);
    const chunkTokens = await Promise.all(
      chunk.map((a) => signIn(a).catch(() => null))
    );
    tokens.push(...chunkTokens);
    process.stdout.write(`\r${tokens.length}/${accounts.length}`);
  }
  console.log("");
  const signedInCount = tokens.filter(Boolean).length;
  console.log(`Signed in successfully: ${signedInCount}/${accounts.length}`);

  console.log("\n--- Starting concurrent write test (real attendance writes) ---");
  for (const n of LEVELS) {
    if (n > signedInCount) {
      console.log(`Skipping n=${n} (fewer signed-in accounts available)`);
      continue;
    }
    const r = await runLevel(n, tokens);
    if (r.failCount / r.n > 0.2) {
      console.log(`>> Failure rate exceeded 20% at n=${n}, stopping ramp-up`);
      break;
    }
    await new Promise((res) => setTimeout(res, 1500));
  }
})();
