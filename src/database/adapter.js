// Database adapter module
// This allows switching between MongoDB and SQL databases

const mongoose = require('mongoose');
const { Pool } = require('pg'); // Example using PostgreSQL
const QuizModel = require('../models/Quiz');

class DatabaseAdapter {
  constructor() {
    this.type = process.env.DB_TYPE || 'mongo'; // 'mongo' or 'sql'
    this.connected = false;
    this.sqlClient = null;
  }

  async connect() {
    if (this.type === 'mongo') {
      try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');
        this.connected = true;
      } catch (err) {
        console.error('MongoDB connection error:', err);
        throw err;
      }
    } else if (this.type === 'sql') {
      try {
        // Connect to SQL database (PostgreSQL example)
        this.sqlClient = new Pool({
          connectionString: process.env.SQL_URI,
        });
        await this.sqlClient.query('SELECT NOW()'); // Test the connection
        console.log('Connected to SQL Database');
        this.connected = true;
      } catch (err) {
        console.error('SQL Database connection error:', err);
        throw err;
      }
    } else {
      throw new Error(`Unsupported database type: ${this.type}`);
    }
  }

  async createQuiz(quizData) {
    if (!this.connected) await this.connect();
    
    if (this.type === 'mongo') {
      const quiz = new QuizModel(quizData);
      await quiz.save();
      return quiz;
    } else {
      // SQL implementation
      const client = await this.sqlClient.connect();
      try {
        await client.query('BEGIN');
        
        // Insert quiz record
        const quizId = this.generateUUID();
        const quizResult = await client.query(
          'INSERT INTO quizzes (quiz_id, user_id, grade, subject, total_points) VALUES ($1, $2, $3, $4, $5) RETURNING quiz_id',
          [quizId, quizData.userId, quizData.grade, quizData.subject, quizData.totalPoints]
        );
        
        // Insert questions and options
        for (const question of quizData.questions) {
          const questionId = this.generateUUID();
          await client.query(
            'INSERT INTO questions (question_id, quiz_id, question_text, correct_answer, points) VALUES ($1, $2, $3, $4, $5)',
            [questionId, quizId, question.question, question.correctAnswer, question.points]
          );
          
          // Insert options
          for (let i = 0; i < question.options.length; i++) {
            await client.query(
              'INSERT INTO options (option_id, question_id, option_text, option_order) VALUES ($1, $2, $3, $4)',
              [this.generateUUID(), questionId, question.options[i], i]
            );
          }
        }
        
        await client.query('COMMIT');
        
        // Return the created quiz in a format compatible with the MongoDB model
        return {
          _id: quizId,
          ...quizData,
          submissions: []
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  }

  async findQuizById(id) {
    if (!this.connected) await this.connect();
    
    if (this.type === 'mongo') {
      return QuizModel.findById(id);
    } else {
      // SQL implementation
      const client = await this.sqlClient.connect();
      try {
        // Get quiz
        const quizResult = await client.query('SELECT * FROM quizzes WHERE quiz_id = $1', [id]);
        if (quizResult.rows.length === 0) return null;
        
        const quiz = quizResult.rows[0];
        
        // Get questions
        const questionsResult = await client.query('SELECT * FROM questions WHERE quiz_id = $1', [id]);
        const questions = [];
        
        for (const questionRow of questionsResult.rows) {
          // Get options
          const optionsResult = await client.query(
            'SELECT option_text FROM options WHERE question_id = $1 ORDER BY option_order',
            [questionRow.question_id]
          );
          
          const options = optionsResult.rows.map(row => row.option_text);
          
          questions.push({
            _id: questionRow.question_id,
            question: questionRow.question_text,
            options,
            correctAnswer: questionRow.correct_answer,
            points: questionRow.points
          });
        }
        
        // Get submissions
        const submissionsResult = await client.query('SELECT * FROM submissions WHERE quiz_id = $1', [id]);
        const submissions = [];
        
        for (const submissionRow of submissionsResult.rows) {
          // Get responses
          const responsesResult = await client.query(
            'SELECT * FROM responses WHERE submission_id = $1',
            [submissionRow.submission_id]
          );
          
          const responses = responsesResult.rows.map(row => ({
            questionId: row.question_id,
            userResponse: row.user_response
          }));
          
          submissions.push({
            _id: submissionRow.submission_id,
            responses,
            score: submissionRow.score,
            submittedAt: submissionRow.submitted_at
          });
        }
        
        return {
          _id: quiz.quiz_id,
          userId: quiz.user_id,
          grade: quiz.grade,
          subject: quiz.subject,
          questions,
          totalPoints: quiz.total_points,
          submissions,
          createdAt: quiz.created_at
        };
      } finally {
        client.release();
      }
    }
  }

  async getQuizHistory(query) {
    if (!this.connected) await this.connect();
    
    if (this.type === 'mongo') {
      return QuizModel.find(query).sort({ createdAt: -1 });
    } else {
      // SQL implementation
      const client = await this.sqlClient.connect();
      try {
        let sqlQuery = 'SELECT * FROM quizzes WHERE user_id = $1';
        const params = [query.userId];
        
        if (query.grade) {
          sqlQuery += ' AND grade = $' + (params.length + 1);
          params.push(query.grade);
        }
        
        if (query.subject) {
          sqlQuery += ' AND subject = $' + (params.length + 1);
          params.push(query.subject);
        }
        
        if (query.createdAt && query.createdAt.$gte) {
          sqlQuery += ' AND created_at >= $' + (params.length + 1);
          params.push(query.createdAt.$gte);
        }
        
        if (query.createdAt && query.createdAt.$lte) {
          sqlQuery += ' AND created_at <= $' + (params.length + 1);
          params.push(query.createdAt.$lte);
        }
        
        sqlQuery += ' ORDER BY created_at DESC';
        
        const result = await client.query(sqlQuery, params);
        
        // Transform to MongoDB-compatible format
        return Promise.all(result.rows.map(async row => {
          return this.findQuizById(row.quiz_id);
        }));
      } finally {
        client.release();
      }
    }
  }

  async saveSubmission(quizId, submission) {
    if (!this.connected) await this.connect();
    
    if (this.type === 'mongo') {
      const quiz = await QuizModel.findById(quizId);
      if (!quiz) return null;
      
      quiz.submissions.push(submission);
      await quiz.save();
      return quiz;
    } else {
      // SQL implementation
      const client = await this.sqlClient.connect();
      try {
        await client.query('BEGIN');
        
        // Get quiz
        const quizResult = await client.query('SELECT * FROM quizzes WHERE quiz_id = $1', [quizId]);
        if (quizResult.rows.length === 0) return null;
        
        const quiz = quizResult.rows[0];
        
        // Insert submission
        const submissionId = this.generateUUID();
        await client.query(
          'INSERT INTO submissions (submission_id, quiz_id, user_id, score, submitted_at) VALUES ($1, $2, $3, $4, $5)',
          [submissionId, quizId, quiz.user_id, submission.score, submission.submittedAt || new Date()]
        );
        
        // Insert responses
        for (const response of submission.responses) {
          await client.query(
            'INSERT INTO responses (response_id, submission_id, question_id, user_response) VALUES ($1, $2, $3, $4)',
            [this.generateUUID(), submissionId, response.questionId, response.userResponse]
          );
        }
        
        await client.query('COMMIT');
        
        // Return the updated quiz
        return this.findQuizById(quizId);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  }

  // Helper method to generate UUID for SQL implementations
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  async disconnect() {
    if (this.type === 'mongo') {
      await mongoose.disconnect();
    } else if (this.sqlClient) {
      await this.sqlClient.end();
    }
    this.connected = false;
  }
}

module.exports = new DatabaseAdapter();
