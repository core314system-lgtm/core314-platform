import nodemailer from 'nodemailer';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

if (!SENDGRID_API_KEY) {
  console.error('❌ SENDGRID_API_KEY environment variable is required');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 587,
  secure: false, // Use STARTTLS
  auth: {
    user: 'apikey',
    pass: SENDGRID_API_KEY
  }
});

console.log('🔍 Verifying SMTP connection...');

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP verification failed:', error);
    process.exit(1);
  }
  
  console.log('✅ SMTP connection verified successfully');
  
  const mailOptions = {
    from: 'Core314 Systems <support@core314.com>',
    to: 'core314system@gmail.com',
    subject: 'Core314 SMTP Test – Successful Connection',
    text: '✅ The SendGrid SMTP configuration for Core314 is active and delivering emails correctly.\n\nTimestamp: ' + new Date().toISOString()
  };
  
  console.log('📧 Sending test email...');
  
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('❌ SMTP test failed:', error);
      process.exit(1);
    }
    
    console.log('✅ SMTP test success!');
    console.log('Response:', info.response);
    console.log('Message ID:', info.messageId);
    console.log('Timestamp:', new Date().toISOString());
  });
});
