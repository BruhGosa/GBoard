-- Adminer 4.8.1 PostgreSQL 14.5 (Debian 14.5-1.pgdg100+1) dump

\connect "c100994_gosoboard_na4u_ru";

DROP TABLE IF EXISTS "board_access";
CREATE TABLE "public"."board_access" (
    "board_id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "can_draw" boolean DEFAULT false NOT NULL,
    "is_banned" boolean DEFAULT false NOT NULL,
    CONSTRAINT "board_access_pkey" PRIMARY KEY ("board_id", "user_id")
) WITH (oids = false);

CREATE INDEX "idx_board_access_user_board" ON "public"."board_access" USING btree ("user_id", "board_id");


DROP TABLE IF EXISTS "boards";
DROP SEQUENCE IF EXISTS boards_id_seq;
CREATE SEQUENCE boards_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 12 CACHE 1;

CREATE TABLE "public"."boards" (
    "id" integer DEFAULT nextval('boards_id_seq') NOT NULL,
    "code" character varying(10) NOT NULL,
    "name" character varying(100) NOT NULL,
    "owner_id" integer,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "boards_code_key" UNIQUE ("code"),
    CONSTRAINT "boards_pkey" PRIMARY KEY ("id")
) WITH (oids = false);


DROP TABLE IF EXISTS "connect_user";
CREATE TABLE "public"."connect_user" (
    "user_id" integer NOT NULL,
    "board_id" integer NOT NULL,
    "connected_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "connect_user_pkey" PRIMARY KEY ("user_id", "board_id")
) WITH (oids = false);


DROP TABLE IF EXISTS "session";
CREATE TABLE "public"."session" (
    "sid" character varying NOT NULL,
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
) WITH (oids = false);

CREATE INDEX "IDX_session_expire" ON "public"."session" USING btree ("expire");


DROP TABLE IF EXISTS "user";
DROP SEQUENCE IF EXISTS user_id_seq;
CREATE SEQUENCE user_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 12 CACHE 1;

CREATE TABLE "public"."user" (
    "id" integer DEFAULT nextval('user_id_seq') NOT NULL,
    "full_name" character varying(256) NOT NULL,
    "password" character varying(256) NOT NULL,
    "link_avatar" character varying(256),
    "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "unique_full_name" UNIQUE ("full_name"),
    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
) WITH (oids = false);

CREATE INDEX "idx_user_full_name" ON "public"."user" USING btree ("full_name");

COMMENT ON COLUMN "public"."user"."id" IS 'Уникальный идентификатор пользователя';

COMMENT ON COLUMN "public"."user"."full_name" IS 'Полное имя пользователя (используется для входа)';

COMMENT ON COLUMN "public"."user"."password" IS 'Хешированный пароль пользователя';

COMMENT ON COLUMN "public"."user"."link_avatar" IS 'Ссылка на аватар пользователя';

COMMENT ON COLUMN "public"."user"."created_at" IS 'Дата и время создания аккаунта';


ALTER TABLE ONLY "public"."board_access" ADD CONSTRAINT "board_access_board_id_fkey" FOREIGN KEY (board_id) REFERENCES boards(id) NOT DEFERRABLE;
ALTER TABLE ONLY "public"."board_access" ADD CONSTRAINT "board_access_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "user"(id) NOT DEFERRABLE;

ALTER TABLE ONLY "public"."boards" ADD CONSTRAINT "boards_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES "user"(id) NOT DEFERRABLE;

ALTER TABLE ONLY "public"."connect_user" ADD CONSTRAINT "connect_user_board_id_fkey" FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE NOT DEFERRABLE;
ALTER TABLE ONLY "public"."connect_user" ADD CONSTRAINT "connect_user_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE NOT DEFERRABLE;

-- 2025-05-22 16:52:12.481668+00
