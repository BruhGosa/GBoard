const express = require('express');
const router = express.Router();
const boardController = require('../controllers/boardController');
const authController = require('../controllers/authController');

// Проверка авторизации
const { authMiddleware } = authController;

// Создание новой доски
router.post('/create-board', authMiddleware, boardController.createBoard);

// Присоединение к доске
router.post('/join-board', authMiddleware, boardController.joinBoard);

// Получение списка досок пользователя
router.get('/my-boards', authMiddleware, boardController.getUserBoards);

// Получение списка пользователей доски
router.get('/board-users/:code', authMiddleware, boardController.getBoardUsers);

// Обновление прав доступа к доске
router.post('/update-board-access', authMiddleware, boardController.updateBoardAccess);

// Отображение страницы доски
router.get('/board/:code', authMiddleware, boardController.renderBoard);

module.exports = router; 