import { User } from "../models/userModel.js";
import { catchAsyncError } from "../middlewares/catchAsyncErrorMiddleware.js";
import ErrorHandler from "../middlewares/errorMiddleware.js";
import bcrypt from "bcrypt";
import { v2 as cloudinary } from "cloudinary";
import { validateFields } from "../utils/validateFields.js";
import { validatePassword } from "../utils/validatePassword.js";

export const getAllUsers = catchAsyncError(async (req, res, next) => {
  const users = await User.find().lean();
  res.status(200).json({
    success: true,
    users,
  });
});

export const registerNewAdmin = catchAsyncError(async (req, res, next) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return next(new ErrorHandler("Admin avatar is required.", 400));
  }
  const { name, email, password } = req.body;

  const validateFieldsError = validateFields({ name, email, password });
  if (validateFieldsError)
    return next(new ErrorHandler(validateFieldsError, 400));

  const isRegistered = await User.findOne({ email });
  if (isRegistered) {
    return next(new ErrorHandler("User already exists.", 400));
  }

  const validatePasswordError = validatePassword(password);
  if (validatePasswordError)
    return next(new ErrorHandler(validatePasswordError, 400));

  const { avatar } = req.files;
  const allowedFormats = ["image/png", "image/jpeg", "image/webp"];
  if (!allowedFormats.includes(avatar.mimetype)) {
    return next(new ErrorHandler("File format not supported.", 400));
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const cloudinaryResponse = await cloudinary.uploader.upload(
    avatar.tempFilePath,
    {
      folder: "LIBRARY_MANAGEMENT_SYSTEM_ADMINS",
    }
  );
  if (!cloudinaryResponse || cloudinaryResponse.error) {
    console.error(
      "Cloudinary error:",
      cloudinaryResponse.error || "Unknown cloudinary error."
    );
    return next(
      new ErrorHandler("Failed to upload profile image to cloudinary.", 500)
    );
  }
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role: "Admin",
    accountVerified: true,
    avatar: {
      public_id: cloudinaryResponse.public_id,
      url: cloudinaryResponse.secure_url,
    },
  });
  res.status(201).json({
    success: true,
    message: "Admin registered successfully.",
    user,
  });
});
