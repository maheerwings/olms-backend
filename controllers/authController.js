import { User } from "../models/userModel.js";
import { catchAsyncError } from "../middlewares/catchAsyncErrorMiddleware.js";
import ErrorHandler from "../middlewares/errorMiddleware.js";
import { sendToken } from "../utils/sendToken.js";
import bcrypt from "bcrypt";
import { sendEmail } from "../utils/sendEmail.js";
import crypto from "crypto";
import { generateForgotPasswordEmailTemplate } from "../utils/emailTemplates.js";
import { sendVerificationCode } from "../utils/sendVerificationCode.js";
import { validatePassword } from "../utils/validatePassword.js";
import { validateFields } from "../utils/validateFields.js";

export const register = catchAsyncError(async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    // Validate inputs
    const validationError = validateFields({ name, email, password });
    if (validationError) {
      return next(new ErrorHandler(validationError, 400));
    }
    const isRegistered = await User.findOne({ email, accountVerified: true });
    if (isRegistered) {
      return next(new ErrorHandler("User already exists.", 400));
    }
    const registerationAttemptsByUser = await User.find({
      email,
      accountVerified: false,
    });
    if (registerationAttemptsByUser.length >= 5) {
      return next(
        new ErrorHandler(
          "You have exceeded the maximum number of attempts (5). Please try again after an hour.",
          500
        )
      );
    }

    const passwordValidationError = validatePassword(password);

    if (passwordValidationError) {
      return next(new ErrorHandler(passwordValidationError, 400));
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({ name, email, password: hashedPassword });
    const verificationCode = await user.generateVerificationCode();
    await user.save();
    sendVerificationCode(verificationCode, email, res);
  } catch (error) {
    next(error);
  }
});

export const verifyOTP = catchAsyncError(async (req, res, next) => {
  const { email, otp } = req.body;

  try {
    const userAllEntries = await User.find({
      email,
      accountVerified: false,
    }).sort({ createdAt: -1 });

    if (!userAllEntries) {
      return next(new ErrorHandler("User not found.", 404));
    }
    let user;

    if (userAllEntries.length > 1) {
      user = userAllEntries[0];

      await User.deleteMany({
        _id: { $ne: user._id },
        email,
        accountVerified: false,
      });
    } else {
      user = userAllEntries[0];
    }

    if (user.verificationCode !== Number(otp)) {
      return next(new ErrorHandler("Invalid OTP.", 400));
    }

    const currentTime = Date.now();

    const verificationCodeExpire = new Date(
      user.verificationCodeExpire
    ).getTime();
    if (currentTime > verificationCodeExpire) {
      return next(new ErrorHandler("OTP Expired.", 400));
    }

    user.accountVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpire = null;
    await user.save({ validateModifiedOnly: true });

    sendToken(user, 200, "Account Verified.", res);
  } catch (error) {
    return next(new ErrorHandler("Internal server error.", 500));
  }
});

// Route for login
export const login = catchAsyncError(async (req, res, next) => {
  const { email, password } = req.body;

  const validationError = validateFields({ email, password });
  if (validationError) {
    return next(new ErrorHandler(validationError, 400));
  }

  const user = await User.findOne({ email, accountVerified: true }).select(
    "+password"
  );
  if (!user) {
    return next(new ErrorHandler("Invalid email or password.", 400));
  }

  // Validate password
  const isPasswordMatched = await bcrypt.compare(password, user.password);
  if (!isPasswordMatched) {
    return next(new ErrorHandler("Invalid email or password.", 400));
  }

  sendToken(user, 200, "User login successful.", res);
});

export const logout = catchAsyncError(async (req, res, next) => {
  res
    .status(200)
    .cookie("token", "", {
      expires: new Date(Date.now()),
      httpOnly: true,
    })
    .json({
      success: true,
      message: "Logged out successfully.",
    });
});

export const getUser = catchAsyncError(async (req, res, next) => {
  const user = req.user;
  res.status(200).json({
    success: true,
    user,
  });
});

//FORGOT PASSWORD
export const forgotPassword = catchAsyncError(async (req, res, next) => {
  const user = await User.findOne({
    email: req.body.email,
    accountVerified: true,
  });
  if (!user) {
    return next(new ErrorHandler("User not found.", 404));
  }
  const resetToken = user.getResetPasswordToken();

  await user.save({ validateBeforeSave: false });

  const resetPasswordUrl = `${process.env.FRONTEND_URL}/password/reset/${resetToken}`;

  const message = generateForgotPasswordEmailTemplate(resetPasswordUrl);

  try {
    await sendEmail({
      email: user.email,
      subject: `BookWorm Library Management System Password Recovery`,
      message,
    });
    res.status(201).json({
      success: true,
      message: `Email sent to ${user.email} successfully.`,
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new ErrorHandler(error.message || "Cannot send email.", 500));
  }
});

//RESET PASSWORD
export const resetPassword = catchAsyncError(async (req, res, next) => {
  const { token } = req.params;
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });
  if (!user) {
    return next(
      new ErrorHandler(
        "Reset password token is invalid or has been expired.",
        400
      )
    );
  }

  const passwordValidationError = validatePassword(
    req.body.password,
    req.body.confirmPassword
  );

  if (passwordValidationError) {
    return next(new ErrorHandler(passwordValidationError, 400));
  }
  const hashedPassword = await bcrypt.hash(req.body.password, 10);
  user.password = hashedPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  await user.save();

  sendToken(user, 200, "Password updated successfully.", res);
});

export const updatePassword = catchAsyncError(async (req, res, next) => {
  const user = await User.findById(req.user._id).select("+password");
  if (!user) {
    return next(new ErrorHandler("User not found.", 404));
  }
  const { currentPassword, newPassword, confirmNewPassword } = req.body;
  const validateFieldsError = validateFields({
    currentPassword,
    newPassword,
    confirmNewPassword,
  });
  if (validateFieldsError) {
    return next(new ErrorHandler(validateFieldsError, 400));
  }
  const isPasswordMatched = await bcrypt.compare(
    currentPassword,
    user.password
  );

  if (!isPasswordMatched) {
    return next(new ErrorHandler("Current password is incorrect.", 400));
  }
  const passwordValidationError = validatePassword(
    newPassword,
    confirmNewPassword
  );
  if (passwordValidationError) {
    return next(new ErrorHandler(passwordValidationError, 400));
  }
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  await user.save();
  res.status(200).json({
    success: true,
    message: "Password updated.",
  });
});
