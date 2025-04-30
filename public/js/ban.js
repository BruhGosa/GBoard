// Проверяем авторизацию пользователя
async function checkAuth() {
    try {
        const response = await fetch('/check-auth');
        const data = await response.json();
        
        if (!data.authenticated) {
            // Если пользователь не авторизован, перенаправляем на главную
            window.location.href = '/';
            return false;
        }
        return true;
    } catch (err) {
        console.error('Ошибка при проверке авторизации:', err);
        return false;
    }
}

// Получаем информацию о доске
async function fetchBoardInfo(boardCode) {
    try {
        // Запрашиваем список досок пользователя
        const response = await fetch('/my-boards');
        const boards = await response.json();
        
        // Ищем доску по коду
        const board = boards.find(b => b.code === boardCode);
        
        if (board) {
            document.getElementById('boardDetails').innerHTML = `
                ${board.name} <br>
                <small>Код доски: ${boardCode}</small>
            `;
        } else {
            document.getElementById('boardDetails').textContent = `Доска с кодом ${boardCode}`;
        }
    } catch (err) {
        console.error('Ошибка при получении информации о доске:', err);
        document.getElementById('boardDetails').textContent = `Доска с кодом ${boardCode}`;
    }
}

// Инициализация страницы
async function init() {
    // Проверяем, есть ли код доски в URL
    const boardCodeMatch = window.location.search.match(/board=([^&]*)/);
    
    if (await checkAuth()) {
        if (boardCodeMatch && boardCodeMatch[1]) {
            const boardCode = boardCodeMatch[1];
            
            // Получаем информацию о доске
            await fetchBoardInfo(boardCode);
        } else {
            // Если код доски не найден, скрываем блок с информацией
            document.getElementById('boardInfo').style.display = 'none';
        }
    }
}

// Запускаем инициализацию
document.addEventListener('DOMContentLoaded', init); 