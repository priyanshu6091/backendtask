const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const generateQuiz = async (grade, subject, totalQuestions = 10, maxScore = 10, difficulty = 'MEDIUM') => {
  const prompt = `You are a quiz generator. Generate a quiz with these specifications:
Grade Level: ${grade}
Subject: ${subject}
Number of Questions: ${totalQuestions}
Difficulty: ${difficulty}

Respond ONLY with valid JSON in this exact format, no other text:
{
  "questions": [
    {
      "questionId": "q1",
      "question": "question text here",
      "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
      "correctAnswer": "A",
      "points": 1
    }
  ],
  "totalPoints": ${maxScore}
}`;
  
  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: 2000,
      top_p: 0.9
    });

    const result = completion.choices[0].message.content.trim();
    // Remove any potential markdown formatting
    const jsonStr = result.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Quiz generation error:', error);
    throw new Error('Failed to generate quiz. Please try again.');
  }
};

const getHint = async (question) => {
  try {
    const prompt = `You are a helpful tutor. Provide a clear and concise hint for this question without giving away the answer: "${question}"`;
    
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 200
    });

    return {
      success: true,
      hint: completion.choices[0].message.content.trim()
    };
  } catch (error) {
    console.error('Hint generation error:', error);
    return {
      success: false,
      error: 'Failed to generate hint. Please try again.'
    };
  }
};

const evaluateResponses = async (quiz, responses) => {
  try {
    let score = 0;
    const evaluation = responses.map(response => {
      const question = quiz.questions.find(q => q.questionId === response.questionId || q._id.toString() === response.questionId);
      
      if (!question) {
        throw new Error(`Question not found for id: ${response.questionId}`);
      }

      const isCorrect = question.correctAnswer === response.userResponse;
      if (isCorrect) {
        score += question.points || 1; // fallback to 1 point if points not specified
      }

      return {
        questionId: response.questionId,
        correct: isCorrect,
        points: isCorrect ? (question.points || 1) : 0,
        correctAnswer: question.correctAnswer
      };
    });

    return {
      totalScore: score,
      maxScore: quiz.totalPoints || quiz.questions.length,
      percentage: (score / (quiz.totalPoints || quiz.questions.length)) * 100,
      details: evaluation
    };  } catch (error) {
    throw new Error(`Evaluation error: ${error.message}`);
  }
};

/**
 * Generate personalized improvement suggestions based on quiz responses
 * @param {string} subject - The subject of the quiz
 * @param {number} grade - Grade level
 * @param {Array} questions - Quiz questions
 * @param {Array} responses - User responses
 * @param {Array} correctAnswers - Correct answers
 * @returns {Object} - Object with suggestions array
 */
const generateImprovementSuggestions = async (subject, grade, questions, responses, correctAnswers) => {
  try {
    // Create context for improvement suggestions
    let incorrectQuestions = [];
    
    // Match responses with questions to identify areas of improvement
    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      const question = questions.find(q => 
        q._id.toString() === response.questionId || 
        q.questionId === response.questionId
      );
      
      if (question && question.correctAnswer !== response.userResponse) {
        incorrectQuestions.push({
          question: question.question,
          userAnswer: response.userResponse,
          correctAnswer: question.correctAnswer
        });
      }
    }
    
    // If there are no incorrect answers, provide general suggestions
    if (incorrectQuestions.length === 0) {
      return {
        suggestions: [
          `Great job on mastering this ${subject} quiz! To further improve, try tackling more advanced problems.`,
          `You've shown excellent understanding of ${subject}. Consider exploring related topics to broaden your knowledge.`
        ]
      };
    }
    
    // Create a prompt for AI to generate suggestions
    const prompt = `You are an expert educational advisor. Based on a student's quiz performance in ${subject} (Grade ${grade}), 
    provide TWO specific, actionable, and personalized suggestions to help them improve. The student answered the following questions incorrectly:
    
    ${incorrectQuestions.map((q, idx) => 
      `${idx + 1}. Question: "${q.question}" 
      Student's answer: ${q.userAnswer}
      Correct answer: ${q.correctAnswer}`
    ).join('\n\n')}
    
    Based on these mistakes, what are TWO specific areas or concepts this student should focus on to improve?
    Format your response as valid JSON with a 'suggestions' array containing exactly two suggestions.
    Each suggestion should be specific, actionable, and directly related to the identified weak areas.`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: "json_object" }
    });

    const result = completion.choices[0].message.content.trim();
    return JSON.parse(result);
  } catch (error) {
    console.error('Suggestion generation error:', error);
    // Provide default suggestions in case of an error
    return {
      suggestions: [
        `Focus on reviewing key concepts in ${subject} that you struggled with.`,
        `Practice similar problems and review the correct solutions to improve your understanding.`
      ]
    };
  }
};

module.exports = { generateQuiz, getHint, evaluateResponses, generateImprovementSuggestions };
