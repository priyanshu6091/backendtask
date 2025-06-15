-- Seed data for AI Quizzer SQL database
-- This file contains sample data that can be used for testing

-- Sample Users
INSERT INTO users (user_id, username) VALUES 
('user1', 'testuser'),
('user2', 'student1');

-- Sample Quiz
INSERT INTO quizzes (quiz_id, user_id, grade, subject, total_points) VALUES
('q1', 'user1', 10, 'Mathematics', 10),
('q2', 'user1', 8, 'Science', 15);

-- Sample Questions for Mathematics Quiz
INSERT INTO questions (question_id, quiz_id, question_text, correct_answer, points) VALUES
('q1q1', 'q1', 'What is the value of π (pi) to two decimal places?', '3.14', 1),
('q1q2', 'q1', 'Solve for x: 2x + 5 = 15', 'x = 5', 1);

-- Sample Options for Mathematics Questions
INSERT INTO options (option_id, question_id, option_text, option_order) VALUES
('q1q1o1', 'q1q1', '3.14', 1),
('q1q1o2', 'q1q1', '3.15', 2),
('q1q1o3', 'q1q1', '3.16', 3),
('q1q1o4', 'q1q1', '3.17', 4),
('q1q2o1', 'q1q2', 'x = 4', 1),
('q1q2o2', 'q1q2', 'x = 5', 2),
('q1q2o3', 'q1q2', 'x = 6', 3),
('q1q2o4', 'q1q2', 'x = 7', 4);

-- Sample Submission
INSERT INTO submissions (submission_id, quiz_id, user_id, score) VALUES
('sub1', 'q1', 'user1', 8);

-- Sample Responses
INSERT INTO responses (response_id, submission_id, question_id, user_response) VALUES
('r1', 'sub1', 'q1q1', '3.14'),
('r2', 'sub1', 'q1q2', 'x = 4');
