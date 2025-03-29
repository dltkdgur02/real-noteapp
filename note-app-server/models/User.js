const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  emailVerified: { type: Boolean, default: false }, // 나중에 인증 기능 확장 대비
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
