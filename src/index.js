require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const auth = require('./middleware/auth');
const Quiz = require('./models/Quiz');
const { generateQuiz, getHint, evaluateResponses, generateImprovementSuggestions } = require('./utils/groq');
const { sendQuizResults } = require('./utils/email');
const cache = require('./utils/cache');

const app = express();
app.use(express.json());
app.use(cors());

// Initialize cache connection - with better error handling
(async () => {
  try {
    await cache.connect();
    // The connect method will handle logging
  } catch (err) {
    // This shouldn't happen with our improved error handling in cache.js
    console.error('Unexpected cache initialization error:', err.message);
  }
})();

// MongoDB connection 
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

// Authentication endpoint 
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '24h' });
  res.json({ 
    success: true, 
    token,
    message: 'Login successful' 
  });
});

// Update other endpoints to properly handle authorization
app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    res.status(401).json({ error: 'Invalid token' });
  }
  next(err);
});

// Generate new quiz
app.post('/quiz/generate', auth, async (req, res) => {
  try {
    const { grade, subject, totalQuestions, maxScore, difficulty } = req.body;
    const quizData = await generateQuiz(grade, subject, totalQuestions, maxScore, difficulty);
    
    const quiz = new Quiz({
      userId: req.user.username,
      grade,
      subject,
      questions: quizData.questions,
      totalPoints: quizData.totalPoints
    });
    
    await quiz.save();
    res.json({
      success: true,
      quiz: {
        id: quiz._id,
        grade,
        subject,
        questions: quiz.questions.map(q => ({
          questionId: q._id,
          question: q.question,
          options: q.options
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit quiz answers
app.post('/quiz/:id/submit', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ 
        error: 'Invalid quiz ID format. Please use the ID from the quiz generation response.',
        example: 'quiz/507f1f77bcf86cd799439011/submit'
      });
    }

    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const { responses } = req.body;
    if (!responses || !Array.isArray(responses)) {
      return res.status(400).json({ 
        error: 'Please provide an array of responses' 
      });
    }    const result = await evaluateResponses(quiz, responses);
    
    // Save submission record
    quiz.submissions.push({
      responses,
      score: result.totalScore,
      submittedAt: new Date()
    });
    
    await quiz.save();
    
    // Check if email notification is requested
    const { sendEmail, email } = req.body;
    
    if (sendEmail) {
      try {
        // Use galanimeghji@gmail.com as default if no email provided but sendEmail is true
        const recipientEmail = email || 'galanimeghji@gmail.com';
        
        // Generate improvement suggestions
        const correctAnswers = {};
        quiz.questions.forEach(q => {
          correctAnswers[q._id] = q.correctAnswer;
        });
        
        // Send email notification asynchronously (don't wait for it to complete)
        sendQuizResults({
          to: recipientEmail,
          subject: quiz.subject,
          grade: quiz.grade,
          score: result.totalScore,
          totalPoints: quiz.totalPoints,
          questions: quiz.questions,
          responses: responses,
          correctAnswers: correctAnswers
        })
          .then(emailResult => {
            console.log(`Email notification sent to ${recipientEmail} with suggestions`);
          })
          .catch(emailError => {
            console.error('Failed to send email notification:', emailError);
          });
          
        // Add email notification status to the response
        result.emailNotification = {
          status: 'sending',
          message: `Email notification is being sent to ${recipientEmail}`
        };
      } catch (emailError) {
        console.error('Error preparing email notification:', emailError);
        result.emailNotification = {
          status: 'failed',
          message: 'Failed to prepare email notification'
        };
      }
    }
    
    res.json(result);
  } catch (error) {
    console.error('Quiz submission error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid quiz ID format' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get quiz history
app.get('/quiz/history', auth, async (req, res) => {
  try {
    const { grade, subject, from, to } = req.query;
    const cacheKey = `quiz_history_${req.user.username}_${grade}_${subject}_${from}_${to}`;
    
    // Build the database query first, to reuse in case of cache miss
    let query = { userId: req.user.username };
    if (grade) query.grade = Number(grade) || grade;
    if (subject) query.subject = subject;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }
    
    // Use a try-catch inside the main handler to isolate cache errors
    let cachedResult = null;
    try {
      // Try to get from cache first
      cachedResult = await cache.get(cacheKey);
      if (cachedResult) {
        return res.json(cachedResult);
      }
    } catch (cacheError) {
      // Log but continue with database query
      console.log('Cache retrieval failed:', cacheError.message);
    }

    // Fetch from the database
    const quizzes = await Quiz.find(query);
    
    // Try to cache the result but don't let cache errors affect the response
    try {
      await cache.set(cacheKey, quizzes, 300); // Cache for 5 minutes
    } catch (cacheError) {
      console.log('Cache storage failed:', cacheError.message);
    }
    
    res.json(quizzes);
  } catch (error) {
    console.error('Quiz history error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get hint for a question
app.post('/quiz/hint', auth, async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ 
        error: 'Please provide a question in the request body',
        example: {
          question: "What is the formula for calculating the area of a circle?"
        }
      });
    }

    const hint = await getHint(question);
    res.json({ hint });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Retry a quiz
app.post('/quiz/:id/retry', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ 
        error: 'Invalid quiz ID format',
        example: 'quiz/507f1f77bcf86cd799439011/retry'
      });
    }

    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    // Check if quiz belongs to the user
    if (quiz.userId !== req.user.username) {
      return res.status(403).json({ error: 'You do not have permission to retry this quiz' });
    }

    // Return the quiz questions without answers to retry
    res.json({
      success: true,
      quizRetry: {
        id: quiz._id,
        grade: quiz.grade,
        subject: quiz.subject,
        questions: quiz.questions.map(q => ({
          questionId: q._id,
          question: q.question,
          options: q.options
        })),
        previousSubmissions: quiz.submissions.length,
        previousBestScore: quiz.submissions.length > 0 
          ? Math.max(...quiz.submissions.map(s => s.score))
          : 0
      }
    });
  } catch (error) {
    console.error('Quiz retry error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid quiz ID format' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to send email notification for a specific quiz submission
app.post('/quiz/:id/email-results', auth, async (req, res) => {
  try {
    const { id } = req.params;
    // Use galanimeghji@gmail.com as default if no email is provided
    const { email = 'galanimeghji@gmail.com', submissionIndex = -1 } = req.body;
    
    // Validate email
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ 
        error: 'Please provide a valid email address' 
      });
    }
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ 
        error: 'Invalid quiz ID format'
      });
    }

    // Fetch quiz data
    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    // Check if quiz belongs to the user
    if (quiz.userId !== req.user.username) {
      return res.status(403).json({ error: 'You do not have permission to access this quiz' });
    }

    // Determine which submission to use
    const submissionCount = quiz.submissions.length;
    if (submissionCount === 0) {
      return res.status(400).json({ error: 'No submissions found for this quiz' });
    }
    
    // Use latest submission if submissionIndex is -1, otherwise use the specified index
    const subIndex = submissionIndex === -1 ? submissionCount - 1 : submissionIndex;
    if (subIndex < 0 || subIndex >= submissionCount) {
      return res.status(400).json({ 
        error: 'Invalid submission index',
        available: submissionCount
      });
    }
    
    const submission = quiz.submissions[subIndex];
    
    // Prepare data for email
    const correctAnswers = {};
    quiz.questions.forEach(q => {
      correctAnswers[q._id] = q.correctAnswer;
    });
      // Send email and handle the improved response
    sendQuizResults({
      to: email,
      subject: quiz.subject,
      grade: quiz.grade,
      score: submission.score,
      totalPoints: quiz.totalPoints,
      questions: quiz.questions,
      responses: submission.responses,
      correctAnswers
    })
      .then(emailResult => {
        if (emailResult.success) {
          console.log(`Email notification sent for quiz ${id} to ${email} with ID: ${emailResult.messageId}`);
        } else {
          console.error(`Failed to send email to ${email}: ${emailResult.error} (Code: ${emailResult.code})`);
        }
      })
      .catch(emailError => {
        console.error('Unexpected error during email sending:', emailError);
      });
    
    res.json({
      success: true,
      message: `Quiz results are being sent to ${email}`,
      submissionDate: submission.submittedAt,
      score: submission.score,
      totalPoints: quiz.totalPoints
    });
  } catch (error) {
    console.error('Email notification error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to view a specific submission
app.get('/quiz/:id/submissions/:submissionIndex', auth, async (req, res) => {
  try {
    const { id, submissionIndex } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ 
        error: 'Invalid quiz ID format'
      });
    }

    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    // Check if quiz belongs to the user
    if (quiz.userId !== req.user.username) {
      return res.status(403).json({ error: 'You do not have permission to view this quiz' });
    }

    const submissionIdx = parseInt(submissionIndex);
    if (isNaN(submissionIdx) || submissionIdx < 0 || submissionIdx >= quiz.submissions.length) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const submission = quiz.submissions[submissionIdx];
    
    // Map the submission responses with question details for better context
    const detailedResponses = submission.responses.map(response => {
      const question = quiz.questions.find(q => 
        q._id.toString() === response.questionId || 
        q.questionId === response.questionId
      );
      
      return {
        questionId: response.questionId,
        question: question ? question.question : 'Question not found',
        userResponse: response.userResponse,
        correctAnswer: question ? question.correctAnswer : 'Unknown',
        isCorrect: question ? (question.correctAnswer === response.userResponse) : false,
        points: question ? question.points : 0
      };
    });

    res.json({
      submissionDate: submission.submittedAt,
      score: submission.score,
      totalPoints: quiz.totalPoints,
      percentage: (submission.score / quiz.totalPoints) * 100,
      responses: detailedResponses
    });
  } catch (error) {
    console.error('Submission retrieval error:', error);
    res.status(500).json({ error: error.message });
  }
});

// List all submissions for a quiz
app.get('/quiz/:id/submissions', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ 
        error: 'Invalid quiz ID format'
      });
    }

    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    // Check if quiz belongs to the user
    if (quiz.userId !== req.user.username) {
      return res.status(403).json({ error: 'You do not have permission to view this quiz' });
    }

    const submissions = quiz.submissions.map((submission, index) => ({
      submissionId: index,
      submittedAt: submission.submittedAt,
      score: submission.score,
      totalPoints: quiz.totalPoints,
      percentage: (submission.score / quiz.totalPoints) * 100
    }));

    res.json({
      quizId: quiz._id,
      subject: quiz.subject,
      grade: quiz.grade,
      submissions: submissions
    });
  } catch (error) {
    console.error('Submissions list error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;

// Improve error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: err.message 
  });
});

// Create server with error handling
const server = app.listen(PORT, (err) => {
  if (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
  console.log(`Server is running on port ${PORT}`);
});

// Handle server errors
server.on('error', (err) => {
  console.error('Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  }
});
