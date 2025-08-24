import express from "express";
import { config } from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import { connection } from "./database/db.js";
import { errorMiddleware } from "./middlewares/errorMiddleware.js";
import fileUpload from "express-fileupload";
import authRouter from "./routes/authRoutes.js";
import borrowRouter from "./routes/borrowRoutes.js";
import bookRouter from "./routes/bookRoutes.js";
import userRouter from "./routes/userRoutes.js";
import { notifyUsers } from "./services/notifyUsers.js";
import { removeUnverifiedAccounts } from "./services/removeUnverifiedAccounts.js";

export const app = express();
config({ path: "./config/config.env" });

app.use(
  cors({
    origin: [process.env.FRONTEND_URL],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
  })
);

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/borrow", borrowRouter);
app.use("/api/v1/book", bookRouter);
app.use("/api/v1/user", userRouter);

notifyUsers();
removeUnverifiedAccounts();
connection();

// ✅ Root route for sanity check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Backend API is live 🚀" });
});

// ✅ Catch-all 404 route for undefined paths
app.all("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found on this server`,
  });
});


app.use(errorMiddleware);
