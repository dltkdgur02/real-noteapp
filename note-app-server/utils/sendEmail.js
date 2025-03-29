const nodemailer = require('nodemailer');

const sendVerificationEmail = async (to, subject, html) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"Note App" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 이메일 전송 완료: ${to}`);
  } catch (error) {
    console.error('❌ 이메일 전송 실패:', error);
    throw error;
  }
};

module.exports = sendVerificationEmail;
