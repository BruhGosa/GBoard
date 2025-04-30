const { Pool } = require('pg');
const logger = require('../utils/logger');

const { 
  DBUSER,
  DBPASS,
  DBHOST,
  DBNAME
} = process.env;

const pool = new Pool({
  user: DBUSER,
  password: DBPASS,
  host: DBHOST,
  database: DBNAME,
  ssl: false
});

// Инициализация базы данных
async function initDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS connect_user (
                user_id INTEGER NOT NULL,
                board_id INTEGER NOT NULL,
                connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, board_id),
                FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE,
                FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
            )
        `);
        logger.info('Database initialized successfully');
        
        // Очищаем таблицу соединений при запуске
        await pool.query('TRUNCATE connect_user');
        logger.info('Connection table cleared');
    } catch (err) {
        logger.error('Database initialization error:', err);
        process.exit(1);
    }
}

module.exports = {
    pool,
    initDatabase
}; 