-- AI Quizzer SQL Schema
-- This file defines the database schema for the AI Quizzer application
-- Compatible with PostgreSQL, MySQL and SQLite

-- Create Users table (if needed for future auth implementation)
CREATE TABLE IF NOT EXISTS users (
  user_id VARCHAR(255) PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
  quiz_id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  grade INTEGER NOT NULL,
  subject VARCHAR(255) NOT NULL,
  total_points INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Create Questions table
CREATE TABLE IF NOT EXISTS questions (
  question_id VARCHAR(36) PRIMARY KEY,
  quiz_id VARCHAR(36) NOT NULL,
  question_text TEXT NOT NULL,
  correct_answer VARCHAR(255) NOT NULL,
  points INTEGER NOT NULL,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id) ON DELETE CASCADE
);

-- Create Options table
CREATE TABLE IF NOT EXISTS options (
  option_id VARCHAR(36) PRIMARY KEY,
  question_id VARCHAR(36) NOT NULL,
  option_text VARCHAR(255) NOT NULL,
  option_order INTEGER NOT NULL,
  FOREIGN KEY (question_id) REFERENCES questions(question_id) ON DELETE CASCADE
);

-- Create Submissions table
CREATE TABLE IF NOT EXISTS submissions (
  submission_id VARCHAR(36) PRIMARY KEY,
  quiz_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  score INTEGER NOT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Create Responses table
CREATE TABLE IF NOT EXISTS responses (
  response_id VARCHAR(36) PRIMARY KEY,
  submission_id VARCHAR(36) NOT NULL,
  question_id VARCHAR(36) NOT NULL,
  user_response VARCHAR(255) NOT NULL,
  FOREIGN KEY (submission_id) REFERENCES submissions(submission_id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(question_id)
);

-- Index for faster quiz history retrieval
CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_subject ON quizzes(subject);
CREATE INDEX IF NOT EXISTS idx_quizzes_grade ON quizzes(grade);
CREATE INDEX IF NOT EXISTS idx_quizzes_created_at ON quizzes(created_at);

-- Index for faster submission retrieval
CREATE INDEX IF NOT EXISTS idx_submissions_quiz_id ON submissions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_responses_submission_id ON responses(submission_id);
