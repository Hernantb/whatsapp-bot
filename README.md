# WhatsApp Bot

A WhatsApp business bot built with Node.js that integrates with GupShup for WhatsApp messaging, OpenAI for conversation intelligence, and Supabase for data storage.

## Features

- Automated WhatsApp customer service using GPT-4
- Message logging and conversation history in Supabase
- Email notifications for messages requiring human attention
- Fallback mechanism for GupShup API calls
- Testing endpoints for manual message sending and debugging

## Deployment

### Deploy on Render

1. Fork or clone this repository
2. Create a new Web Service on [Render](https://render.com)
3. Connect your GitHub repository
4. Render will automatically detect the `render.yaml` configuration
5. Configure all environment variables in the Render dashboard
6. Deploy the service

### Environment Variables

Configure the following environment variables:

```
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4-turbo-preview

# GupShup Configuration
GUPSHUP_API_KEY=your_gupshup_api_key
GUPSHUP_APP_NAME=your_gupshup_app_name
GUPSHUP_PHONE_NUMBER=your_whatsapp_number
GUPSHUP_SOURCE=your_gupshup_source

# Alternative GupShup Configuration (Fallback)
GUPSHUP_API_KEY_ALTERNATIVE=your_alternative_api_key
GUPSHUP_APP_NAME_ALTERNATIVE=your_alternative_app_name

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Email Notification Configuration
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
EMAIL_FROM=notifications@example.com
EMAIL_TO=team@example.com
EMAIL_CC=manager@example.com
EMAIL_BCC=archive@example.com
EMAIL_SUBJECT_PREFIX=[WhatsApp Bot]

# Control Panel and Webhook Configuration
CONTROL_PANEL_URL=https://your-control-panel.com
WEBHOOK_URL=https://your-webhook-endpoint.com

# Other Configuration
NODE_ENV=production
TZ=America/Argentina/Buenos_Aires
DEBUG=false
```

## Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with the required environment variables
4. Start the server: `node index.js`
5. For testing, use the test server: `node test-server.js`

## Testing Endpoints

The following endpoints are available for testing:

- `/status`: Check server status
- `/diagnostico`: Run system diagnostics
- `/api/send-manual-message`: Send a manual WhatsApp message
- `/test-message`: Simple test endpoint for message sending
- `/test-notification`: Test email notification system

## License

[MIT](LICENSE)
