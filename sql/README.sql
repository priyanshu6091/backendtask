-- Explanation of SQL Schema for AI Quizzer

-- This file documents the SQL schema design for the AI Quizzer application
-- and explains how it maps to the MongoDB collections.

/*
MongoDB to SQL Schema Mapping
-----------------------------

The AI Quizzer application is primarily designed using MongoDB, but this SQL schema 
provides an alternative implementation that maintains the same functionality.

Here's how the schema maps between MongoDB and SQL:

1. MongoDB Collection: Quiz
   SQL Tables: quizzes, questions, options, submissions, responses

2. MongoDB Document Structure:
   {
     _id: ObjectID,
     userId: String,
     grade: Number,
     subject: String,
     questions: [
       {
         _id: ObjectID,
         question: String,
         options: [String],
         correctAnswer: String,
         points: Number
       }
     ],
     totalPoints: Number,
     submissions: [
       {
         responses: [
           {
             questionId: String,
             userResponse: String
           }
         ],
         score: Number,
         submittedAt: Date
       }
     ],
     createdAt: Date
   }

3. SQL Schema Representation:
   - quizzes: Stores basic quiz information
   - questions: Stores individual questions related to quizzes
   - options: Stores answer options for each question
   - submissions: Stores submission attempts for quizzes
   - responses: Stores individual question responses within submissions

4. Integration Strategy:
   The database adapter.js file provides an abstraction layer that allows the application
   to work with either MongoDB or SQL seamlessly. It implements equivalent operations for
   both database types and maintains a consistent API for the rest of the application.
*/

-- Database Schema
-- ------------------------------

-- Users table
-- Stores user information for authentication
CREATE TABLE IF NOT EXISTS users (
  user_id VARCHAR(255) PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quizzes table
-- Stores basic quiz information
CREATE TABLE IF NOT EXISTS quizzes (
  quiz_id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  grade INTEGER NOT NULL,
  subject VARCHAR(255) NOT NULL,
  total_points INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Questions table
-- Stores individual questions related to quizzes
CREATE TABLE IF NOT EXISTS questions (
  question_id VARCHAR(36) PRIMARY KEY,
  quiz_id VARCHAR(36) NOT NULL,
  question_text TEXT NOT NULL,
  correct_answer VARCHAR(255) NOT NULL,
  points INTEGER NOT NULL,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id) ON DELETE CASCADE
);

-- Options table
-- Stores answer options for each question
CREATE TABLE IF NOT EXISTS options (
  option_id VARCHAR(36) PRIMARY KEY,
  question_id VARCHAR(36) NOT NULL,
  option_text VARCHAR(255) NOT NULL,
  option_order INTEGER NOT NULL,
  FOREIGN KEY (question_id) REFERENCES questions(question_id) ON DELETE CASCADE
);

-- Submissions table
-- Stores submission attempts for quizzes
CREATE TABLE IF NOT EXISTS submissions (
  submission_id VARCHAR(36) PRIMARY KEY,
  quiz_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  score INTEGER NOT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Responses table
-- Stores individual question responses within submissions
CREATE TABLE IF NOT EXISTS responses (
  response_id VARCHAR(36) PRIMARY KEY,
  submission_id VARCHAR(36) NOT NULL,
  question_id VARCHAR(36) NOT NULL,
  user_response VARCHAR(255) NOT NULL,
  FOREIGN KEY (submission_id) REFERENCES submissions(submission_id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(question_id)
);

-- Indexes for optimization
-- ------------------------------

-- Indexes for quizzes table
CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_subject ON quizzes(subject);
CREATE INDEX IF NOT EXISTS idx_quizzes_grade ON quizzes(grade);
CREATE INDEX IF NOT EXISTS idx_quizzes_created_at ON quizzes(created_at);

-- Indexes for questions table
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);

-- Indexes for options table
CREATE INDEX IF NOT EXISTS idx_options_question_id ON options(question_id);

-- Indexes for submissions table
CREATE INDEX IF NOT EXISTS idx_submissions_quiz_id ON submissions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);

-- Indexes for responses table
CREATE INDEX IF NOT EXISTS idx_responses_submission_id ON responses(submission_id);
CREATE INDEX IF NOT EXISTS idx_responses_question_id ON responses(question_id);

-- Notes on Database Implementation
-- ------------------------------
/*
1. UUID Generation:
   The SQL implementation uses UUID strings for primary keys to maintain compatibility 
   with MongoDB's ObjectID approach.

2. Foreign Keys:
   - Foreign key constraints ensure data integrity
   - CASCADE deletes are used for dependent records to maintain consistency

3. Indexes:
   - Indexes are created on commonly queried fields to improve performance
   - Composite indexes are used for complex filtering scenarios

4. Performance Considerations:
   - The SQL schema design prioritizes query efficiency for the most common operations:
     a) Quiz retrieval with questions and options
     b) Submission history retrieval
     c) Filtering quizzes by subject, grade, or date range
*/
