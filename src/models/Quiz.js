const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionId: String,
  question: String,
  options: [String],
  correctAnswer: String,
  points: Number
});

const submissionSchema = new mongoose.Schema({
  responses: [{
    questionId: String,
    userResponse: String
  }],
  score: Number,
  submittedAt: { type: Date, default: Date.now }
});

const quizSchema = new mongoose.Schema({
  userId: String,
  grade: Number,
  subject: String,
  questions: [questionSchema],
  totalPoints: Number,
  submissions: [submissionSchema],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Quiz', quizSchema);
