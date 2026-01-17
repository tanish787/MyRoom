const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// MongoDB Connection - Remove deprecated options
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/myroom')
.then(() => {
  console.log('MongoDB connected successfully');
})
.catch(err => {
  console.log('MongoDB connection error:', err.message);
});

// User Schema
const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  paymentInfo: { type: String },
  savedRooms: [
    {
      roomName: String,
      roomData: Object,
      savedAt: { type: Date, default: Date.now },
    },
  ],
  listedItems: [
    {
      itemName: String,
      itemImage: String,
      itemPrice: Number,
      itemDescription: String,
      listedAt: { type: Date, default: Date.now },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);

// Multer setup for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Helper function to verify token
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.userId = decoded.userId;
    next();
  });
};

// Sign Up
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      fullName,
      email,
      phone,
      password: hashedPassword,
    });

    await user.save();
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, userId: user._id, message: 'User created successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, userId: user._id, message: 'Login successful' });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
});

// Get User Profile
app.get('/api/user/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    res.json({
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      savedRooms: user.savedRooms,
      listedItems: user.listedItems,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile', error: error.message });
  }
});

// Save Room
app.post('/api/user/save-room', verifyToken, async (req, res) => {
  try {
    const { roomName, roomData } = req.body;
    const user = await User.findById(req.userId);

    user.savedRooms.push({ roomName, roomData });
    await user.save();

    res.json({ message: 'Room saved successfully', savedRooms: user.savedRooms });
  } catch (error) {
    res.status(500).json({ message: 'Error saving room', error: error.message });
  }
});

// Upload Item Image
app.post('/api/user/upload-item', verifyToken, upload.single('image'), async (req, res) => {
  try {
    const { itemName, itemPrice, itemDescription } = req.body;
    const user = await User.findById(req.userId);

    user.listedItems.push({
      itemName,
      itemImage: `/uploads/${req.file.filename}`,
      itemPrice: parseFloat(itemPrice),
      itemDescription,
    });
    await user.save();

    res.json({ message: 'Item uploaded successfully', listedItems: user.listedItems });
  } catch (error) {
    res.status(500).json({ message: 'Error uploading item', error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));