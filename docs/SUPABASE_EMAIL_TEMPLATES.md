# Procuvex — Branded Supabase Email Templates

To apply these templates, go to your **Supabase Dashboard → Authentication → Email Templates**.

---

## Confirm Signup

**Subject:** `Confirm Your Procuvex Account`

```html
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
  <div style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 32px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Confirm Your Email</h1>
  </div>
  <div style="padding: 32px;">
    <p style="font-size: 16px; color: #1e293b;">Thanks for signing up for Procuvex! Please confirm your email address to get started.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Confirm Email Address</a>
    </div>
    <p style="font-size: 13px; color: #64748b;">If you didn't create a Procuvex account, you can safely ignore this email.</p>
  </div>
  <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; font-size: 12px; color: #94a3b8;">Procuvex — AI-Powered Procurement Intelligence<br/>A product of Core314 Technologies LLC</p>
  </div>
</div>
```

---

## Reset Password

**Subject:** `Reset Your Procuvex Password`

```html
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
  <div style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 32px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Reset Your Password</h1>
  </div>
  <div style="padding: 32px;">
    <p style="font-size: 16px; color: #1e293b;">We received a request to reset your Procuvex password. Click the button below to choose a new password.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Reset Password</a>
    </div>
    <p style="font-size: 13px; color: #64748b;">If you didn't request a password reset, you can safely ignore this email. This link expires in 24 hours.</p>
  </div>
  <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; font-size: 12px; color: #94a3b8;">Procuvex — AI-Powered Procurement Intelligence<br/>A product of Core314 Technologies LLC</p>
  </div>
</div>
```

---

## Magic Link

**Subject:** `Your Procuvex Login Link`

```html
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
  <div style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 32px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Your Login Link</h1>
  </div>
  <div style="padding: 32px;">
    <p style="font-size: 16px; color: #1e293b;">Click below to log in to your Procuvex account. This link is valid for one use only.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Log In to Procuvex</a>
    </div>
    <p style="font-size: 13px; color: #64748b;">If you didn't request this link, you can safely ignore this email.</p>
  </div>
  <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; font-size: 12px; color: #94a3b8;">Procuvex — AI-Powered Procurement Intelligence<br/>A product of Core314 Technologies LLC</p>
  </div>
</div>
```

---

## Invite User

**Subject:** `You've Been Invited to Procuvex`

```html
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
  <div style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 32px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">You're Invited!</h1>
  </div>
  <div style="padding: 32px;">
    <p style="font-size: 16px; color: #1e293b;">You've been invited to join a team on Procuvex, the AI-Powered Procurement Intelligence Platform.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Accept Invitation</a>
    </div>
    <p style="font-size: 13px; color: #64748b;">If you weren't expecting this invitation, you can safely ignore this email.</p>
  </div>
  <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; font-size: 12px; color: #94a3b8;">Procuvex — AI-Powered Procurement Intelligence<br/>A product of Core314 Technologies LLC</p>
  </div>
</div>
```
