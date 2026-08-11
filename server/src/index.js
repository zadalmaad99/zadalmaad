import express from "express";
import cors from "cors";
import studentsRouter from "./routes/students.js";
import recordsRouter from "./routes/records.js";

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

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`quran-tracker-server listening on ${port}`);
});
