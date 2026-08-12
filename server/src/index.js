import express from "express";
import cors from "cors";
import studentsRouter from "./routes/students.js";
import recordsRouter from "./routes/records.js";
import attendanceRouter from "./routes/attendance.js";
import khatmatRouter from "./routes/khatmat.js";

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
app.use("/api/attendance", attendanceRouter);
app.use("/api/khatmat", khatmatRouter);

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

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`quran-tracker-server listening on ${port}`);
});
