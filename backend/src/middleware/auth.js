// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');

// Ensure JWT_SECRET is loaded from .env
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('CRITICAL: JWT_SECRET is not defined in .env! Authentication will fail.');
    // In a real app, you might want to exit here or throw a more specific error
}

const auth = (req, res, next) => {
    // Get token from header
    // Expected format: "Bearer YOUR_TOKEN_STRING"
    const authHeader = req.header('Authorization');

    if (!authHeader) {
        return res.status(401).json({ message: 'No token, authorization denied.' });
    }

    const token = authHeader.split(' ')[1]; // Extract the token part after "Bearer "

    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied.' });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET); // Decodes and verifies the token
        req.user = decoded; // Attach decoded user payload (id, username, role) to the request
        next(); // Proceed to the next middleware/route handler
    } catch (error) {
        console.error('Token verification failed:', error.message);
        res.status(401).json({ message: 'Token is not valid or expired.' });
    }
};

const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied: Insufficient role permissions.' });
        }
        next();
    };
};

module.exports = { auth, authorizeRoles };