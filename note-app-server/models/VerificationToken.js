const mongoose = require('mongoose');

const VerificationTokenSchema = new mongoose.Schema({
  email: { type: String, required: true },
  token: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 3600 } // 1시간 뒤 자동 삭제
});

module.exports = mongoose.model('VerificationToken', VerificationTokenSchema);
