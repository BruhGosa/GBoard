const { pool } = require('./db');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');

// Регистрация нового пользователя
async function registerUser(full_name, password) {
    const userExists = await pool.query(
        'SELECT * FROM "user" WHERE full_name = $1',
        [full_name]
    );

    if (userExists.rows.length > 0) {
        return { success: false, error: 'Пользователь уже существует' };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
        'INSERT INTO "user" (full_name, password) VALUES ($1, $2) RETURNING id',
        [full_name, hashedPassword]
    );

    return { success: true, userId: result.rows[0].id };
}

// Проверка авторизации пользователя
async function loginUser(full_name, password) {
    const result = await pool.query(
        'SELECT * FROM "user" WHERE full_name = $1',
        [full_name]
    );

    if (result.rows.length > 0) {
        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (validPassword) {
            return { success: true, userId: user.id };
        }
    }
    
    return { success: false, error: 'Неверное имя пользователя или пароль' };
}

// Получение данных пользователя
async function getUserData(userId) {
    const result = await pool.query(
        'SELECT full_name, link_avatar FROM "user" WHERE id = $1',
        [userId]
    );

    if (result.rows.length > 0) {
        return {
            authenticated: true,
            userName: result.rows[0].full_name,
            avatarUrl: result.rows[0].link_avatar
        };
    }
    return { authenticated: false };
}

// Обновление имени пользователя
async function updateUsername(userId, username) {
    // Проверяем, не занято ли имя другим пользователем
    const checkResult = await pool.query(
        'SELECT id FROM "user" WHERE full_name = $1 AND id != $2',
        [username, userId]
    );

    if (checkResult.rows.length > 0) {
        return { success: false, error: 'Это имя пользователя уже занято' };
    }

    // Обновляем имя пользователя
    await pool.query(
        'UPDATE "user" SET full_name = $1 WHERE id = $2',
        [username, userId]
    );

    logger.info('Username updated', { userId, newUsername: username });
    return { success: true, userName: username };
}

// Обновление аватарки пользователя
async function updateAvatar(userId, avatarPath) {
    await pool.query(
        'UPDATE "user" SET link_avatar = $1 WHERE id = $2',
        [avatarPath, userId]
    );

    logger.info('User avatar updated', { userId, avatarPath });
    return { success: true, avatarUrl: avatarPath };
}

// Получение обновленных данных профиля
async function getUpdatedProfile(userId) {
    const userResult = await pool.query(
        'SELECT full_name, link_avatar FROM "user" WHERE id = $1',
        [userId]
    );

    return { 
        success: true, 
        userName: userResult.rows[0].full_name,
        avatarUrl: userResult.rows[0].link_avatar 
    };
}

module.exports = {
    registerUser,
    loginUser,
    getUserData,
    updateUsername,
    updateAvatar,
    getUpdatedProfile
}; 