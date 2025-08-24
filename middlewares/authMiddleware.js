import { catchAsyncError } from "./catchAsyncErrorMiddleware.js";
import ErrorHandler from "./errorMiddleware.js";
import jwt from "jsonwebtoken";
import { User } from "../models/userModel.js";

export const isAuthenticated = catchAsyncError(async (req, res, next) => {
  const { token } = req.cookies;
  if (!token) {
    return next(new ErrorHandler("User is not authenticated.", 401));
  }
  const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

  req.user = await User.findById(decoded.id).select(
    "-resetPasswordToken -resetPasswordExpire -verificationCodeExpire -verificationCode"
  );

  if (!req.user) {
    return next(new ErrorHandler("User not found.", 404));
  }

  next();
});

export const isAuthorized = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorHandler(
          `User with this role(${req.user.role}) not allowed to access this resource`
        )
      );
    }
    next();
  };
};
