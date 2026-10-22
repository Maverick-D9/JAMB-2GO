// Temporary in-memory store. Expires in 10 minutes.
const otps = new Map();

const Otp = {
  create(email, code){
    otps.set(email.toLowerCase(), { 
      code, 
      expiresAt: Date.now() + 10*60*1000, // 10 min
      attempts: 0 
    });
    console.log(`[OTP] ${email} -> ${code}`);
  },
  verify(email, code){
    const rec = otps.get(email.toLowerCase());
    if(!rec) return { ok:false, error:"Code expired. Request a new one." };
    if(Date.now() > rec.expiresAt){
      otps.delete(email.toLowerCase());
      return { ok:false, error:"Code expired" };
    }
    rec.attempts++;
    if(rec.attempts > 5){
      otps.delete(email.toLowerCase());
      return { ok:false, error:"Too many attempts. Request new code." };
    }
    if(rec.code !== code) return { ok:false, error:"Invalid code" };
    
    otps.delete(email.toLowerCase());
    return { ok:true };
  }
};

module.exports = Otp;