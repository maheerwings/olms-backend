import { catchAsyncError } from "../middlewares/catchAsyncErrorMiddleware.js";
import ErrorHandler from "../middlewares/errorMiddleware.js";
import { Book } from "../models/bookModel.js";
import { validateFields } from "../utils/validateFields.js";

// Add a new book (Admin Route)
export const addBook = catchAsyncError(async (req, res, next) => {
  const { title, author, description, price, quantity } = req.body;

  const validateFieldsError = validateFields({
    title,
    author,
    description,
    price,
    quantity,
  });
  if (validateFieldsError) {
    return next(new ErrorHandler(validateFieldsError, 400));
  }
  const book = await Book.create({
    title,
    author,
    description,
    price,
    quantity,
  });
  res.status(201).json({
    success: true,
    message: "Book added successfully.",
    book,
  });
});

// Get all books
export const getAllBooks = catchAsyncError(async (req, res, next) => {
  const books = await Book.find().lean();
  res.status(200).json({
    success: true,
    books,
  });
});

export const deleteBook = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const book = await Book.findByIdAndDelete(id);
  if (!book) {
    return next(new ErrorHandler("Book not found.", 404));
  }
  res.status(200).json({
    success: true,
    message: "Book deleted successfully.",
  });
});
