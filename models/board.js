const { pool } = require('./db');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Генерация кода для доски
function generateBoardCode() {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
}

// Создание новой доски
async function createBoard(name, userId) {
    const code = generateBoardCode();
    const result = await pool.query(
        'INSERT INTO boards (code, name, owner_id) VALUES ($1, $2, $3) RETURNING id, code',
        [code, name, userId]
    );
    
    // Добавляем создателя доски в доступы
    await pool.query(
        'INSERT INTO board_access (board_id, user_id, can_draw) VALUES ($1, $2, true)',
        [result.rows[0].id, userId]
    );

    // Создаем директорию для истории доски и пустой файл истории
    const boardDir = path.join(process.cwd(), 'board_history', code);
    fs.mkdirSync(boardDir, { recursive: true });
    fs.writeFileSync(path.join(boardDir, 'history.json'), '[]');

    logger.info('Board created successfully', {
        boardCode: result.rows[0].code,
        userId
    });
    
    return { success: true, code: result.rows[0].code };
}

// Присоединение к доске
async function joinBoard(code, userId) {
    const board = await pool.query('SELECT id FROM boards WHERE code = $1', [code]);
    if (board.rows.length === 0) {
        return { success: false, error: 'Доска не найдена' };
    }

    // Проверяем, не забанен ли пользователь на доске
    const banCheck = await pool.query(
        'SELECT is_banned FROM board_access WHERE board_id = $1 AND user_id = $2',
        [board.rows[0].id, userId]
    );
    
    if (banCheck.rows.length > 0 && banCheck.rows[0].is_banned) {
        return { success: false, error: 'Вы заблокированы на этой доске' };
    }

    await pool.query(
        'INSERT INTO board_access (board_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [board.rows[0].id, userId]
    );

    return { success: true };
}

// Получение списка досок пользователя
async function getUserBoards(userId) {
    const result = await pool.query(`
        SELECT b.id, b.code, b.name, b.created_at, 
               b.owner_id = $1 as is_owner
        FROM boards b
        JOIN board_access ba ON b.id = ba.board_id
        WHERE ba.user_id = $1
        ORDER BY b.created_at DESC
    `, [userId]);
    
    return result.rows;
}

// Получение информации о доске и правах доступа пользователя
async function getBoardAccessInfo(code, userId) {
    const result = await pool.query(`
        SELECT ba.can_draw, ba.is_banned, b.owner_id = $1 as is_owner, b.id as board_id, b.name
        FROM board_access ba
        JOIN boards b ON ba.board_id = b.id
        WHERE b.code = $2 AND ba.user_id = $1
    `, [userId, code]);

    if (result.rows.length === 0) {
        return null;
    }
    
    return result.rows[0];
}

// Получение списка пользователей доски
async function getBoardUsers(code) {
    const result = await pool.query(`
        SELECT u.id, u.full_name, u.link_avatar as avatar_url, ba.can_draw, ba.is_banned, b.owner_id = u.id as is_owner
        FROM board_access ba
        JOIN "user" u ON ba.user_id = u.id
        JOIN boards b ON ba.board_id = b.id
        WHERE b.code = $1
        ORDER BY u.full_name
    `, [code]);
    
    return result.rows;
}

// Получение списка онлайн-пользователей
async function getOnlineUsers(code) {
    const result = await pool.query(`
        SELECT DISTINCT
            u.id,
            u.full_name,
            u.link_avatar as avatar_url,
            ba.can_draw,
            ba.is_banned,
            b.owner_id = u.id as is_owner
        FROM "user" u
        JOIN board_access ba ON ba.user_id = u.id
        JOIN boards b ON ba.board_id = b.id
        JOIN connect_user cu ON cu.user_id = u.id AND cu.board_id = b.id
        WHERE b.code = $1 AND ba.is_banned = false
        ORDER BY u.full_name
    `, [code]);
    
    return result.rows;
}

// Добавление/обновление прав доступа пользователя
async function updateBoardAccess(boardId, userId, canDraw, isBanned) {
    if (isBanned !== undefined) {
        await pool.query(`
            INSERT INTO board_access (board_id, user_id, can_draw, is_banned)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (board_id, user_id)
            DO UPDATE SET can_draw = $3, is_banned = $4
        `, [boardId, userId, canDraw, isBanned]);
    } else {
        await pool.query(`
            INSERT INTO board_access (board_id, user_id, can_draw)
            VALUES ($1, $2, $3)
            ON CONFLICT (board_id, user_id)
            DO UPDATE SET can_draw = $3
        `, [boardId, userId, canDraw]);
    }
}

// Добавление пользователя в таблицу соединений
async function addUserConnection(userId, boardId) {
    await pool.query(`
        INSERT INTO connect_user (user_id, board_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, board_id) DO NOTHING
    `, [userId, boardId]);
}

// Удаление соединения пользователя
async function removeUserConnection(userId, boardId) {
    await pool.query(`
        DELETE FROM connect_user 
        WHERE user_id = $1 AND board_id = $2
    `, [userId, boardId]);
}

// Проверка онлайн-статуса пользователя
async function isUserOnline(userId, boardId) {
    const result = await pool.query(`
        SELECT 1 FROM connect_user 
        WHERE user_id = $1 AND board_id = $2
    `, [userId, boardId]);
    
    return result.rows.length > 0;
}

// Получение пути к файлу истории
function getHistoryPath(boardCode) {
    return path.join(process.cwd(), 'board_history', boardCode, 'history.json');
}

// Получение истории рисования
function getDrawingHistory(boardCode) {
    const historyPath = getHistoryPath(boardCode);
    let drawingHistory = [];
    
    if (fs.existsSync(historyPath)) {
        const fileContent = fs.readFileSync(historyPath, 'utf8');
        if (fileContent) {
            drawingHistory = JSON.parse(fileContent);
        }
    }
    
    return drawingHistory;
}

// Сохранение истории рисования
async function saveDrawingHistory(boardCode, drawData) {
    try {
        const historyDir = path.join(process.cwd(), 'board_history', boardCode);
        const historyPath = path.join(historyDir, 'history.json');
        
        if (!global.drawingBuffer) {
            global.drawingBuffer = {};
        }
        
        if (!global.drawingBuffer[boardCode]) {
            global.drawingBuffer[boardCode] = {
                data: [],
                timeout: null
            };
        }
        
        global.drawingBuffer[boardCode].data.push(drawData);
        
        if (global.drawingBuffer[boardCode].timeout) {
            clearTimeout(global.drawingBuffer[boardCode].timeout);
        }
        
        global.drawingBuffer[boardCode].timeout = setTimeout(async () => {
            try {
                if (!fs.existsSync(historyDir)) {
                    fs.mkdirSync(historyDir, { recursive: true });
                }
                
                let history = [];
                if (fs.existsSync(historyPath)) {
                    const fileContent = fs.readFileSync(historyPath, 'utf8');
                    if (fileContent) {
                        history = JSON.parse(fileContent);
                    }
                }
                
                history.push(...global.drawingBuffer[boardCode].data);
                fs.writeFileSync(historyPath, JSON.stringify(history));
                
                global.drawingBuffer[boardCode].data = [];
                
            } catch (err) {
                logger.error('Error saving drawing buffer:', err);
            }
        }, 1000);
        
    } catch (err) {
        logger.error('Error in saveDrawingHistory:', err);
    }
}

// Очистка истории доски
function clearBoardHistory(boardCode) {
    const historyDir = path.join(process.cwd(), 'board_history', boardCode);
    const historyPath = path.join(historyDir, 'history.json');
    
    if (fs.existsSync(historyPath)) {
        fs.writeFileSync(historyPath, '[]');
        return true;
    }
    return false;
}

module.exports = {
    generateBoardCode,
    createBoard,
    joinBoard,
    getUserBoards,
    getBoardAccessInfo,
    getBoardUsers,
    getOnlineUsers,
    updateBoardAccess,
    addUserConnection,
    removeUserConnection,
    isUserOnline,
    getHistoryPath,
    getDrawingHistory,
    saveDrawingHistory,
    clearBoardHistory
}; 