const WebSocket = require('ws');
const { pool } = require('../models/db');
const boardModel = require('../models/board');
const logger = require('../utils/logger');

// Инициализация WebSocket сервера
function initWebSocketServer(server, sessionParser) {
    const wss = new WebSocket.Server({ 
        server,
        verifyClient: (info, cb) => {
            sessionParser(info.req, {}, () => {
                if (!info.req.session.userId) {
                    cb(false, 401, 'Unauthorized');
                    return;
                }
                cb(true);
            });
        },
        clientTracking: true,
        pingTimeout: 105 * 60 * 1000 
    });

    setupConnectionHandlers(wss);
    setupPingPong(wss);

    return wss;
}

// Настройка обработчиков подключения
function setupConnectionHandlers(wss) {
    wss.on('connection', async (ws, req) => {
        try {
            const userId = req.session.userId;
            const boardCode = req.url.split('/').pop();

            ws.userId = userId;
            ws.boardCode = boardCode;

            logger.info('WebSocket connection attempt', { userId, boardCode });

            // Получаем информацию о доске и правах пользователя
            const boardInfo = await boardModel.getBoardAccessInfo(boardCode, userId);
            
            if (!boardInfo) {
                logger.error('Access denied for user', { userId, boardCode });
                ws.close(1008, 'Access denied');
                return;
            }

            // Проверяем, не забанен ли пользователь
            if (boardInfo.is_banned) {
                logger.error('Banned user tried to connect', { userId, boardCode });
                ws.send(JSON.stringify({ type: 'banned' }));
                ws.close(1008, 'Banned');
                return;
            }

            logger.debug('Board access verified', { userId, boardCode });

            // Добавляем пользователя в список активных пользователей
            await boardModel.addUserConnection(userId, boardInfo.board_id);
            logger.debug('User added to connect_user', { userId, boardInfo });

            // Получаем историю рисования
            const drawingHistory = boardModel.getDrawingHistory(boardCode);
            logger.debug('Drawing history loaded', { 
                boardCode, 
                historyLength: drawingHistory.length 
            });

            // Получаем список пользователей
            const onlineUsers = await boardModel.getOnlineUsers(boardCode);
            const allUsers = await boardModel.getBoardUsers(boardCode);

            logger.debug('Users retrieved', { 
                boardCode, 
                onlineCount: onlineUsers.length,
                allCount: allUsers.length
            });

            // Отправляем начальные данные клиенту
            const initMessage = {
                type: 'init',
                boardName: boardInfo.name,
                users: onlineUsers,
                allUsers: allUsers,
                history: drawingHistory,
                canDraw: boardInfo.can_draw,
                isOwner: boardInfo.is_owner,
                userId: userId
            };

            ws.send(JSON.stringify(initMessage));
            logger.debug('Init data sent to client', { 
                userId, 
                boardCode,
                historyLength: drawingHistory.length
            });

            // Отправляем обновленный список пользователей всем клиентам
            broadcastUsersList(wss, boardCode, onlineUsers, allUsers);

            // Настраиваем мониторинг соединения
            ws.isAlive = true;
            ws.on('pong', () => {
                ws.isAlive = true;
            });

            // Обработка отключения клиента
            ws.on('close', () => handleClientDisconnect(wss, ws));

            // Обработка сообщений от клиента
            ws.on('message', (message) => handleClientMessage(wss, ws, message, boardInfo));

        } catch (err) {
            logger.error('WebSocket connection error:', err);
            ws.close();
        }
    });
}

// Настройка механизма ping-pong для отслеживания активных соединений
function setupPingPong(wss) {
    const pingInterval = setInterval(() => {
        wss.clients.forEach(ws => {
            if (!ws.isAlive) {
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    // Очистка интервала при завершении работы сервера
    wss.on('close', () => {
        clearInterval(pingInterval);
    });
}

// Обработка отключения клиента
async function handleClientDisconnect(wss, ws) {
    const userId = ws.userId;
    const boardCode = ws.boardCode;
    
    if (userId && boardCode) {
        try {
            // Получаем board_id по коду доски
            const boardResult = await pool.query(
                'SELECT id FROM boards WHERE code = $1',
                [boardCode]
            );
            
            if (boardResult.rows.length > 0) {
                const boardId = boardResult.rows[0].id;
                
                // Удаляем запись из connect_user
                await boardModel.removeUserConnection(userId, boardId);
                
                logger.info('Пользователь отключен и удален из connect_user', {
                    userId, boardCode
                });
                
                // Получаем обновленные списки пользователей
                const allUsers = await boardModel.getBoardUsers(boardCode);
                const onlineUsers = await boardModel.getOnlineUsers(boardCode);
                
                // Отправляем всем обновленные списки
                broadcastUsersList(wss, boardCode, onlineUsers, allUsers);
            }
        } catch (err) {
            logger.error('Ошибка при обработке отключения пользователя', err);
        }
    }
}

// Отправка обновленного списка пользователей всем клиентам
function broadcastUsersList(wss, boardCode, onlineUsers, allUsers) {
    const usersList = {
        type: 'users_update',
        onlineUsers: onlineUsers,
        allUsers: allUsers
    };
    
    wss.clients.forEach(client => {
        if (client.boardCode === boardCode && 
            client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(usersList));
        }
    });
}

// Обработка сообщений от клиента
async function handleClientMessage(wss, ws, message, boardInfo) {
    try {
        const data = JSON.parse(message);
        const boardCode = ws.boardCode;
        
        if (data.type === 'draw') {
            if (!boardInfo.can_draw) {
                return;
            }

            // Отправляем данные всем клиентам
            broadcastToOthers(wss, ws, data);

            // Сохраняем в историю
            await boardModel.saveDrawingHistory(boardCode, data);
            
        } else if (data.type === 'draw_complete') {
            // Сохраняем маркер завершения действия
            const completeMarker = {
                type: 'draw_complete',
                userId: data.userId,
                timestamp: Date.now()
            };
            
            await boardModel.saveDrawingHistory(boardCode, completeMarker);
            
        } else if (data.type === 'text') {
            if (!boardInfo.can_draw) {
                return;
            }

            // Отправляем текст всем клиентам
            broadcastToOthers(wss, ws, data);

            // Сохраняем в историю
            await boardModel.saveDrawingHistory(boardCode, data);
            
        } else if (data.type === 'clear' && data.clearHistory) {
            // Очищаем историю рисования
            boardModel.clearBoardHistory(boardCode);

            // Отправляем команду очистки всем клиентам
            broadcastToAll(wss, boardCode, { type: 'clear' });
            
        } else if (data.type === 'fetch_all_users') {
            // Получаем всех пользователей доски для обновления интерфейса
            const allUsers = await boardModel.getBoardUsers(boardCode);
            
            // Отправляем данные клиенту
            ws.send(JSON.stringify({
                type: 'all_users_update',
                allUsers: allUsers
            }));
            
        } else if (data.type === 'undo' || data.type === 'redo') {
            if (!boardInfo.can_draw) {
                return;
            }
            
            handleUndoRedo(wss, ws, data);
        }
    } catch (err) {
        logger.error('WebSocket message error:', err);
    }
}

// Отправка данных всем клиентам, кроме отправителя
function broadcastToOthers(wss, sender, data) {
    wss.clients.forEach(client => {
        if (client.boardCode === sender.boardCode && 
            client.readyState === WebSocket.OPEN && 
            client !== sender) {
            client.send(JSON.stringify(data));
        }
    });
}

// Отправка данных всем клиентам
function broadcastToAll(wss, boardCode, data) {
    wss.clients.forEach(client => {
        if (client.boardCode === boardCode && 
            client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// Обработка операций отмены/повтора
async function handleUndoRedo(wss, ws, data) {
    try {
        const boardCode = ws.boardCode;
        const userId = ws.userId;
        
        // Получаем историю рисования
        const historyPath = boardModel.getHistoryPath(boardCode);
        const fs = require('fs');
        let history = boardModel.getDrawingHistory(boardCode);
        
        // Находим последнее действие пользователя для отмены/повтора
        let actionGroup = [];
        let lastCompleteMarkerIndex = -1;
        
        if (data.type === 'undo') {
            // Ищем действия пользователя с конца истории
            for (let i = history.length - 1; i >= 0; i--) {
                if (history[i].userId === userId) {
                    if (history[i].type === 'draw_complete') {
                        // Если нашли маркер завершения, запоминаем его позицию
                        if (lastCompleteMarkerIndex === -1) {
                            lastCompleteMarkerIndex = i;
                        } else {
                            // Если уже был найден маркер, значит, нашли начало группы действий
                            break;
                        }
                    } else {
                        // Если действие после маркера завершения, добавляем в группу для отмены
                        if (lastCompleteMarkerIndex !== -1) {
                            actionGroup.unshift(i);
                        }
                    }
                }
            }
            
            // Удаляем группу действий и маркер завершения
            if (actionGroup.length > 0 || lastCompleteMarkerIndex !== -1) {
                // Удаляем действия из группы
                for (let i = 0; i < actionGroup.length; i++) {
                    // Учитываем смещение индексов при удалении
                    const adjustedIndex = actionGroup[i] - i;
                    history.splice(adjustedIndex, 1);
                }
                
                // Удаляем маркер завершения, если он есть
                if (lastCompleteMarkerIndex !== -1) {
                    // Корректируем индекс с учетом удаленных действий
                    const adjustedMarkerIndex = lastCompleteMarkerIndex - actionGroup.length;
                    history.splice(adjustedMarkerIndex, 1);
                }
                
                // Сохраняем обновленную историю
                fs.writeFileSync(historyPath, JSON.stringify(history));
                
                // Отправляем обновленную историю всем клиентам
                broadcastToAll(wss, boardCode, {
                    type: 'history_update',
                    history: history,
                    action: data.type
                });
            } else {
                // Если действий для отмены нет, сообщаем клиенту
                ws.send(JSON.stringify({
                    type: 'history_update_failed',
                    message: 'Нет действий для отмены'
                }));
            }
        } else if (data.type === 'redo') {
            // Для операции повтора требуется дополнительная реализация кэширования отмененных действий
            ws.send(JSON.stringify({
                type: 'history_update_failed',
                message: 'Операция повтора пока не реализована'
            }));
        }
    } catch (err) {
        logger.error('Error in handleUndoRedo:', err);
    }
}

module.exports = {
    initWebSocketServer
}; 