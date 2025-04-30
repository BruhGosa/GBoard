const userModel = require('../models/user');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

// Регистрация пользователя
async function register(req, res) {
  logger.info('Registration attempt', { fullName: req.body.full_name });
  const { full_name, password } = req.body;
  
  try {
    const result = await userModel.registerUser(full_name, password);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    // Устанавливаем сессию для пользователя
    req.session.userId = result.userId;
    logger.info('User registered successfully', { userId: result.userId });
    
    res.json({ success: true });
  } catch (err) {
    logger.error('Registration error', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Авторизация пользователя
async function login(req, res) {
  logger.info('Login attempt', { fullName: req.body.full_name });
  const { full_name, password } = req.body;
  
  try {
    const result = await userModel.loginUser(full_name, password);
    
    if (result.success) {
      req.session.userId = result.userId;
      logger.info('User logged in successfully', { userId: result.userId });
      return res.json({ success: true });
    }
    
    logger.warn('Invalid login attempt', { fullName: req.body.full_name });
    res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
  } catch (err) {
    logger.error('Login error', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Выход из системы
function logout(req, res) {
  req.session.destroy();
  res.redirect('/');
}

// Проверка авторизации
async function checkAuth(req, res) {
  if (req.session.userId) {
    try {
      const userData = await userModel.getUserData(req.session.userId);
      res.json(userData);
    } catch (err) {
      console.error(err);
      res.json({ authenticated: false });
    }
  } else {
    res.json({ authenticated: false });
  }
}

// Загрузка аватарки
async function uploadAvatar(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не был загружен' });
    }

    // Получаем путь загруженного файла
    const inputPath = req.file.path;
    const fileName = path.basename(inputPath);
    const photoDir = path.join(process.cwd(), 'photo');
    const outputPath = path.join(photoDir, 'resized-' + fileName);

    // Обрабатываем изображение с помощью sharp
    await sharp(inputPath)
      .resize(256, 256, {
        fit: sharp.fit.cover,
        position: sharp.strategy.entropy
      })
      .toFile(outputPath);

    // Удаляем оригинальный файл
    fs.unlinkSync(inputPath);

    // Создаем относительный путь к файлу для хранения в БД
    const relativePath = '/photo/' + path.basename(outputPath);

    // Обновляем ссылку на аватар в базе данных
    const result = await userModel.updateAvatar(req.session.userId, relativePath);
    
    res.json(result);
  } catch (err) {
    logger.error('Error uploading avatar', err);
    res.status(500).json({ error: 'Ошибка при загрузке аватара' });
  }
}

// Обновление имени пользователя
async function updateUsername(req, res) {
  const { username } = req.body;

  if (!username || username.trim() === '') {
    return res.status(400).json({ error: 'Имя пользователя не может быть пустым' });
  }

  try {
    const result = await userModel.updateUsername(req.session.userId, username);
    res.json(result);
  } catch (err) {
    logger.error('Error updating username', err);
    res.status(500).json({ error: 'Ошибка при обновлении имени пользователя' });
  }
}

// Обновление профиля (имя и аватарка)
async function updateProfile(req, res) {
  const { username } = req.body;

  if (!username || username.trim() === '') {
    return res.status(400).json({ error: 'Имя пользователя не может быть пустым' });
  }

  try {
    // Обновляем имя пользователя
    const usernameResult = await userModel.updateUsername(req.session.userId, username);
    
    if (!usernameResult.success) {
      return res.status(400).json({ error: usernameResult.error });
    }

    // Получаем обновленные данные пользователя
    const profileData = await userModel.getUpdatedProfile(req.session.userId);
    
    res.json(profileData);
  } catch (err) {
    logger.error('Error updating profile', err);
    res.status(500).json({ error: 'Ошибка при обновлении профиля' });
  }
}

// Middleware для проверки авторизации
function authMiddleware(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/');
  }
}

module.exports = {
  register,
  login,
  logout,
  checkAuth,
  uploadAvatar,
  updateUsername,
  updateProfile,
  authMiddleware
}; 