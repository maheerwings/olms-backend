import express from "express";
import {
  isAuthenticated,
  isAuthorized,
} from "../middlewares/authMiddleware.js";
import {
  getAllUsers,
  registerNewAdmin,
} from "../controllers/userController.js";

const router = express.Router();

router.get("/all", isAuthenticated, isAuthorized("Admin"), getAllUsers);
router.post(
  "/register/new-admin",
  isAuthenticated,
  isAuthorized("Admin"),
  registerNewAdmin
);

export default router;
