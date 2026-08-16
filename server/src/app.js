import express from "express";
import cors from "cors";
import studentsRouter from "./routes/students.js";
import recordsRouter from "./routes/records.js";
import hadithRecordsRouter from "./routes/hadithRecords.js";
import attendanceRouter from "./routes/attendance.js";
import khatmatRouter from "./routes/khatmat.js";
import listeningProgressRouter from "./routes/listeningProgress.js";
import registerAdminRouter from "./routes/registerAdmin.js";
import adminsRouter from "./routes/admins.js";

const app = express();

app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || "*")
      .split(",")
      .map((o) => o.trim()),
  })
);
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: Date.now() });
});

app.use("/api/students", studentsRouter);
app.use("/api/records", recordsRouter);
app.use("/api/hadith-records", hadithRecordsRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/khatmat", khatmatRouter);
app.use("/api/listening-progress", listeningProgressRouter);
app.use("/api/register-admin", registerAdminRouter);
app.use("/api/admins", adminsRouter);

app.use((req, res) => {
  res.status(404).json({ error: "not found" });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  if (err?.code === 5 || err?.code === "not-found") {
    return res.status(404).json({ error: "not found" });
  }
  res.status(500).json({ error: "internal server error" });
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

export default app;
