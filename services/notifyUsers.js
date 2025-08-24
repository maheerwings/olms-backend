import cron from "node-cron";
import { Borrow } from "../models/borrowModel.js";
import { sendEmail } from "../utils/sendEmail.js";
import { User } from "../models/userModel.js";

// --------- IMPORTANT NOTE ---------
// You cannot use await in forEach loop. You can use for...of loop instead.

export const notifyUsers = () => {
  cron.schedule("*/1 * * * *", async () => {
    // Send notifications to users
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const borrowers = await Borrow.find({
        dueDate: {
          $lt: oneDayAgo,
        },
        returnDate: null,
        notified: false,
      });
      for (const element of borrowers) {
        if (element.user && element.user.email) {
          const user = await User.findById(element.user.id);
          sendEmail({
            email: element.user.email,
            subject: "Book Return Reminder",
            message: `Hello ${element.user.name},\n\nThis is a reminder that 
            the book you borrowed is due for return today. Please return 
            the book to the library as soon as possible.\n\nThank you.`,
          });
          element.notified = true;
          await element.save();
        }
      }
    } catch (error) {
      console.error("SOME ERROR OCCURED WHILE NOTIFYING USERS", error);
    }
  });
};
