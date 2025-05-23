const boardModel = require('../models/board');
const logger = require('../utils/logger');
const WebSocket = require('ws');
const { getWss, broadcastUsersList } = require('./wsController');
const { pool } = require('../models/db');

// Проверка существования пользователя
async function checkUserExists(userId) {
    const userExists = await pool.query('SELECT 1 FROM "user" WHERE id = $1', [userId]);
    return userExists.rows.length > 0;
}

// Получение информации о доске по ID
async function getBoardById(boardId) {
    const result = await pool.query('SELECT * FROM boards WHERE id = $1', [boardId]);
    return result.rows[0];
}

// Создание новой доски
async function createBoard(req, res) {
    const { name } = req.body;
    const userId = req.session.userId;
    
    try {
        const result = await boardModel.createBoard(name, userId);
        res.json(result);
    } catch (err) {
        logger.error('Error creating board', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
}

// Присоединение к доске
async function joinBoard(req, res) {
    const { code } = req.body;
    const userId = req.session.userId;
    
    try {
        const result = await boardModel.joinBoard(code, userId);
        res.json(result);
    } catch (err) {
        logger.error('Error joining board', err);
        res.status(500).json({ error: 'Ошибка при присоединении к доске' });
    }
}

// Получение списка досок пользователя
async function getUserBoards(req, res) {
    try {
        const boards = await boardModel.getUserBoards(req.session.userId);
        res.json(boards);
    } catch (err) {
        logger.error('Error getting user boards', err);
        res.status(500).json({ error: 'Ошибка при получении списка досок' });
    }
}

// Получение списка пользователей доски
async function getBoardUsers(req, res) {
    try {
        const users = await boardModel.getBoardUsers(req.params.code);
        res.json(users);
    } catch (err) {
        logger.error('Error getting board users', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
}

// Обновление прав доступа к доске
async function updateBoardAccess(req, res) {
    const { boardCode, userId, canDraw, isBanned } = req.body;
    
    if (!boardCode || !userId) {
        return res.status(400).json({ error: 'Отсутствуют необходимые параметры' });
    }

    try {
        // Получаем информацию о доске
        const boardInfo = await boardModel.getBoardAccessInfo(boardCode, req.session.userId);

        if (!boardInfo) {
            return res.status(404).json({ error: 'Доска не найдена' });
        }

        // Проверяем, является ли текущий пользователь владельцем
        if (!boardInfo.is_owner) {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }

        // Проверяем, существует ли пользователь
        const userExists = await checkUserExists(userId);
        if (!userExists) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        // Проверяем, не пытаются ли забанить владельца доски
        if (isBanned !== undefined) {
            const board = await getBoardById(boardInfo.board_id);
            if (userId == board.owner_id) {
                return res.status(400).json({ error: 'Нельзя заблокировать владельца доски' });
            }
        }

        // Обновляем запись в базе данных
        await boardModel.updateBoardAccess(boardInfo.board_id, userId, canDraw, isBanned);

        // Проверяем, был ли пользователь в сети
        const wasOnline = await boardModel.isUserOnline(userId, boardInfo.board_id);
        
        // Если пользователя банят, и он был онлайн, удаляем из connect_user
        if (isBanned && wasOnline) {
            await boardModel.removeUserConnection(userId, boardInfo.board_id);
        }

        // Получаем экземпляр WebSocket-сервера
        const wss = getWss();

        // Отправляем уведомление через WebSocket пользователю, чьи права были изменены
        if (wss && wss.clients) {
            if (isBanned !== undefined && isBanned) {
                // Если пользователя забанили, отправляем сообщение о бане
                wss.clients.forEach(client => {
                    if (client.userId == userId && client.boardCode === boardCode && 
                        client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ 
                            type: 'banned' 
                        }));
                    }
                });
            } else {
                // Если изменили права доступа, отправляем обновление
                wss.clients.forEach(client => {
                    if (client.userId == userId && client.boardCode === boardCode && 
                        client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ 
                            type: 'access_update',
                            canDraw: canDraw
                        }));
                    }
                });
            }
        } else {
            logger.warn('WebSocket server instance not available');
        }

        // Получаем обновленные списки пользователей
        const allUsers = await boardModel.getBoardUsers(boardCode);
        const onlineUsers = await boardModel.getOnlineUsers(boardCode);

        // Отправляем обновленные списки пользователей всем клиентам
        if (wss && broadcastUsersList) {
            broadcastUsersList(wss, boardCode, onlineUsers, allUsers);
        }

        res.json({ 
            success: true,
            onlineUsers,
            allUsers
        });
    } catch (err) {
        logger.error('Error updating board access:', err);
        res.status(500).json({ error: 'Ошибка сервера при обновлении прав доступа' });
    }
}

// Отрисовка страницы доски
async function renderBoard(req, res) {
    const code = req.params.code;
    const userId = req.session.userId;

    try {
        const boardInfo = await boardModel.getBoardAccessInfo(code, userId);

        if (!boardInfo) {
            logger.info('Board access denied', {
                userId,
                boardCode: code
            });
            return res.status(403).send('Доступ запрещен');
        }
        
        // Проверяем, забанен ли пользователь
        if (boardInfo.is_banned) {
            logger.info('User is banned from this board', {
                userId,
                boardCode: code
            });
            return res.redirect(`/ban.html?board=${code}`);
        }

        logger.info('Board access granted', {
            userId,
            boardCode: code
        });
        res.sendFile(require('path').join(process.cwd(), 'public', 'board.html'));
    } catch (err) {
        logger.error('Error accessing board', err);
        res.status(500).send('Ошибка сервера');
    }
}

module.exports = {
    createBoard,
    joinBoard,
    getUserBoards,
    getBoardUsers,
    updateBoardAccess,
    renderBoard
}; 