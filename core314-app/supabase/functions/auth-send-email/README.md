# Auth Send Email Function

Supabase Auth Hook function that sends branded transactional emails via SendGrid for authentication flows.

## Supported Email Types

- **Email Verification** (`signup`, `email_verification`, `confirm_signup`) - Sent when a user signs up
- **Password Reset** (`recovery`, `password_reset`, `reset_password`) - Sent when a user requests a password reset
- **Magic Link** (`magiclink`, `magic_link`) - Sent for passwordless login
- **Email Change** (`email_change`, `change_email`) - Sent when a user changes their email address
- **System Notification** (`system_notification`, `notification`) - Generic system notifications

## Environment Variables

The following environment variables must be configured in your Supabase project:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SENDGRID_API_KEY` | Yes | - | SendGrid API key for sending emails |
| `SENDGRID_SENDER_EMAIL` | No | `noreply@core314.com` | Verified sender email address in SendGrid |
| `SENDGRID_SENDER_NAME` | No | `Core314` | Display name for the sender |
| `APP_URL` | No | `https://app.core314.com` | Base URL for the application (used in email links) |
| `SUPABASE_URL` | Yes | - | Supabase project URL (auto-configured) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | - | Supabase service role key for logging (auto-configured) |

## Setup Instructions

### 1. Configure SendGrid

1. Create a SendGrid account at https://sendgrid.com
2. Verify your sender domain or email address
3. Create an API key with "Mail Send" permissions
4. Add the API key to your Supabase project secrets

### 2. Set Environment Variables in Supabase

```bash
# Using Supabase CLI
supabase secrets set SENDGRID_API_KEY=your_api_key_here
supabase secrets set SENDGRID_SENDER_EMAIL=noreply@core314.com
supabase secrets set SENDGRID_SENDER_NAME=Core314
supabase secrets set APP_URL=https://app.core314.com
```

Or via the Supabase Dashboard:
1. Go to Project Settings > Edge Functions
2. Add the environment variables listed above

### 3. Configure Auth Hook in Supabase

To use this function as an Auth Hook, configure it in your Supabase project:

1. Go to Authentication > Hooks in the Supabase Dashboard
2. Enable "Send Email" hook
3. Set the hook URL to your deployed function URL

Alternatively, configure via SQL:

```sql
-- Enable the auth hook (requires service role)
SELECT supabase_functions.http_request(
  'https://your-project.supabase.co/functions/v1/auth-send-email',
  'POST',
  '{"Content-Type": "application/json"}',
  '{}',
  '5000'
);
```

## Direct API Usage

The function can also be called directly for sending system notifications:

```typescript
const response = await fetch('https://your-project.supabase.co/functions/v1/auth-send-email', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAnonKey}`,
  },
  body: JSON.stringify({
    type: 'system_notification',
    to: 'user@example.com',
    data: {
      title: 'Important Update',
      message: 'Your account has been updated.',
      action_url: 'https://app.core314.com/dashboard',
      action_text: 'View Dashboard',
    },
  }),
});
```

## Email Templates

All email templates follow these guidelines:
- Professional, minimal design
- Core314 branding (logo, colors)
- Mobile-responsive layout
- Clear subject lines
- Plain, readable body copy
- No marketing content
- No emojis in subject lines

## Logging

All email events are logged to the `fusion_audit_log` table with:
- `event_type`: `auth_email_sent` or `auth_email_failed`
- `event_data`: Contains email type, recipient, message ID, and status

## Troubleshooting

### Emails not sending
1. Verify `SENDGRID_API_KEY` is set correctly
2. Check that sender email is verified in SendGrid
3. Review Supabase Edge Function logs for errors

### Emails going to spam
1. Ensure sender domain has proper SPF/DKIM/DMARC records
2. Verify sender email in SendGrid
3. Avoid spam-trigger words in subject lines

### Auth hook not triggering
1. Verify the hook is enabled in Supabase Dashboard
2. Check that the function URL is correct
3. Review Auth logs in Supabase Dashboard
