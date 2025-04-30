// Проверка авторизации при загрузке страницы
async function checkAuth() {
    try {
        const response = await fetch('/check-auth');
        const data = await response.json();
        
        const welcomeContainer = document.getElementById('welcomeContainer');
        const userProfile = document.getElementById('userProfile');
        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName');
        
        if (data.authenticated) {
            // Отображаем профиль пользователя
            userName.textContent = data.userName;
            
            // Устанавливаем аватарку пользователя
            if (data.avatarUrl) {
                userAvatar.style.backgroundImage = `url(${data.avatarUrl})`;
                userAvatar.classList.remove('default-avatar');
                userAvatar.textContent = '';
            } else {
                // Создаем аватарку из первой буквы имени
                userAvatar.textContent = data.userName.charAt(0).toUpperCase();
                userAvatar.classList.add('default-avatar');
            }
            
            // Добавляем обработчик клика для открытия модального окна профиля
            userProfile.onclick = function() {
                // Загружаем данные пользователя в форму профиля
                document.getElementById('profileUsername').value = data.userName;
                
                const profileAvatar = document.getElementById('profileAvatarPreview');
                if (data.avatarUrl) {
                    profileAvatar.style.backgroundImage = `url(${data.avatarUrl})`;
                    profileAvatar.classList.remove('default-avatar');
                    profileAvatar.textContent = '';
                } else {
                    profileAvatar.textContent = data.userName.charAt(0).toUpperCase();
                    profileAvatar.classList.add('default-avatar');
                }
                
                openModal('profileModal');
            };
            
            welcomeContainer.innerHTML = `
                <h1>Добро пожаловать, ${data.userName}!</h1>
                <div class="buttons-container">
                    <button class="btn btn-primary" onclick="createBoard()">Создать новую доску</button>
                    <button class="btn btn-secondary" onclick="joinBoard()">Присоединиться к доске</button>
                </div>
                <div id="myBoards" class="boards-container">
                    <h2>Мои доски</h2>
                    <div id="boardsList"></div>
                </div>
            `;
            return true;
        } else {
            // Если пользователь не авторизован
            userName.textContent = 'Вход/Регистрация';
            userAvatar.textContent = '?';
            userAvatar.classList.add('default-avatar');
            userAvatar.style.backgroundImage = '';
            
            // Добавляем обработчик для открытия модального окна входа
            userProfile.onclick = function() {
                openModal('authModal');
            };
            
            welcomeContainer.innerHTML = `
                <h1>Добро пожаловать в GBoard!</h1>
                <p>Пожалуйста, войдите или зарегистрируйтесь для доступа к доскам</p>
                <div class="buttons-container">
                    <button class="btn btn-primary" onclick="openModal('authModal'); switchAuthTab('login')">Войти</button>
                    <button class="btn btn-secondary" onclick="openModal('authModal'); switchAuthTab('register')">Регистрация</button>
                </div>
            `;
            return false;
        }
    } catch (err) {
        console.error('Ошибка при проверке авторизации:', err);
        const userName = document.getElementById('userName');
        const userAvatar = document.getElementById('userAvatar');
        
        userName.textContent = 'Вход/Регистрация';
        userAvatar.textContent = '?';
        userAvatar.classList.add('default-avatar');
        userAvatar.style.backgroundImage = '';
        
        document.getElementById('userProfile').onclick = function() {
            openModal('authModal');
        };
        
        return false;
    }
}

// Функция для переключения между вкладками авторизации
function switchAuthTab(tab) {
    // Скрываем все вкладки и убираем активный класс у всех кнопок
    document.querySelectorAll('.auth-tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    document.querySelectorAll('.auth-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Показываем выбранную вкладку и активируем соответствующую кнопку
    document.getElementById(tab + 'Tab').style.display = 'block';
    document.getElementById(tab + 'TabBtn').classList.add('active');
}

// Функции для работы с модальными окнами
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Закрытие модального окна при клике вне его
window.onclick = function(event) {
    if (event.target.className === 'modal') {
        event.target.style.display = 'none';
    }
}

// Обработка форм
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                full_name: formData.get('full_name'),
                password: formData.get('password')
            })
        });
        const data = await response.json();
        if (data.success) {
            closeModal('authModal');
            checkAuth();
        } else {
            document.getElementById('loginError').textContent = data.error;
        }
    } catch (err) {
        document.getElementById('loginError').textContent = 'Ошибка при входе';
    }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                full_name: formData.get('full_name'),
                password: formData.get('password')
            })
        });
        const data = await response.json();
        if (data.success) {
            closeModal('authModal');
            checkAuth();
        } else {
            document.getElementById('registerError').textContent = data.error;
        }
    } catch (err) {
        document.getElementById('registerError').textContent = 'Ошибка при регистрации';
    }
});

async function logout() {
    try {
        await fetch('/logout');
        checkAuth();
    } catch (err) {
        console.error('Ошибка при выходе:', err);
    }
}

async function createBoard() {
    openModal('createBoardModal');
}

async function joinBoard() {
    openModal('joinBoardModal');
}

document.getElementById('createBoardForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
        const response = await fetch('/create-board', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: formData.get('boardName')
            })
        });
        const data = await response.json();
        if (data.success) {
            closeModal('createBoardModal');
            loadMyBoards();
            // Перенаправляем на новую доску
            window.location.href = `/board/${data.code}`;
        }
    } catch (err) {
        console.error('Ошибка при создании доски:', err);
    }
});

document.getElementById('joinBoardForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const boardCode = formData.get('boardCode');
    const errorContainer = document.getElementById('joinBoardError');
    
    // Сбрасываем предыдущие ошибки
    errorContainer.textContent = '';
    
    try {
        const response = await fetch('/join-board', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                code: boardCode
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeModal('joinBoardModal');
            window.location.href = `/board/${boardCode}`;
        } else if (data.isBanned && data.redirectUrl) {
            // Если пользователь забанен, перенаправляем на страницу бана
            closeModal('joinBoardModal');
            window.location.href = data.redirectUrl;
        } else if (response.status === 403 && data.isBanned) {
            // Если получен статус 403 и флаг бана
            closeModal('joinBoardModal');
            window.location.href = `/ban.html?board=${boardCode}`;
        } else {
            // Показываем ошибку пользователю
            errorContainer.textContent = data.error || 'Ошибка при присоединении к доске';
        }
    } catch (err) {
        console.error('Ошибка при присоединении к доске:', err);
        errorContainer.textContent = 'Произошла ошибка при попытке присоединиться к доске';
    }
});

async function loadMyBoards() {
    try {
        const response = await fetch('/my-boards');
        const boards = await response.json();
        
        const boardsList = document.getElementById('boardsList');
        boardsList.innerHTML = boards.map(board => `
            <div class="board-item" onclick="openBoard('${board.code}')">
                <h3>${board.name}</h3>
                <p><span class="code-label">Код доски:</span> ${board.code}</p>
                <button class="board-open-btn" onclick="event.stopPropagation(); openBoard('${board.code}')">
                    Открыть доску
                </button>
            </div>
        `).join('');
    } catch (err) {
        console.error('Ошибка при загрузке досок:', err);
    }
}

// Функция для открытия доски
function openBoard(code) {
    window.location.href = `/board/${code}`;
}

// Загружаем доски при авторизации
checkAuth().then(() => {
    if (document.getElementById('boardsList')) {
        loadMyBoards();
    }
});

// Проверяем авторизацию при загрузке страницы
checkAuth();

// Добавляем обработчик события для загрузки аватарки
document.getElementById('avatarInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const profileAvatar = document.getElementById('profileAvatarPreview');
            profileAvatar.style.backgroundImage = `url(${event.target.result})`;
            profileAvatar.classList.remove('default-avatar');
            profileAvatar.textContent = '';
        };
        reader.readAsDataURL(file);
    }
});

// Обработчик отправки формы профиля
document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const avatarInput = document.getElementById('avatarInput');
    const usernameInput = document.getElementById('profileUsername');
    const errorContainer = document.getElementById('profileError');
    
    // Очищаем предыдущие ошибки
    errorContainer.textContent = '';
    
    try {
        // Если выбрана новая аватарка, загружаем её
        if (avatarInput.files.length > 0) {
            const formData = new FormData();
            formData.append('avatar', avatarInput.files[0]);
            
            const avatarResponse = await fetch('/upload-avatar', {
                method: 'POST',
                body: formData
            });
            
            const avatarData = await avatarResponse.json();
            if (!avatarData.success) {
                errorContainer.textContent = avatarData.error;
                return;
            }
        }
        
        // Обновляем имя пользователя
        const usernameResponse = await fetch('/update-profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: usernameInput.value
            })
        });
        
        const profileData = await usernameResponse.json();
        if (!profileData.success) {
            errorContainer.textContent = profileData.error;
            return;
        }
        
        // Обновляем профиль пользователя
        closeModal('profileModal');
        checkAuth();
        
    } catch (err) {
        console.error('Ошибка при обновлении профиля:', err);
        errorContainer.textContent = 'Произошла ошибка при обновлении профиля';
    }
});