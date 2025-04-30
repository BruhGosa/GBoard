const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const authController = require('../controllers/authController');

// Создаем директорию для аватарок, если её нет
const photoDir = path.join(process.cwd(), 'photo');
if (!fs.existsSync(photoDir)) {
    fs.mkdirSync(photoDir, { recursive: true });
}

// Настройка хранилища для загрузки файлов
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, photoDir);
    },
    filename: function (req, file, cb) {
        // Генерируем уникальное имя файла
        const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, 'avatar-' + uniqueSuffix + ext);
    }
});

// Фильтр типов файлов
const fileFilter = (req, file, cb) => {
    // Принимаем только изображения
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Недопустимый формат файла. Разрешены только изображения.'), false);
    }
};

// Инициализация загрузчика файлов
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB макс размер файла
    },
    fileFilter: fileFilter
});

// Регистрация
router.post('/register', authController.register);

// Вход
router.post('/login', authController.login);

// Выход
router.get('/logout', authController.logout);

// Проверка авторизации
router.get('/check-auth', authController.checkAuth);

// Загрузка аватарки
router.post('/upload-avatar', authController.authMiddleware, upload.single('avatar'), authController.uploadAvatar);

// Обновление имени пользователя
router.post('/update-username', authController.authMiddleware, authController.updateUsername);

// Обновление профиля
router.post('/update-profile', authController.authMiddleware, authController.updateProfile);

module.exports = router; 