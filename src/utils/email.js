const nodemailer = require('nodemailer');
const { generateImprovementSuggestions } = require('./groq');

// Create a transporter with SMTP or other transport
const createTransporter = () => {
  // For development/testing, use a test account
  // For production, use environment variables for real SMTP settings
  const config = {
    host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER || 'test@example.com',
      pass: process.env.EMAIL_PASS || 'password'
    }
  };
  
  // For Gmail, enable additional options
  if (config.host.includes('gmail')) {
    config.debug = true; // Enable detailed debug information
    config.logger = true; // Enable logging
    
    // Add Gmail-specific options
    config.service = 'gmail'; // Use Gmail service instead of host/port
    
    console.log('Using Gmail SMTP configuration');
  }
  
  console.log(`Creating email transport with host: ${config.host}, port: ${config.port}, user: ${config.auth.user}`);
  
  return nodemailer.createTransport(config);
};

/**
 * Send quiz results via email with improvement suggestions
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Subject of the quiz
 * @param {number} options.grade - Grade level
 * @param {number} options.score - Score obtained
 * @param {number} options.totalPoints - Total possible points
 * @param {Array} options.questions - Quiz questions
 * @param {Array} options.responses - User responses
 * @param {Array} options.suggestions - Improvement suggestions (optional)
 */
const sendQuizResults = async (options) => {
  try {
    const {
      to = 'galanimeghji@gmail.com', // Default to galanimeghji@gmail.com if no recipient is provided
      subject,
      grade,
      score,
      totalPoints,
      questions,
      responses,
      correctAnswers,
      suggestions = null
    } = options;

    // Get AI suggestions if not provided
    let improvementSuggestions = suggestions;
    if (!improvementSuggestions) {
      try {
        improvementSuggestions = await generateImprovementSuggestions(subject, grade, questions, responses, correctAnswers);
      } catch (error) {
        console.error('Failed to generate suggestions:', error);
        improvementSuggestions = {
          suggestions: ['Focus on reviewing the topics you struggled with.', 'Practice similar questions to improve your understanding.']
        };
      }
    }

    // Calculate the percentage score
    const percentage = Math.round((score / totalPoints) * 100);
    
    // Generate a colorful assessment based on percentage
    let assessment = 'Needs Improvement';
    let color = '#FF4D4D'; // Red
    
    if (percentage >= 90) {
      assessment = 'Excellent';
      color = '#4CAF50'; // Green
    } else if (percentage >= 75) {
      assessment = 'Very Good';
      color = '#2196F3'; // Blue
    } else if (percentage >= 60) {
      assessment = 'Good';
      color = '#FF9800'; // Orange
    }

    // Create HTML content for the email
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
        <h2 style="color: #333; text-align: center;">Quiz Results</h2>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <h3 style="margin-top: 0;">Subject: ${subject}</h3>
          <p>Grade Level: ${grade}</p>
          <div style="text-align: center; margin: 20px 0;">
            <div style="font-size: 24px; font-weight: bold; color: ${color};">
              ${score} / ${totalPoints} points (${percentage}%)
            </div>
            <div style="font-size: 18px; color: ${color}; margin-top: 5px;">
              ${assessment}
            </div>
          </div>
        </div>
        
        <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Improvement Suggestions</h3>
        <ul style="padding-left: 20px;">
          ${improvementSuggestions.suggestions.map(suggestion => 
            `<li style="margin-bottom: 10px;">${suggestion}</li>`
          ).join('')}
        </ul>
        
        <div style="margin-top: 30px; font-style: italic; color: #666; text-align: center; font-size: 14px;">
          This is an automated email from the AI Quizzer System.
        </div>
      </div>
    `;

    // Create the transporter
    const transporter = createTransporter();

    // Define email options
    const mailOptions = {
      from: process.env.EMAIL_FROM || '"AI Quizzer" <quizzer@example.com>',
      to,
      subject: `Quiz Results: ${subject} - ${assessment}`,
      html: htmlContent,
      text: `
        Quiz Results
        
        Subject: ${subject}
        Grade Level: ${grade}
        Score: ${score} / ${totalPoints} points (${percentage}%)
        Assessment: ${assessment}
        
        Improvement Suggestions:
        ${improvementSuggestions.suggestions.map(suggestion => 
          `- ${suggestion}`
        ).join('\n')}
        
        This is an automated email from the AI Quizzer System.
      `
    };

    // Log email being sent
    console.log(`Attempting to send email to: ${to}`);
    
    // Add special logging for galanimeghji@gmail.com
    if (to === 'galanimeghji@gmail.com') {
      console.log('Sending quiz results to the specified recipient (galanimeghji@gmail.com)');
      console.log('Using SMTP settings:', {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: process.env.EMAIL_SECURE,
        user: process.env.EMAIL_USER,
        // Not logging password for security reasons
      });
    }
    
    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    
    // Additional Gmail-specific logging
    if (process.env.EMAIL_HOST.includes('gmail')) {
      console.log('Gmail delivery link:', nodemailer.getTestMessageUrl(info));
    }
    
    return {
      success: true,
      messageId: info.messageId,
      to: to,
      suggestions: improvementSuggestions.suggestions
    };
  } catch (error) {
    console.error('Email sending error:', error);
    
    // More detailed error information for debugging
    if (error.code === 'EAUTH') {
      console.error('Authentication error: Check your email credentials');
    } else if (error.code === 'ESOCKET') {
      console.error('Socket error: Check your EMAIL_HOST and EMAIL_PORT settings');
    } else if (error.code === 'ECONNECTION') {
      console.error('Connection error: Check if the email server is accessible');
    }
    
    // Return error information but don't throw
    return {
      success: false,
      error: error.message,
      code: error.code || 'UNKNOWN',
      recipient: options.to
    };
  }
};

module.exports = { sendQuizResults };
