// Функции для работы с модальными окнами (глобальная область видимости)
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Закрытие модального окна при клике вне его
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
};

// Глобальная функция для копирования кода приглашения
function copyInviteCode() {
    try {
        const boardCode = window.location.pathname.split('/').pop();
        const inviteText = `Онлайн доска: http://gosoboard.na4u.ru/ . Код доступа к доске ${boardCode}. Для того чтобы подключиться к доске нужно сначала войти в систему.`;
        
        // Создаем временный элемент textarea
        const textarea = document.createElement('textarea');
        textarea.value = inviteText;
        textarea.style.position = 'fixed';  // Элемент вне зоны видимости
        document.body.appendChild(textarea);
        textarea.select();
        
        // Пробуем скопировать через execCommand (работает в большинстве браузеров)
        const successful = document.execCommand('copy');
        
        document.body.removeChild(textarea);
        
        if (successful) {
            alert('Код приглашения скопирован в буфер обмена!');
        } else {
            alert('Не удалось скопировать автоматически. Код доски: ' + boardCode);
        }
    } catch (err) {
        console.error('Ошибка при копировании:', err);
        alert('Не удалось скопировать. Пожалуйста, скопируйте код вручную: ' + boardCode);
    }
}

const canvas = document.getElementById('drawingBoard');
const ctx = canvas.getContext('2d');
const canvasContainer = document.getElementById('canvasContainer');
const canvasWrapper = document.getElementById('canvasWrapper');
const moveBtn = document.getElementById('moveBtn');
const zoomBtn = document.getElementById('zoomBtn');
const zoomSlider = document.getElementById('zoomSlider');
const zoomValue = document.getElementById('zoomValue');
const zoomSliderContainer = document.getElementById('zoomSliderContainer');
const colorPicker = document.getElementById('colorPicker');
const sizeSlider = document.getElementById('sizeSlider');
const sizeValue = document.getElementById('sizeValue');
const clearBtn = document.getElementById('clearBtn');
const eraserBtn = document.getElementById('eraserBtn');
const brushBtn = document.getElementById('brushBtn');
const textBtn = document.getElementById('textBtn');
const textOverlay = document.getElementById('textOverlay');
const userCounter = document.getElementById('userCounter');

// Глобальные переменные
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let isLoading = false;
let isEraser = false;
let isTextMode = false;
let textPosition = null;
let originalCanvas = null; // Для хранения состояния холста до начала ввода текста
let isOwner = false; // Флаг владельца доски
let sessionTimeout;
const SESSION_DURATION = 105 * 60 * 1000; // 1 час 45 минут
let banningUserId = null; // Для хранения ID пользователя, которого собираются забанить
let globalAvatars = {}; // Глобальное хранилище аватарок
let isMoveMode = false;
let isDragging = false;
let currentScale = 1;
let currentX = 0;
let currentY = 0;

// Флаги для отслеживания доступности отмены/повтора
let canUndo = false;
let canRedo = false;

// Переменные для хранения истории действий
let actionHistory = [];
let currentHistoryIndex = -1;
const MAX_HISTORY_LENGTH = 25; // Максимальное количество действий в истории
let userId = null; // ID пользователя для идентификации действий

// Инициализация переменных для нового интерфейса
let currentTool = 'brush'; // По умолчанию выбрана кисть
let brushSize = 5;
let eraserSize = 10;
let textSize = 16;
let brushColor = '#000000';
let textColor = '#000000';

// Константы для ограничения перемещения
const MAX_OFFSET = 1000; // Максимальное смещение в пикселях
const MOVE_SENSITIVITY = 0.5; // Увеличиваем чувствительность перемещения

// Функция для логирования на клиенте
function logToFile(message, type = 'info') {
    fetch('/log', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message,
            type
        })
    }).catch(err => console.error('Ошибка логирования:', err));
}

// Получаем код доски из URL
const boardCode = window.location.pathname.split('/').pop();

// Создаем WebSocket соединение с кодом доски
// Используем относительный URL, чтобы браузер автоматически использовал 
// правильный протокол (ws:// для HTTP, wss:// для HTTPS)
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
// Используем текущий хост с соответствующим протоколом
const wsUrl = `${wsProtocol}//${window.location.host}/ws/${boardCode}`;
console.log('WebSocket URL:', wsUrl);
const ws = new WebSocket(wsUrl);

// Добавляем логирование для отладки
console.log('Attempting to connect to WebSocket with board code:', boardCode);

ws.onopen = function() {
    logToFile('WebSocket: Подключение установлено');
    // Сбрасываем таймер при открытии соединения
    clearTimeout(sessionTimeout);
    sessionTimeout = setTimeout(showSessionEndedModal, SESSION_DURATION);
};

ws.onclose = function() {
    logToFile('WebSocket: Подключение закрыто', 'error');
    showSessionEndedModal();
};

ws.onerror = function(error) {
    logToFile(`WebSocket: Ошибка: ${error}`, 'error');
};

ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    console.log('Получено сообщение от сервера:', data);
    
    resetSessionTimer(); // Сбрасываем таймер при получении сообщений
    
    if (data.type === 'init') {
        console.log('Получены данные инициализации:', data);
        // Обновляем название доски
        updateBoardName(data.boardName);
        
        // Сохраняем ID пользователя для истории действий
        userId = data.userId;
        
        // Загружаем историю рисования
        if (data.history && data.history.length > 0) {
            console.log('Loading drawing history:', data.history.length, 'items');
            ctx.clearRect(0, 0, canvas.width, canvas.height); // Очищаем холст перед загрузкой
            data.history.forEach(item => {
                if (item.type === 'draw') {
                    drawRemote(item);
                } else if (item.type === 'text') {
                    drawText(item);
                }
            });
        }
        
        // Обрабатываем историю рисования
        drawingHistory = data.history;
        isOwner = data.isOwner;
        
        // Обновляем доступность кнопок отмены/повтора
        updateUndoRedoButtons();
        
        // Показываем кнопки управления, если пользователь - владелец доски
        if (isOwner) {
            document.getElementById('inviteBtn').style.display = '';
        }
        
        // Сохраняем аватарки пользователей при инициализации
        if (data.allUsers) {
            data.allUsers.forEach(user => {
                if (user.avatar_url) {
                    globalAvatars[user.full_name] = `url('${user.avatar_url}')`;
                }
            });
        }
        
        // Обновляем список пользователей
        if (data.allUsers && data.users) {
            updateUsersLists(data.users, data.allUsers);
        } else {
            // Загружаем всех пользователей, если они не были отправлены с сервера
            fetchAllBoardUsers();
        }
        
        // Настраиваем права доступа
        if (!data.canDraw && !data.isOwner) {
            canvas.style.pointerEvents = 'none';
            colorPicker.disabled = true;
            sizeSlider.disabled = true;
            eraserBtn.disabled = true;
            brushBtn.disabled = true;
            textBtn.disabled = true;
            clearBtn.disabled = true;
        }
    } else if (data.type === 'users_update') {
        // Сохраняем аватарки при обновлении списка пользователей
        if (data.allUsers) {
            data.allUsers.forEach(user => {
                if (user.avatar_url) {
                    globalAvatars[user.full_name] = `url('${user.avatar_url}')`;
                }
            });
        }
        
        // Обновляем списки онлайн и офлайн пользователей
        if (data.onlineUsers && data.allUsers) {
            console.log('Получены данные для обновления списков:',
                'Онлайн:', data.onlineUsers.length,
                'Всего:', data.allUsers.length);
            
            // Проверяем, что массивы не пустые
            if (data.allUsers.length === 0) {
                console.warn('Получен пустой список всех пользователей, запрашиваем заново');
                // В случае получения пустого массива, повторно запрашиваем пользователей
                fetchAllBoardUsers(data.onlineUsers || []);
            } else {
                updateUsersLists(data.onlineUsers, data.allUsers);
            }
        } else {
            // Если данные неполные, запрашиваем все заново
            console.warn('Получены неполные данные пользователей, запрашиваем заново');
            fetchAllBoardUsers();
        }
    } else if (data.type === 'clear') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Сбрасываем флаги отмены/повтора после очистки
        canUndo = false;
        canRedo = false;
        updateUndoRedoButtons();
    } else if (data.type === 'text') {
        drawText(data);
    } else if (data.type === 'draw') {
        // Отрисовываем линию от другого пользователя
        drawRemote(data);
    } else if (data.type === 'history_update') {
        // Обновляем холст на основе обновленной истории
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (data.history && data.history.length > 0) {
            data.history.forEach(item => {
                if (item.type === 'draw') {
                    drawRemote(item);
                } else if (item.type === 'text') {
                    drawText(item);
                }
            });
        }
        
        // Обновляем состояние кнопок в зависимости от действия
        if (data.action === 'undo') {
            canUndo = true; // Разрешаем дальнейшую отмену
            canRedo = true; // Активируем возможность повтора
        } else if (data.action === 'redo') {
            canUndo = true; // Активируем возможность отмены
            canRedo = true; // Разрешаем дальнейший повтор
        }
        
        updateUndoRedoButtons();
    } else if (data.type === 'history_update_failed') {
        // Если отмена или повтор не удались, восстанавливаем состояние кнопок
        canUndo = true;
        canRedo = true;
        updateUndoRedoButtons();
        console.log('История не обновлена:', data.message);
        
        // Можно показать уведомление пользователю
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = data.message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff9800;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 1000;
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    } else if (data.type === 'access_update') {
        // Обновляем права доступа без перезагрузки
        if (data.canDraw) {
            canvas.style.pointerEvents = 'auto';
            colorPicker.disabled = false;
            sizeSlider.disabled = false;
            eraserBtn.disabled = false;
            brushBtn.disabled = false;
            textBtn.disabled = false;
            clearBtn.disabled = false;
        } else {
            canvas.style.pointerEvents = 'none';
            colorPicker.disabled = true;
            sizeSlider.disabled = true;
            eraserBtn.disabled = true;
            brushBtn.disabled = true;
            textBtn.disabled = true;
            clearBtn.disabled = true;
        }
        
        // Показываем уведомление
        const notification = document.createElement('div');
        notification.textContent = `Права доступа ${data.canDraw ? 'разрешены' : 'запрещены'}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 1000;
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    } else if (data.type === 'banned') {
        // Показываем модальное окно с информацией о бане
        document.getElementById('bannedNotificationModal').style.display = 'block';
        
        // Отключаем все интерактивные элементы
        canvas.style.pointerEvents = 'none';
        document.querySelectorAll('button, input, select').forEach(el => {
            el.disabled = true;
        });
        
        // Перенаправляем на страницу бана через 2 секунды
        setTimeout(() => {
            window.location.href = `/ban.html?board=${boardCode}`;
        }, 2000);
    }
};

function drawRemote(data) {
    ctx.beginPath();
    ctx.moveTo(data.lastX, data.lastY);
    ctx.lineTo(data.x, data.y);
    
    if (data.color === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = data.color;
    }
    
    ctx.lineWidth = data.size;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over'; // Восстанавливаем значение по умолчанию
}

function draw(e) {
    if (!isDrawing) return;
    
    const rect = canvas.getBoundingClientRect();
    let x, y;
    
    if (e.type.includes('touch')) {
        // Для touch-событий используем getBoundingClientRect для точного расчета координат
        x = e.touches[0].clientX - rect.left;
        y = e.touches[0].clientY - rect.top;
    } else {
        x = e.offsetX;
        y = e.offsetY;
    }
    
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    
    if (isEraser) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = eraserSize; // Используем размер ластика
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = brushColor; // Используем цвет кисти
        ctx.lineWidth = brushSize; // Используем размер кисти
    }
    
    ctx.lineCap = 'round';
    ctx.stroke();
    
    // Отправляем данные о рисовании
    ws.send(JSON.stringify({
        type: 'draw',
        lastX: lastX,
        lastY: lastY,
        x: x,
        y: y,
        color: isEraser ? 'eraser' : brushColor,
        size: isEraser ? eraserSize : brushSize,
        userId: userId
    }));
    
    [lastX, lastY] = [x, y];
    
    // Восстанавливаем значение globalCompositeOperation после рисования
    if (isEraser) {
        ctx.globalCompositeOperation = 'source-over';
    }
}

function startDrawing(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    let x, y;
    
    if (e.type.includes('touch')) {
        // Для touch-событий используем getBoundingClientRect для точного расчета координат
        x = e.touches[0].clientX - rect.left;
        y = e.touches[0].clientY - rect.top;
    } else {
        x = e.offsetX;
        y = e.offsetY;
    }
    
    [lastX, lastY] = [x, y];
}

function stopDrawing() {
    if (isDrawing) {
        isDrawing = false;
        ctx.globalCompositeOperation = 'source-over';
        
        // Добавляем действие в историю для отмены только когда закончили рисовать
        // а не на каждый пиксель движения мыши
        if (userId) {
            markUndoPoint();
            
            // Отправляем информацию о завершении действия для истории
            ws.send(JSON.stringify({
                type: 'draw_complete',
                userId: userId
            }));
        }
    }
}

// Функция для обновления позиции и масштаба холста
function updateCanvasTransform() {
    // Ограничиваем смещение
    currentX = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, currentX));
    currentY = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, currentY));
    
    const scale = currentScale;
    const x = currentX;
    const y = currentY;
    canvasContainer.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scale})`;
}

// Функция для сброса активных инструментов
function resetActiveTools() {
    const tools = [eraserBtn, brushBtn, textBtn];
    tools.forEach(tool => {
        tool.style.backgroundColor = '';
    });
    isEraser = false;
    isTextMode = false;
    textOverlay.style.display = 'none';
}

// Обработчики для инструментов
clearBtn.addEventListener('click', () => {
    if (confirm('Вы уверены, что хотите очистить доску?')) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ws.send(JSON.stringify({
            type: 'clear',
            clearHistory: true
        }));
        
        // Сбрасываем флаги отмены/повтора после очистки
        canUndo = false;
        canRedo = false;
        updateUndoRedoButtons();
    }
});

eraserBtn.addEventListener('click', () => {
    if (!isMoveMode) {
        isEraser = true;
        isTextMode = false;
        textPosition = null;
        originalCanvas = null;
        textOverlay.style.display = 'none';
        eraserBtn.style.backgroundColor = '#ddd';
        brushBtn.style.backgroundColor = '';
        textBtn.style.backgroundColor = '';
    }
});

brushBtn.addEventListener('click', () => {
    if (!isMoveMode) {
        isEraser = false;
        isTextMode = false;
        textPosition = null;
        originalCanvas = null;
        textOverlay.style.display = 'none';
        brushBtn.style.backgroundColor = '#ddd';
        eraserBtn.style.backgroundColor = '';
        textBtn.style.backgroundColor = '';
    }
});

textBtn.addEventListener('click', () => {
    if (!isMoveMode) {
        isTextMode = !isTextMode;
        isEraser = false;
        textBtn.style.backgroundColor = isTextMode ? '#ddd' : '';
        eraserBtn.style.backgroundColor = '';
        brushBtn.style.backgroundColor = '';
        
        if (!isTextMode) {
            textOverlay.style.display = 'none';
            textOverlay.value = '';
            textPosition = null;
            originalCanvas = null;
        }
    }
});

// Обработчик клика по холсту для текста
canvas.addEventListener('click', (e) => {
    if (!isMoveMode && isTextMode) {
        const x = e.offsetX;
        const y = e.offsetY;
        
        // Если уже есть активный ввод текста, сохраняем его
        if (textPosition && textOverlay.value) {
            const textData = {
                type: 'text',
                x: textPosition.x,
                y: textPosition.y,
                text: textOverlay.value,
                color: textColor,
                font: `${textSize}px Montserrat`,
                userId: userId
            };
            
            // Фиксируем текст на холсте
            originalCanvas = null;
            ws.send(JSON.stringify(textData));
            drawText(textData);
        }
        
        // Сохраняем текущее состояние холста
        originalCanvas = document.createElement('canvas');
        originalCanvas.width = canvas.width;
        originalCanvas.height = canvas.height;
        originalCanvas.getContext('2d').drawImage(canvas, 0, 0);
        
        // Позиционируем и показываем поле ввода
        textOverlay.style.display = 'block';
        textOverlay.style.left = `${x}px`;
        textOverlay.style.top = `${y - parseInt(textSize)/2}px`;
        textOverlay.style.font = `${textSize}px Montserrat`;
        textPosition = { x, y };
        textOverlay.value = '';
        textOverlay.focus();
    }
});

// Функция для включения/отключения режима рисования
function toggleDrawingMode(enable) {
    if (enable) {
        // Включаем обработчики рисования
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseleave', stopDrawing);
        canvas.addEventListener('touchstart', startDrawing);
        canvas.addEventListener('touchmove', draw);
        canvas.addEventListener('touchend', stopDrawing);
    } else {
        // Отключаем обработчики рисования
        canvas.removeEventListener('mousedown', startDrawing);
        canvas.removeEventListener('mousemove', draw);
        canvas.removeEventListener('mouseup', stopDrawing);
        canvas.removeEventListener('mouseleave', stopDrawing);
        canvas.removeEventListener('touchstart', startDrawing);
        canvas.removeEventListener('touchmove', draw);
        canvas.removeEventListener('touchend', stopDrawing);
    }
}

// Обработчик кнопки перемещения
moveBtn.addEventListener('click', () => {
    isMoveMode = !isMoveMode;
    moveBtn.style.backgroundColor = isMoveMode ? '#ddd' : '';
    canvasWrapper.classList.toggle('move-mode');
    
    // Сбрасываем активные инструменты и отключаем рисование
    if (isMoveMode) {
        resetActiveTools();
        toggleDrawingMode(false);
    } else {
        toggleDrawingMode(true);
    }
});

// Обработчик кнопки масштабирования
zoomBtn.addEventListener('click', () => {
    zoomSliderContainer.style.display = zoomSliderContainer.style.display === 'none' ? 'block' : 'none';
    zoomBtn.style.backgroundColor = zoomSliderContainer.style.display === 'block' ? '#ddd' : '';
});

// Обработчик ползунка масштабирования
zoomSlider.addEventListener('input', () => {
    currentScale = parseFloat(zoomSlider.value);
    zoomValue.textContent = `x${currentScale.toFixed(1)}`;
    updateCanvasTransform();
});

// Обработчики перемещения холста
let moveTimeout;
let lastTouchX = 0;
let lastTouchY = 0;

document.addEventListener('mousedown', handleStartMove);
document.addEventListener('touchstart', handleStartMove, { passive: false });

document.addEventListener('mousemove', handleMove);
document.addEventListener('touchmove', handleMove, { passive: false });

document.addEventListener('mouseup', handleEndMove);
document.addEventListener('touchend', handleEndMove);

function handleStartMove(e) {
    // Проверяем, не взаимодействует ли пользователь с панелью инструментов или пользователей
    if (e.target.closest('.tools-panel') || e.target.closest('.context-panel') || e.target.closest('#usersPanel')) {
        return; // Если взаимодействие с панелями, не начинаем перемещение
    }
    
    if (isMoveMode) {
        isDragging = true;
        if (e.type === 'touchstart') {
            lastTouchX = e.touches[0].clientX;
            lastTouchY = e.touches[0].clientY;
        } else {
            lastX = e.clientX;
            lastY = e.clientY;
        }
        e.preventDefault();
    }
}

function handleMove(e) {
    // Проверяем, не взаимодействует ли пользователь с панелью инструментов или пользователей
    if (e.target.closest('.tools-panel') || e.target.closest('.context-panel') || e.target.closest('#usersPanel')) {
        return; // Если взаимодействие с панелями, не обрабатываем движение
    }
    
    if (isMoveMode && isDragging) {
        moveTimeout = requestAnimationFrame(() => {
            let deltaX, deltaY;
            if (e.type === 'touchmove') {
                deltaX = (e.touches[0].clientX - lastTouchX) * MOVE_SENSITIVITY;
                deltaY = (e.touches[0].clientY - lastTouchY) * MOVE_SENSITIVITY;
                lastTouchX = e.touches[0].clientX;
                lastTouchY = e.touches[0].clientY;
            } else {
                deltaX = (e.clientX - lastX) * MOVE_SENSITIVITY;
                deltaY = (e.clientY - lastY) * MOVE_SENSITIVITY;
                lastX = e.clientX;
                lastY = e.clientY;
            }
            currentX += deltaX;
            currentY += deltaY;
            updateCanvasTransform();
        });
        e.preventDefault();
    }
}

function handleEndMove() {
    isDragging = false;
    if (moveTimeout) {
        cancelAnimationFrame(moveTimeout);
    }
}

// Отключаем стандартное поведение колесика мыши
document.addEventListener('wheel', (e) => {
    if (isMoveMode) {
        e.preventDefault();
    }
}, { passive: false });

// Функция предпросмотра текста
function drawPreview() {
    if (!isTextMode || !textPosition) return;

    // Восстанавливаем оригинальное состояние холста
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (originalCanvas) {
        ctx.drawImage(originalCanvas, 0, 0);
    }

    // Рисуем текст поверх
    ctx.save();
    ctx.font = `${textSize}px Montserrat`; // Используем новый размер текста
    ctx.fillStyle = textColor; // Используем новый цвет текста
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(textOverlay.value, textPosition.x, textPosition.y);
    ctx.restore();

    if (isTextMode && textPosition) {
        requestAnimationFrame(drawPreview);
    }
}

// Обновляем обработчик ввода текста
let previewTimeout;
textOverlay.addEventListener('input', () => {
    // Отменяем предыдущий таймаут
    if (previewTimeout) {
        cancelAnimationFrame(previewTimeout);
    }
    // Запускаем новый кадр анимации
    previewTimeout = requestAnimationFrame(drawPreview);
});

// Добавляем обработчик Enter в поле ввода текста
textOverlay.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && textPosition && textOverlay.value) {
        const textData = {
            type: 'text',
            x: textPosition.x,
            y: textPosition.y,
            text: textOverlay.value,
            color: textColor,
            font: `${textSize}px Montserrat`,
            userId: userId
        };

        if (ws) {
            ws.send(JSON.stringify(textData));
        }
        drawText(textData);

        textOverlay.value = '';
        textOverlay.style.display = 'none';
        textPosition = null;
    }
});

// Модифицируем функцию отрисовки текста
function drawText(data) {
    // Сохраняем текущие настройки контекста
    ctx.save();
    
    // Настраиваем параметры текста
    ctx.font = data.font;
    ctx.fillStyle = data.color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    
    // Рисуем текст
    ctx.fillText(data.text, data.x, data.y);
    
    // Восстанавливаем настройки контекста
    ctx.restore();
    
    // Активируем отмену после добавления текста
    markUndoPoint();
}

// Добавляем стили
const styles = document.createElement('style');
styles.textContent = `
    #sizeValue {
        display: inline-block;
        min-width: 45px;
        margin-left: 5px;
        font-family: Arial;
        font-size: 14px;
        vertical-align: middle;
    }
    #controls input[type="range"] {
        vertical-align: middle;
    }
`;
document.head.appendChild(styles);

// Добавляем обработчик изменения размера
sizeSlider.addEventListener('input', () => {
    const size = sizeSlider.value;
    sizeValue.textContent = `${size}px`;
    
    // Обновляем размер шрифта для текстового поля
    if (textOverlay) {
        textOverlay.style.font = `${size}px Arial`;
    }
});

// Функция открытия модального окна приглашения пользователей
const inviteBtn = document.getElementById('inviteBtn');
inviteBtn.style.display = ''; // Показываем кнопку по умолчанию

// Обработчик нажатия кнопки приглашения
inviteBtn.addEventListener('click', () => {
    document.getElementById('inviteCodeText').innerText = boardCode;
    openModal('inviteModal');
});

// Закрытие модального окна
document.querySelectorAll('.modal .close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        closeModal(btn.closest('.modal').id);
    });
});

// Обновляем функцию обновления прав доступа
async function updateUserAccess(userId, canDraw, isOfflineUser = false) {
    if (!userId) {
        console.error('userId is undefined or null');
        return;
    }

    try {
        console.log('Updating access for user:', userId, 'canDraw:', canDraw, 'isOffline:', isOfflineUser);
        
        const response = await fetch('/update-board-access', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                boardCode,
                userId: Number(userId),
                canDraw: Boolean(canDraw),
                isOfflineUser: isOfflineUser  // Добавляем флаг для определения офлайн-пользователя
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Ошибка обновления прав доступа');
        }
        
        // Уведомление будет показано при получении ответа от сервера через WebSocket
        // Списки пользователей также будут обновлены через WebSocket
        
    } catch (err) {
        console.error('Ошибка обновления прав доступа:', err);
        alert(err.message || 'Не удалось обновить права доступа');
    }
}

// Функция для загрузки всех пользователей доски (как онлайн, так и офлайн)
async function fetchAllBoardUsers(onlineUsers = []) {
    // Предотвращаем частые повторные запросы
    if (window.fetchingUsers) {
        console.log('Уже выполняется запрос списка пользователей, пропускаем');
        return;
    }
    
    window.fetchingUsers = true;
    
    try {
        // Защита от некорректных значений
        if (!Array.isArray(onlineUsers)) {
            onlineUsers = [];
        }
        
        console.log('Запрашиваем полный список пользователей доски...');
        
        const response = await fetch(`/board-users/${boardCode}`);
        if (!response.ok) {
            throw new Error(`Ошибка получения пользователей: ${response.status}`);
        }
        
        const allUsers = await response.json();
        
        // Проверяем, что получили массив
        if (!Array.isArray(allUsers)) {
            console.error('Получен неверный формат данных пользователей:', allUsers);
            return;
        }
        
        console.log('Получен список всех пользователей:', allUsers.length);
        
        if (allUsers.length === 0) {
            console.warn('Получен пустой список пользователей от сервера');
            // Даже если список пуст, мы всё равно обновляем интерфейс
        }
        
        // Если не переданы онлайн пользователи, определяем их на основе полного списка
        if (onlineUsers.length === 0) {
            // В этом случае считаем онлайн незабаненных пользователей из connect_user
            // В этом методе мы не можем точно знать кто онлайн, но можем примерно
            // В таком случае WebSocket обновит список позже с точными данными
            onlineUsers = allUsers.filter(user => !user.is_banned);
        }
        
        // Обновляем списки
        updateUsersLists(onlineUsers, allUsers);
    } catch (err) {
        console.error('Ошибка загрузки всех пользователей:', err);
        
        // Если произошла ошибка, но у нас есть хоть какие-то данные, 
        // лучше обновить интерфейс с тем что есть
        if (onlineUsers.length > 0) {
            updateUsersLists(onlineUsers, onlineUsers);
        }
    } finally {
        // Сбрасываем флаг через небольшую задержку,
        // чтобы предотвратить слишком частые повторные запросы
        setTimeout(() => {
            window.fetchingUsers = false;
        }, 1000);
    }
}

// Функция обновления списков пользователей (онлайн и офлайн)
function updateUsersLists(onlineUsers, allUsers) {
    const onlineList = document.getElementById('usersOnlineList');
    const offlineList = document.getElementById('usersOfflineList');
    const userCounter = document.getElementById('userCounter');
    
    // Проверка на null и существование элементов
    if (!onlineList) {
        console.error('Элемент списка онлайн-пользователей не найден');
        return;
    }
    
    if (!offlineList) {
        console.error('Элемент списка офлайн-пользователей не найден');
        return;
    }

    // Проверяем, если параметр onlineUsers пустой
    if (!onlineUsers || !Array.isArray(onlineUsers)) {
        onlineUsers = [];
    }

    // Проверяем, если параметр allUsers пустой
    if (!allUsers || !Array.isArray(allUsers) || allUsers.length === 0) {
        allUsers = [...onlineUsers];
    }
    
    console.log('Обновление списков пользователей:',
        'Онлайн:', onlineUsers.length,
        'Всего:', allUsers.length);
    
    try {
        // Сохраняем текущие аватарки пользователей
        const currentAvatars = {};
        const allUserElements = document.querySelectorAll('.user-list-item');
        allUserElements.forEach(element => {
            const avatarElement = element.querySelector('.user-avatar');
            const userNameElement = element.querySelector('span');
            if (avatarElement && userNameElement) {
                const userName = userNameElement.textContent.split(' (')[0]; // Убираем статус бана из имени
                if (avatarElement.style.backgroundImage) {
                    currentAvatars[userName] = avatarElement.style.backgroundImage;
                } else if (avatarElement.classList.contains('avatar-default')) {
                    currentAvatars[userName] = 'default';
                }
            }
        });

        // Формируем список пользователей онлайн (незабаненных)
        if (onlineUsers && onlineUsers.length > 0) {
            // Фильтруем только незабаненных пользователей для отображения в онлайн списке
            const onlineUnbannedUsers = onlineUsers.filter(user => !user.is_banned);
            
            if (onlineUnbannedUsers.length > 0) {
                onlineList.innerHTML = onlineUnbannedUsers
                    .map(user => createUserItem(user, true, currentAvatars))
                    .join('');
            } else {
                onlineList.innerHTML = '<p style="color: #999; font-style: italic;">Никого нет онлайн</p>';
            }
        } else {
            onlineList.innerHTML = '<p style="color: #999; font-style: italic;">Никого нет онлайн</p>';
        }
        
        // Создаем список ID пользователей онлайн для фильтрации (включая незабаненных)
        const onlineUnbannedIds = new Set(onlineUsers.filter(u => !u.is_banned).map(u => u.id));
        
        // Собираем всех пользователей, которые должны отображаться в офлайн списке:
        // 1. Офлайн пользователи (не в списке онлайн)
        // 2. Забаненные пользователи (независимо от того, онлайн они или нет)
        const offlineUsers = allUsers.filter(user => 
            !onlineUnbannedIds.has(user.id) || user.is_banned
        );
        
        console.log('Пользователи офлайн/забаненные:', offlineUsers.length);
        
        // Формируем список пользователей офлайн
        if (offlineUsers.length > 0) {
            offlineList.innerHTML = offlineUsers.map(user => createUserItem(user, false, currentAvatars)).join('');
        } else {
            offlineList.innerHTML = '<p style="color: #999; font-style: italic;">В данный момент нет пользователей офлайн</p>';
        }
        
        // Обновляем счетчик пользователей
        if (userCounter) {
            const onlineCount = onlineUsers.filter(user => !user.is_banned).length;
            userCounter.textContent = `Онлайн: ${onlineCount}`;
        }
        
        // Добавляем кнопку "Пригласить пользователей" в блок онлайн пользователей
        // Делаем доступным только владельцу доски
        if (isOwner) {
            const inviteButton = document.createElement('div');
            inviteButton.className = 'invite-users-link';
            inviteButton.innerHTML = '<a href="#" onclick="openModal(\'inviteModal\'); return false;">Пригласить пользователей</a>';
            onlineList.appendChild(inviteButton);
        }
    } catch (error) {
        console.error('Ошибка при обновлении списков пользователей:', error);
    }
}

// Функция для переключения выпадающего меню
function toggleDropdown(userId) {
    const dropdownContent = document.getElementById(`dropdown-${userId}`);
    dropdownContent.classList.toggle('show');
}

// Функция для закрытия выпадающего меню
function closeDropdown(userId) {
    const dropdownContent = document.getElementById(`dropdown-${userId}`);
    dropdownContent.classList.remove('show');
}

// Функция создания элемента пользователя для списка
function createUserItem(user, isOnline, savedAvatars = {}) {
    // Проверяем, есть ли все необходимые данные пользователя
    if (!user || !user.id || !user.full_name) {
        console.warn('Неполные данные пользователя:', user);
        return '';
    }
    
    // Создаем элемент аватарки
    let avatarHtml;
    // Сначала проверяем глобальное хранилище аватарок
    if (globalAvatars[user.full_name]) {
        avatarHtml = `<div class="user-avatar" style="background-image: ${globalAvatars[user.full_name]}"></div>`;
    } else if (user.avatar_url) {
        // Если аватарка есть в данных пользователя, сохраняем её в глобальное хранилище
        globalAvatars[user.full_name] = `url('${user.avatar_url}')`;
        avatarHtml = `<div class="user-avatar" style="background-image: ${globalAvatars[user.full_name]}"></div>`;
    } else {
        const userInitial = user.full_name.charAt(0).toUpperCase();
        avatarHtml = `<div class="user-avatar avatar-default">${userInitial}</div>`;
    }
    
    // Добавляем кнопку троеточия только для владельца доски и не для самого владельца
    const dropdownBtn = (isOwner && !user.is_owner) ? 
        `<button class="user-dropdown-btn" onclick="event.stopPropagation(); toggleDropdown(${user.id})">...</button>` 
        : '';
    
    // Добавляем параметр isOfflineUser для функции updateUserAccess
    return `
        <div class="user-list-item ${user.is_banned ? 'banned-user' : ''} ${isOnline ? 'online' : ''}">
            <div class="user-info">
                ${avatarHtml}
                <span title="${user.full_name} ${user.is_banned ? '(Заблокирован)' : ''}">${user.full_name} ${user.is_banned ? '(Заблокирован)' : ''}</span>
            </div>
            <div class="user-controls">
                ${dropdownBtn}
            </div>
            ${isOwner && !user.is_owner ? `
                <div id="dropdown-${user.id}" class="user-dropdown-content">
                    <span class="dropdown-close" onclick="closeDropdown(${user.id})">&times;</span>
                    <div class="buttons-container">
                    ${!user.is_banned ? `
                        <button 
                            onclick="updateUserAccess(${user.id}, ${!user.can_draw}, ${!isOnline})"
                            class="access-btn ${user.can_draw ? '' : 'denied'}"
                        >
                            ${user.can_draw ? 'Запретить' : 'Разрешить'}
                        </button>
                        <button 
                            onclick="showBanModal(${user.id}, '${user.full_name}')"
                            class="ban-button"
                        >
                            Заблокировать
                        </button>
                    ` : 
                    // Для забаненных пользователей показываем кнопку разбана
                    `<button 
                        onclick="unbanUser(${user.id}, '${user.full_name}')"
                        class="ban-button unban"
                    >
                        Разблокировать
                    </button>`}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

// Функция показа модального окна
function showSessionEndedModal() {
    document.getElementById('sessionModal').style.display = 'block';
    // Отключаем все интерактивные элементы
    canvas.style.pointerEvents = 'none';
    document.querySelectorAll('button, input, select').forEach(el => {
        el.disabled = true;
    });
}

// Обновляем таймер при любом взаимодействии с страницей
function resetSessionTimer() {
    clearTimeout(sessionTimeout);
    sessionTimeout = setTimeout(showSessionEndedModal, SESSION_DURATION);
}

// Добавляем слушатели событий
document.addEventListener('mousemove', resetSessionTimer);
document.addEventListener('keypress', resetSessionTimer);
document.addEventListener('click', resetSessionTimer);
document.addEventListener('scroll', resetSessionTimer);
document.addEventListener('touchstart', resetSessionTimer);

// Функция для открытия модального окна бана
function showBanModal(userId, userName) {
    banningUserId = userId;
    document.getElementById('banUserName').textContent = userName;
    openModal('banModal');
}

// Функция для подтверждения бана пользователя
async function confirmBanUser() {
    if (!banningUserId) return;
    
    try {
        // Заранее получаем полный список всех пользователей, 
        // чтобы иметь запасной вариант на случай проблем с обновлением через websocket
        const allUsersBefore = await (await fetch(`/board-users/${boardCode}`)).json();
        
        const response = await fetch('/update-board-access', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                boardCode,
                userId: banningUserId,
                canDraw: false,
                isBanned: true
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Ошибка бана пользователя');
        }
        
        let responseData;
        try {
            // Пробуем получить данные ответа с актуальными списками пользователей
            responseData = await response.json();
            console.log('Данные ответа после бана:', responseData);
        } catch (e) {
            console.error('Ошибка при получении JSON ответа:', e);
            // Если возникла ошибка при разборе JSON, responseData будет undefined
        }
        
        // Обновляем списки пользователей, если сервер вернул данные
        if (responseData && responseData.onlineUsers && responseData.allUsers && responseData.allUsers.length > 0) {
            updateUsersLists(responseData.onlineUsers, responseData.allUsers);
        } else {
            // Если сервер не вернул списки, используем предварительно загруженные данные
            // или запрашиваем их заново
            try {
                const boardUsersResponse = await fetch(`/board-users/${boardCode}`);
                const allUsers = await boardUsersResponse.json();
                
                // Если вернулся пустой массив или запрос не удался, используем сохраненный ранее список
                if (!Array.isArray(allUsers) || allUsers.length === 0) {
                    console.warn('Получен пустой список пользователей, используем сохраненный');
                    // Обновляем статус бана для забаненного пользователя
                    const updatedAllUsers = allUsersBefore.map(user => {
                        if (user.id == banningUserId) {
                            return {...user, is_banned: true, can_draw: false};
                        }
                        return user;
                    });
                    
                    // Теперь определяем, кто онлайн без учета бана
                    const onlineUsers = updatedAllUsers.filter(user => 
                        user.id == banningUserId || allUsersBefore.some(u => 
                            u.id === user.id && !u.is_banned
                        )
                    );
                    
                    updateUsersLists(onlineUsers, updatedAllUsers);
                } else {
                    // Получаем список онлайн пользователей (без забаненных)
                    const onlineUsers = allUsers.filter(user => !user.is_banned);
                    
                    // Обновляем списки
                    updateUsersLists(onlineUsers, allUsers);
                }
            } catch (fetchError) {
                console.error('Ошибка получения списка пользователей при бане:', fetchError);
                // В крайнем случае используем предварительно загруженные данные
                // Обновляем статус бана для забаненного пользователя
                const updatedAllUsers = allUsersBefore.map(user => {
                    if (user.id == banningUserId) {
                        return {...user, is_banned: true, can_draw: false};
                    }
                    return user;
                });
                
                // Теперь определяем, кто онлайн без учета бана
                const onlineUsers = updatedAllUsers.filter(user => 
                    user.id == banningUserId || !user.is_banned
                );
                
                updateUsersLists(onlineUsers, updatedAllUsers);
            }
        }
        
        // Закрываем модальное окно
        closeModal('banModal');
        
        // Показываем уведомление об успешном бане
        const notification = document.createElement('div');
        notification.textContent = 'Пользователь заблокирован';
        notification.className = 'notification-message';
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
        
    } catch (err) {
        console.error('Ошибка бана пользователя:', err);
        alert(err.message || 'Не удалось заблокировать пользователя');
        closeModal('banModal');
    }
}

// Функция для разбана пользователя
async function unbanUser(userId, userName) {
    try {
        // Заранее получаем полный список всех пользователей, 
        // чтобы иметь запасной вариант на случай проблем с обновлением через websocket
        const allUsersBefore = await (await fetch(`/board-users/${boardCode}`)).json();
        
        const response = await fetch('/update-board-access', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                boardCode,
                userId: userId,
                canDraw: true,
                isBanned: false
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Ошибка разбана пользователя');
        }
        
        let responseData;
        try {
            // Пробуем получить данные ответа с актуальными списками пользователей
            responseData = await response.json();
            console.log('Данные ответа после разбана:', responseData);
        } catch (e) {
            console.error('Ошибка при получении JSON ответа:', e);
            // Если возникла ошибка при разборе JSON, responseData будет undefined
        }
        
        // Обновляем списки пользователей, если сервер вернул данные
        if (responseData && responseData.onlineUsers && responseData.allUsers && responseData.allUsers.length > 0) {
            updateUsersLists(responseData.onlineUsers, responseData.allUsers);
        } else {
            // Если сервер не вернул списки, используем предварительно загруженные данные
            // или запрашиваем их заново
            try {
                const boardUsersResponse = await fetch(`/board-users/${boardCode}`);
                const allUsers = await boardUsersResponse.json();
                
                // Если вернулся пустой массив или запрос не удался, используем сохраненный ранее список
                if (!Array.isArray(allUsers) || allUsers.length === 0) {
                    console.warn('Получен пустой список пользователей при разбане, используем сохраненный');
                    // Обновляем статус бана для разбаненного пользователя
                    const updatedAllUsers = allUsersBefore.map(user => {
                        if (user.id == userId) {
                            return {...user, is_banned: false, can_draw: true};
                        }
                        return user;
                    });
                    
                    // Теперь определяем, кто онлайн без учета бана
                    const onlineUsers = updatedAllUsers.filter(user => 
                        user.id == userId || allUsersBefore.some(u => 
                            u.id === user.id && !u.is_banned
                        )
                    );
                    
                    updateUsersLists(onlineUsers, updatedAllUsers);
                } else {
                    // Получаем список онлайн пользователей (без забаненных)
                    const onlineUsers = allUsers.filter(user => !user.is_banned);
                    
                    // Обновляем списки
                    updateUsersLists(onlineUsers, allUsers);
                }
            } catch (fetchError) {
                console.error('Ошибка получения списка пользователей при разбане:', fetchError);
                // В крайнем случае используем предварительно загруженные данные
                // Обновляем статус бана для разбаненного пользователя
                const updatedAllUsers = allUsersBefore.map(user => {
                    if (user.id == userId) {
                        return {...user, is_banned: false, can_draw: true};
                    }
                    return user;
                });
                
                // Теперь определяем, кто онлайн без учета бана
                const onlineUsers = updatedAllUsers.filter(user => 
                    user.id == userId || !user.is_banned
                );
                
                updateUsersLists(onlineUsers, updatedAllUsers);
            }
        }
        
        // Показываем уведомление об успешном разбане
        const notification = document.createElement('div');
        notification.textContent = `Пользователь ${userName} разблокирован`;
        notification.className = 'notification-message unban';
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
        
    } catch (err) {
        console.error('Ошибка разбана пользователя:', err);
        alert(err.message || 'Не удалось разблокировать пользователя');
    }
}

// Функция для обновления названия доски
function updateBoardName(boardName) {
    console.log('updateBoardName вызвана с параметром:', boardName);
    const boardTitle = document.getElementById('boardTitle');
    const usersPanelTitle = document.getElementById('usersPanelTitle');
    
    if (boardName && boardName.trim() !== '') {
        boardTitle.textContent = `Доска "${boardName}"`;
        usersPanelTitle.textContent = `Пользователи доски "${boardName}"`;
        console.log('Название доски обновлено:', boardName);
    } else {
        boardTitle.textContent = 'Доска';
        usersPanelTitle.textContent = 'Пользователи';
        console.log('Название доски не задано, установлены значения по умолчанию');
    }
}

// Обработчик кнопки сворачивания панели пользователей
const togglePanelBtn = document.getElementById('togglePanelBtn');
const usersPanel = document.getElementById('usersPanel');

togglePanelBtn.addEventListener('click', () => {
    usersPanel.classList.toggle('collapsed');
});

// Инициализация инструментов после загрузки страницы
document.addEventListener('DOMContentLoaded', function() {
    // Получаем элементы новой панели инструментов
    const toolTabs = document.querySelectorAll('.tool-tab');
    const brushPanel = document.getElementById('brushPanel');
    const eraserPanel = document.getElementById('eraserPanel');
    const textPanel = document.getElementById('textPanel');
    const zoomPanel = document.getElementById('zoomPanel');
    
    // Получаем элементы управления из контекстных панелей
    const brushSizeSlider = document.getElementById('brushSizeSlider');
    const eraserSizeSlider = document.getElementById('eraserSizeSlider');
    const textSizeSlider = document.getElementById('textSizeSlider');
    const brushColorPicker = document.getElementById('brushColorPicker');
    const textColorPicker = document.getElementById('textColorPicker');
    const zoomLevelSlider = document.getElementById('zoomLevelSlider');
    const zoomLevelValue = document.getElementById('zoomLevelValue');
    const clearBoardBtn = document.getElementById('clearBoardBtn');
    
    // Инициализация кнопок сворачивания на панелях инструментов
    const toggleContextButtons = document.querySelectorAll('.toggle-context-btn');
    toggleContextButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const contextPanel = this.closest('.context-panel');
            contextPanel.classList.toggle('collapsed');
            
            // Сохраняем состояние свернутости в локальное хранилище
            const panelId = contextPanel.id;
            localStorage.setItem(`${panelId}_collapsed`, contextPanel.classList.contains('collapsed'));
        });
    });
    
    // Восстанавливаем состояние свернутости из локального хранилища
    document.querySelectorAll('.context-panel').forEach(panel => {
        const isCollapsed = localStorage.getItem(`${panel.id}_collapsed`) === 'true';
        if (isCollapsed) {
            panel.classList.add('collapsed');
        }
    });
    
    // Устанавливаем кисть как активный инструмент по умолчанию
    document.getElementById('brushTab').classList.add('active');
    brushPanel.classList.add('show');
    
    // Скрываем старую панель управления
    document.getElementById('controls').style.display = 'none';
    
    // Обработчик клика по вкладкам инструментов
    toolTabs.forEach(tab => {
        tab.addEventListener('click', function(e) {
            // Предотвращаем всплытие события и стандартное поведение
            e.stopPropagation();
            e.preventDefault();
            
            // Удаляем активный класс у всех вкладок
            toolTabs.forEach(t => t.classList.remove('active'));
            // Делаем текущую вкладку активной
            this.classList.add('active');
            
            // Скрываем все контекстные панели
            document.querySelectorAll('.context-panel').forEach(panel => {
                panel.classList.remove('show');
            });
            
            // Получаем выбранный инструмент и показываем соответствующую панель
            const tool = this.getAttribute('data-tool');
            currentTool = tool;
            
            // Сбрасываем режимы
            isEraser = false;
            isTextMode = false;
            isMoveMode = false;
            canvasWrapper.classList.remove('move-mode');
            
            switch(tool) {
                case 'brush':
                    brushPanel.classList.add('show');
                    toggleDrawingMode(true);
                    // Устанавливаем значения для рисования
                    if (textOverlay) textOverlay.style.display = 'none';
                    break;
                case 'eraser':
                    eraserPanel.classList.add('show');
                    isEraser = true;
                    toggleDrawingMode(true);
                    // Устанавливаем размер ластика
                    if (textOverlay) textOverlay.style.display = 'none';
                    break;
                case 'move':
                    isMoveMode = true;
                    canvasWrapper.classList.add('move-mode');
                    toggleDrawingMode(false);
                    // Сбрасываем другие режимы
                    if (textOverlay) textOverlay.style.display = 'none';
                    break;
                case 'text':
                    textPanel.classList.add('show');
                    isTextMode = true;
                    toggleDrawingMode(true);
                    break;
                case 'zoom':
                    zoomPanel.classList.add('show');
                    toggleDrawingMode(false);
                    // Сбрасываем другие режимы
                    if (textOverlay) textOverlay.style.display = 'none';
                    break;
            }
        }, { passive: false });
    });
    
    // Обработчики изменения параметров инструментов
    brushSizeSlider.addEventListener('input', function() {
        brushSize = this.value;
        sizeSlider.value = brushSize; // Обновляем значение старого слайдера для совместимости
    });
    
    eraserSizeSlider.addEventListener('input', function() {
        eraserSize = this.value;
        sizeSlider.value = eraserSize; // Обновляем значение старого слайдера для совместимости
    });
    
    textSizeSlider.addEventListener('input', function() {
        textSize = this.value;
        sizeSlider.value = textSize; // Обновляем значение старого слайдера для совместимости
        
        // Обновляем стиль для текстового поля ввода
        if (textOverlay) {
            textOverlay.style.font = `${textSize}px Montserrat`;
        }
    });
    
    brushColorPicker.addEventListener('input', function() {
        brushColor = this.value;
        colorPicker.value = brushColor; // Обновляем значение старого выбора цвета для совместимости
    });
    
    textColorPicker.addEventListener('input', function() {
        textColor = this.value;
        colorPicker.value = textColor; // Обновляем значение старого выбора цвета для совместимости
    });
    
    zoomLevelSlider.addEventListener('input', function() {
        currentScale = parseFloat(this.value);
        zoomLevelValue.textContent = `x${currentScale.toFixed(1)}`;
        zoomSlider.value = currentScale; // Обновляем значение старого слайдера масштаба
        updateCanvasTransform();
    });
    
    clearBoardBtn.addEventListener('click', function() {
        if (confirm('Вы уверены, что хотите очистить доску?')) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ws.send(JSON.stringify({
                type: 'clear',
                clearHistory: true
            }));
        }
    });
    
    // Синхронизируем начальные значения с существующими элементами управления
    brushSizeSlider.value = sizeSlider.value;
    brushSize = parseInt(brushSizeSlider.value);
    
    eraserSizeSlider.value = sizeSlider.value;
    eraserSize = parseInt(eraserSizeSlider.value);
    
    textSizeSlider.value = sizeSlider.value;
    textSize = parseInt(textSizeSlider.value);
    
    brushColorPicker.value = colorPicker.value;
    brushColor = brushColorPicker.value;
    
    textColorPicker.value = colorPicker.value;
    textColor = textColorPicker.value;
    
    zoomLevelSlider.value = zoomSlider.value;
    currentScale = parseFloat(zoomLevelSlider.value);
    zoomLevelValue.textContent = `x${currentScale.toFixed(1)}`;

    // Инициализация кнопок отмены и повтора
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);
    
    // Устанавливаем начальное состояние кнопок
    canUndo = false;
    canRedo = false;
    updateUndoRedoButtons();
    
    // Сохраняем начальное состояние холста в историю
    setTimeout(() => {
        saveToHistory();
    }, 500); // Задержка для загрузки истории рисования

    // Устанавливаем код доски в модальное окно приглашения
    const boardCodeDisplay = document.getElementById('boardCodeDisplay');
    if (boardCodeDisplay) {
        boardCodeDisplay.textContent = boardCode;
    }
});

// Добавляем обработчики горячих клавиш для отмены/повтора
document.addEventListener('keydown', function(e) {
    // Ctrl+Z для отмены
    if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        if (canUndo) {
            undo();
        }
    }
    
    // Ctrl+Y для повтора
    if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        if (canRedo) {
            redo();
        }
    }
});

// Функция сохранения текущего состояния холста в историю
function saveToHistory() {
    // Сохраняем состояние через WebSocket для синхронизации с сервером
    // Создаем контрольную точку для возможности отмены
    markUndoPoint();
}

// Функция для отмены действия (шаг назад)
function undo() {
    if (canUndo) {
        // Отправляем запрос на отмену серверу
        ws.send(JSON.stringify({
            type: 'undo',
            boardCode: boardCode,
            userId: userId
        }));
        
        // Временно блокируем кнопку до получения ответа от сервера
        canUndo = false;
        updateUndoRedoButtons();
    }
}

// Функция для повтора действия (шаг вперед)
function redo() {
    if (canRedo) {
        // Отправляем запрос на повтор серверу
        ws.send(JSON.stringify({
            type: 'redo',
            boardCode: boardCode,
            userId: userId
        }));
        
        // Временно блокируем кнопку до получения ответа от сервера
        canRedo = false;
        updateUndoRedoButtons();
    }
}

// Обновление состояния кнопок отмены/повтора
function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    if (undoBtn && redoBtn) {
        undoBtn.disabled = !canUndo;
        redoBtn.disabled = !canRedo;
        
        // Визуальное обновление состояния кнопок
        if (canUndo) {
            undoBtn.style.opacity = "1";
            undoBtn.style.cursor = "pointer";
        } else {
            undoBtn.style.opacity = "0.5";
            undoBtn.style.cursor = "not-allowed";
        }
        
        if (canRedo) {
            redoBtn.style.opacity = "1";
            redoBtn.style.cursor = "pointer";
        } else {
            redoBtn.style.opacity = "0.5";
            redoBtn.style.cursor = "not-allowed";
        }
    }
}

// Функция для сохранения текущего состояния перед действием
function markUndoPoint() {
    // Активируем возможность отмены после любого действия
    canUndo = true;
    canRedo = false; // Сбрасываем возможность повтора
    updateUndoRedoButtons();
}