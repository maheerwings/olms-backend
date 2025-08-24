import { catchAsyncError } from "../middlewares/catchAsyncErrorMiddleware.js";
import ErrorHandler from "../middlewares/errorMiddleware.js";
import { Book } from "../models/bookModel.js";
import { Borrow } from "../models/borrowModel.js";
import { User } from "../models/userModel.js";
import { calculateFine } from "../utils/fineCalculator.js";

// Record borrowed book
export const recordBorrowedBook = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const { email } = req.body;

  const [book, user] = await Promise.all([
    Book.findById(id),
    User.findOne({ email: email.trim() }),
  ]);

  if (!book) return next(new ErrorHandler("Book not found.", 404));
  if (!user) return next(new ErrorHandler("User not found.", 404));
  const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  if (book.quantity === 0) {
    return next(new ErrorHandler("Book not available.", 400));
  }
  const isAlreadyBorrowed = user.borrowedBooks.find(
    (b) => b.bookId.toString() === id && b.returned === false
  );
  if (isAlreadyBorrowed) {
    return next(new ErrorHandler("Book already borrowed.", 400));
  }
  book.quantity -= 1;
  book.availability = book.quantity > 0;
  await book.save();

  user.borrowedBooks.push({
    bookId: book._id,
    bookTitle: book.title,
    borrowedDate: new Date(),
    dueDate,
  });
  await user.save();
  await Borrow.create({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
    },
    book: book._id,
    dueDate,
    price: book.price,
  });
  res.status(200).json({
    success: true,
    message: "Borrowed book recorded successfully.",
  });
});

// Return borrowed book
export const returnBorrowBook = catchAsyncError(async (req, res, next) => {
  const { bookId } = req.params;
  const { email } = req.body;

  const [book, user] = await Promise.all([
    Book.findById(bookId),
    User.findOne({ email: email.trim() }),
  ]);

  if (!book) return next(new ErrorHandler("Book not found.", 404));
  if (!user) return next(new ErrorHandler("User not found.", 404));

  const borrowedBook = user.borrowedBooks.find(
    (b) => b.bookId.toString() === bookId && b.returned === false
  );
  if (!borrowedBook) {
    return next(new ErrorHandler("Book not borrowed.", 400));
  }
  // Update the user's borrowedBooks and set its returned value to true
  borrowedBook.returned = true;
  //Now save your user
  await user.save();
  //Now increase the quantity of the book and set its availability to true
  book.quantity += 1;
  book.availability = book.quantity > 0;
  await book.save();
  //Now find the borrowed book in the Borrow model and update it
  const borrow = await Borrow.findOne({
    book: bookId,
    "user.email": email,
    returnDate: null,
  });
  if (!borrow) {
    return next(new ErrorHandler("Book not borrowed.", 404));
  }
  borrow.returnDate = new Date();
  const fine = calculateFine(borrow.dueDate);
  borrow.fine = fine;
  await borrow.save();

  const message =
    fine !== 0
      ? `The book has been returned successfully. The total charges, including a fine, are $${
          fine + book.price
        }.`
      : `The book has been returned successfully. The total charges are $${book.price}.`;

  res.status(200).json({
    success: true,
    message,
  });
});

// Get all borrowed books (User Route)
export const borrowedBooks = catchAsyncError(async (req, res, next) => {
  const { borrowedBooks } = req.user;
  res.status(200).json({
    success: true,
    borrowedBooks,
  });
});

//Get all books that are borrowed by users (Admin Route)
export const getBorrowedBooksByAdmin = catchAsyncError(
  async (req, res, next) => {
    const borrowedBooks = await Borrow.find().lean()
    res.status(200).json({
      success: true,
      borrowedBooks,
    });
  }
);
