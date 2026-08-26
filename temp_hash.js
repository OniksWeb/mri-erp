const bcrypt = require('bcryptjs');

async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10); // Generate a salt (recommended)
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log("Hashed Password:", hashedPassword);
}

// Replace 'your_admin_password' with the actual password you want for your hardcoded admin
hashPassword("Honicute@911")