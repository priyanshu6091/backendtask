# AI Quizzer API

A backend service for an AI-powered quiz application that generates quizzes, evaluates responses, provides hints, and allows retrying quizzes.

## Features

- **Authentication** - Mock authentication with JWT
- **Quiz Generation** - AI-generated quizzes using Groq
- **Quiz Submission** - Submit and evaluate quiz answers
- **Quiz History** - View past quizzes with filtering options
- **Multi-Database Support** - Works with both MongoDB (default) and SQL databases
- **Question Hints** - Get AI-generated hints for questions
- **Quiz Retry** - Retry quizzes while preserving previous attempts
- **Submission History** - View all previous quiz submissions
- **Email Notifications** - Send quiz results via email with AI-generated improvement suggestions

## Setup Instructions

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pplbackend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory (use the provided `.env.example` as a template):
   ```env
   # Database Configuration
   DB_TYPE=mongo           # 'mongo' or 'sql'
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database
   SQL_URI=postgresql://username:password@localhost:5432/ai_quizzer

   # Authentication
   JWT_SECRET=your-secret-key

   # Caching
   REDIS_URL=redis://localhost:6379

   # AI Service
   GROQ_API_KEY=your-groq-api-key

   # Email Configuration
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   EMAIL_FROM="AI Quizzer <your-email@gmail.com>"
   ```

4. **Database Setup**

   **For MongoDB (Default):**
   - Use MongoDB Atlas or run MongoDB locally
   - Ensure your `MONGO_URI` is correctly configured in the `.env` file
   - Set `DB_TYPE=mongo` in your `.env` file

   **For SQL (PostgreSQL):**
   - Install PostgreSQL locally
   - Create a database for the application:
     ```bash
     createdb ai_quizzer
     ```
   - Initialize the database with the SQL schema:
     ```bash
     psql -d ai_quizzer -f sql/00_schema.sql
     ```
   - Set `DB_TYPE=sql` and `SQL_URI` in your `.env` file

5. **Start Redis server (optional)**
   
   The system will automatically fall back to in-memory cache if Redis is unavailable:
   ```bash
   # Install Redis if not already installed
   # On MacOS with Homebrew:
   brew install redis
   
   # Start Redis server
   redis-server
   ```

6. **Run the server**
   ```bash
   npm run dev  # Development mode with nodemon
   npm start    # Production mode
   ```

### Docker Setup

For easy deployment with all dependencies included:

1. **Build and start the Docker containers**
   ```bash
   # Build the Docker images
   npm run docker:build
   
   # Start all services
   npm run docker:start
   ```

2. **Access the API**
   
   The API will be available at `http://localhost:3000`

3. **Stop the services**
   ```bash
   npm run docker:stop
   ```

### Database Support

This application supports both MongoDB and SQL databases:

- **MongoDB**: Default configuration for document storage
- **PostgreSQL**: Relational database alternative 

To switch between databases, modify the `DB_TYPE` environment variable in your `.env` file:
```
DB_TYPE=mongo  # For MongoDB
DB_TYPE=sql    # For PostgreSQL
```

The SQL schema is designed to closely match the MongoDB structure, providing the same functionality with either database.

## Project Structure

```
├── postman/                    # Postman collection for API testing
├── src/
│   ├── config/                 # Configuration files
│   ├── database/               # Database connection and adapter
│   ├── middleware/             # Express middleware including authentication
│   ├── models/                 # Data models (Mongoose schemas)
│   ├── utils/                  # Utility functions (cache, email, AI integration)
│   └── index.js                # Main application entry point
├── sql/                        # SQL database schema and migrations
│   ├── 00_schema.sql           # Main SQL schema creation
│   ├── 01_seed.sql             # Sample data for testing
│   └── README.sql              # Documentation for SQL implementation
├── .env.example                # Example environment variables
├── docker-compose.yml          # Docker Compose configuration
├── Dockerfile                  # Docker configuration
└── README.md                   # Project documentation
```

## API Documentation

### Authentication

**POST /auth/login**
- Request body: `{ "username": "string", "password": "string" }`
- Response: `{ "success": true, "token": "jwt-token", "message": "Login successful" }`

### Quiz Generation

**POST /quiz/generate**
- Headers: `Authorization: Bearer {token}`
- Request body:
```json
{
    "grade": 5,
    "subject": "Mathematics",
    "totalQuestions": 10,
    "maxScore": 10,
    "difficulty": "MEDIUM"
}
```

### Quiz Submission

**POST /quiz/:id/submit**
- Headers: `Authorization: Bearer {token}`
- Request body:
```json
{
    "responses": [
        {
            "questionId": "q1",
            "userResponse": "A"
        }
    ]
}
```

### Quiz History

**GET /quiz/history**
- Headers: `Authorization: Bearer {token}`
- Query parameters:
  - `grade`: Filter by grade level
  - `subject`: Filter by subject
  - `from`: Start date (YYYY-MM-DD)
  - `to`: End date (YYYY-MM-DD)

### Get Question Hint

**POST /quiz/hint**
- Headers: `Authorization: Bearer {token}`
- Request body:
```json
{
    "question": "What is the formula for calculating the area of a circle?"
}
```

### Quiz Retry Feature

**POST /quiz/:id/retry**
- Headers: `Authorization: Bearer {token}`
- Description: Returns the quiz questions without answers for retrying the quiz
- Response includes previous submission count and best score

**GET /quiz/:id/submissions**
- Headers: `Authorization: Bearer {token}`
- Description: Lists all submissions for a specific quiz with scores

**GET /quiz/:id/submissions/:submissionIndex**
- Headers: `Authorization: Bearer {token}`
- Description: Shows detailed information about a specific quiz submission
- Response includes question details, user responses, correct answers, and score

### Email Notification Features

**Submit Quiz with Email Notification**
- **POST /quiz/:id/submit** 
- Include email parameters in the request:
```json
{
  "responses": [
    {
      "questionId": "questionId1",
      "userResponse": "Option A"
    },
    // ...more responses
  ],
  "sendEmail": true,
  "email": "galanimeghji@gmail.com"  // Default recipient if not specified
}
```
- The email will include quiz results and AI-generated improvement suggestions

**Send Email for Past Quiz Submission**
- **POST /quiz/:id/email-results**
- Request body:
```json
{
  "email": "galanimeghji@gmail.com",  // Default recipient if not specified
  "submissionIndex": 0  // Optional, defaults to latest submission if not provided
}
```
- Sends a formatted email with quiz results and AI-generated suggestions to the provided email address

## Postman Collection

A Postman collection is included at `postman/ai_quizzer_collection.json` for easy API testing.

## Technology Stack

- Node.js & Express
- MongoDB with Mongoose
- Redis for caching (with in-memory fallback)
- Groq AI API for quiz generation
- JWT for authentication
- Nodemailer for email notifications

## License

MIT
