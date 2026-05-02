const mongoose = require("mongoose");

console.log(process.env.MONGODB_URI);

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing in environment variables.");
  }

  await mongoose.connect(uri);

  // eslint-disable-next-line no-console
  console.log("MongoDB connected successfully.");

}

module.exports = connectDB;
