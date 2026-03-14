const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../.env') })

// Check if we're in development mode based on an environment variable
// npm run dev -- starts the server in development mode
// npm start -- starts the server in production mode
const isDev = process.env.DEV === 'true'
const raceDuration = isDev ? 60 : 600 // seconds, shorter in development for faster testing

// Ensure that the required access keys are set in the environment variables
if (!process.env.RECEPTIONIST_KEY || !process.env.OBSERVER_KEY || !process.env.SAFETY_KEY) {
  console.error('Error: access keys not set. Check your .env file.')
  process.exit(1)
}

module.exports = {
  PORT: process.env.PORT || 3000,
  IS_DEV: isDev,
  RACE_DURATION: raceDuration,
  KEYS: {
    receptionist: process.env.RECEPTIONIST_KEY,
    observer: process.env.OBSERVER_KEY,
    safety: process.env.SAFETY_KEY
  }
}