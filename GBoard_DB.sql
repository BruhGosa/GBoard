-- Adminer 4.8.1 PostgreSQL 14.5 (Debian 14.5-1.pgdg100+1) dump

DROP TABLE IF EXISTS "board_access";
CREATE TABLE "public"."board_access" (
    "board_id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "can_draw" boolean DEFAULT false NOT NULL,
    "is_banned" boolean DEFAULT false NOT NULL,
    CONSTRAINT "board_access_pkey" PRIMARY KEY ("board_id", "user_id")
) WITH (oids = false);

CREATE INDEX "idx_board_access_user_board" ON "public"."board_access" USING btree ("user_id", "board_id");

INSERT INTO "board_access" ("board_id", "user_id", "can_draw", "is_banned") VALUES
(1,	1,	'f',	'f'),
(3,	3,	't',	'f'),
(2,	3,	't',	'f'),
(1,	3,	't',	'f'),
(10,	7,	't',	'f'),
(4,	3,	't',	'f'),
(5,	3,	't',	'f'),
(4,	1,	't',	'f'),
(3,	1,	't',	'f'),
(6,	1,	't',	'f'),
(6,	6,	't',	'f'),
(7,	4,	't',	'f'),
(7,	1,	't',	'f'),
(5,	4,	't',	'f'),
(5,	5,	't',	'f'),
(5,	1,	't',	'f'),
(8,	1,	't',	'f'),
(9,	9,	't',	'f'),
(8,	7,	't',	'f'),
(8,	10,	't',	'f'),
(8,	3,	't',	'f'),
(8,	9,	'f',	'f'),
(10,	1,	't',	'f'),
(9,	8,	't',	'f'),
(9,	1,	't',	'f');

DROP TABLE IF EXISTS "boards";
DROP SEQUENCE IF EXISTS boards_id_seq;
CREATE SEQUENCE boards_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 10 CACHE 1;

CREATE TABLE "public"."boards" (
    "id" integer DEFAULT nextval('boards_id_seq') NOT NULL,
    "code" character varying(10) NOT NULL,
    "name" character varying(100) NOT NULL,
    "owner_id" integer,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "boards_code_key" UNIQUE ("code"),
    CONSTRAINT "boards_pkey" PRIMARY KEY ("id")
) WITH (oids = false);

INSERT INTO "boards" ("id", "code", "name", "owner_id", "created_at") VALUES
(1,	'1AYG8C1Y',	'Тест_доска_01',	3,	'2025-02-02 11:56:19.475526'),
(2,	'5S9RBBHS',	'Тест_доска_02',	3,	'2025-02-03 07:08:07.946646'),
(3,	'2Z9NNUW2',	'Тест_доска_03',	3,	'2025-02-09 11:26:46.291762'),
(4,	'0TVZB4U2',	'Тест_доска_04',	3,	'2025-02-09 12:46:57.663684'),
(5,	'BNS52UYF',	'Не делай те больше плохих вещей плииииз',	3,	'2025-02-18 10:55:37.344385'),
(6,	'31WLJUG5',	'Тест_доска_05',	1,	'2025-02-19 07:20:42.048639'),
(7,	'ERXR3PIY',	'ABOBA',	4,	'2025-02-26 06:23:21.584213'),
(10,	'OOIDYXRS',	'ЕЩЁ ОДНА ТЕСТ ДОСКА',	7,	'2025-04-28 15:54:57.040092'),
(8,	'SYVP61CJ',	'ТЕСТ ТЕСТ ТЕСТ ТЕСТ ТЕСТ ТЕСТ ТЕСТ ДЛИНОГО НАЗВАНИЯ ДОСКИ',	1,	'2025-04-23 16:33:45.81626');

DROP TABLE IF EXISTS "connect_user";
CREATE TABLE "public"."connect_user" (
    "user_id" integer NOT NULL,
    "board_id" integer NOT NULL,
    "connected_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "connect_user_pkey" PRIMARY KEY ("user_id", "board_id")
) WITH (oids = false);

INSERT INTO "connect_user" ("user_id", "board_id", "connected_at") VALUES
(1,	8,	'2025-04-30 09:21:11.891664'),
(3,	8,	'2025-04-30 09:21:32.808488');

DROP TABLE IF EXISTS "session";
CREATE TABLE "public"."session" (
    "sid" character varying NOT NULL,
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
) WITH (oids = false);

CREATE INDEX "IDX_session_expire" ON "public"."session" USING btree ("expire");

INSERT INTO "session" ("sid", "sess", "expire") VALUES
('HHRE4Hi9H956iMMOOP8hs7Tu_NOapxW0',	'{"cookie":{"originalMaxAge":604800000,"expires":"2025-05-05T19:44:12.216Z","secure":false,"httpOnly":true,"path":"/"},"userId":9}',	'2025-05-05 19:44:22'),
('Wmz2jn3NI7VYHYiWw8dN375VXrudT1gZ',	'{"cookie":{"originalMaxAge":604800000,"expires":"2025-05-07T09:22:02.385Z","secure":false,"httpOnly":true,"path":"/"},"userId":7}',	'2025-05-07 09:22:11'),
('0TYbnhdVzL4VcNJ5uTJZGJvqyGCYEhZU',	'{"cookie":{"originalMaxAge":604800000,"expires":"2025-05-04T13:14:02.202Z","secure":false,"httpOnly":true,"path":"/"},"userId":7}',	'2025-05-06 15:54:59'),
('5kye5zDvvmfLs7yEnBdCBOCzwvEhqo8E',	'{"cookie":{"originalMaxAge":604800000,"expires":"2025-05-05T12:13:03.119Z","secure":false,"httpOnly":true,"path":"/"},"userId":8}',	'2025-05-05 12:13:13'),
('EF2nl9nSVT_d2Yn8ygDvMWiaztwQeByl',	'{"cookie":{"originalMaxAge":604800000,"expires":"2025-05-06T16:55:51.721Z","secure":false,"httpOnly":true,"path":"/"},"userId":11}',	'2025-05-06 16:55:52'),
('v9JZ0rzJ5oukCbP7fs9Ac-QyW3jxfo3G',	'{"cookie":{"originalMaxAge":604800000,"expires":"2025-05-06T12:12:24.149Z","secure":false,"httpOnly":true,"path":"/"},"userId":10}',	'2025-05-06 12:14:44'),
('gJj-kd1NZwCT1fqXIHiTCS8XTHnHBKnj',	'{"cookie":{"originalMaxAge":604800000,"expires":"2025-04-30T07:46:01.514Z","secure":false,"httpOnly":true,"path":"/"},"userId":1}',	'2025-05-06 19:51:32'),
('E6cjNh2nY4ae_6H9qYBNU4v6LGGsXOA8',	'{"cookie":{"originalMaxAge":604800000,"expires":"2025-04-30T08:40:12.163Z","secure":false,"httpOnly":true,"path":"/"},"userId":3}',	'2025-05-07 08:39:04'),
('BjVsBM1ZTAxOZId6uhjgBE77KguKRb4Y',	'{"cookie":{"originalMaxAge":604800000,"expires":"2025-05-07T08:05:46.042Z","secure":false,"httpOnly":true,"path":"/"},"userId":1}',	'2025-05-07 09:21:13'),
('Ni6upCELbO4mCzi5sMg_AO7fApwVSL8N',	'{"cookie":{"originalMaxAge":604800000,"expires":"2025-05-05T19:41:51.695Z","secure":false,"httpOnly":true,"path":"/"},"userId":9}',	'2025-05-06 19:06:20'),
('hEIJ3-SK7zA24w9Yg5RRhIM4i-_LpElZ',	'{"cookie":{"originalMaxAge":604800000,"expires":"2025-05-07T08:06:53.077Z","secure":false,"httpOnly":true,"path":"/"},"userId":3}',	'2025-05-07 09:21:33');

DROP TABLE IF EXISTS "user";
DROP SEQUENCE IF EXISTS user_id_seq;
CREATE SEQUENCE user_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 11 CACHE 1;

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

INSERT INTO "user" ("id", "full_name", "password", "link_avatar", "created_at") VALUES
(2,	'Тест_юзер_02',	'$2b$10$ELniDBihTVkeZikeJ1QWju4pzIWvwf4hXIraF6Ve0FEknahh0MfR6',	NULL,	'2025-01-26 11:58:45.176676+00'),
(4,	'Plombirka',	'$2b$10$4uqrEqNVH07AWCV8RJbOUeurf/ksExxHV6C/Y8db9cI469L2cf9l.',	NULL,	'2025-02-18 10:59:22.493771+00'),
(5,	'X-kleeps',	'$2b$10$gkmYXp.6pmKiBNih17Wg6OXY4h3ZYORzMR1e5dkgv1ugR/ZeOrLES',	NULL,	'2025-02-18 10:59:38.990169+00'),
(6,	'Ett1s',	'$2b$10$5JL2yIjO9uboByNA47hgQOY0Fb0YHdPrD4rIIIW59dHTqbNwANTpe',	NULL,	'2025-02-19 07:20:00.453212+00'),
(7,	'Тест_юзер_04',	'$2b$10$hQtoxCVupoN0psa9PVNqcOQW/S.l6rWjK.jymEip8Tyt0ZhEuIRV2',	'/photo/resized-avatar-1745775789834-12c368989a91.png',	'2025-04-27 13:14:02.19883+00'),
(8,	'qBaBaika_Xyesos',	'$2b$10$M6A/Mm/Q1WpIXxc3tfvuIuOlBB9pnadfFNOQ3RvD72N090SpHYJF.',	NULL,	'2025-04-28 12:13:03.116655+00'),
(9,	'АТВЬЧЬАЛВЬС',	'$2b$10$zqurnFh/3PXoLL8nOMjH2.YLWD4VmZxCeSQOJExhKNUXow7gM0gzS',	NULL,	'2025-04-28 19:41:51.692324+00'),
(1,	'Сокованов Игорь Николаевич',	'$2b$10$xvz8BxAkhLT.uE0W31zEz.7meKrgXhg4h1s9eN2nVeer1QH2Izjli',	'/photo/resized-avatar-1745775737743-a129edf19c3c.jpg',	'2025-01-26 11:30:37.172767+00'),
(10,	'Гоша Планшет',	'$2b$10$1Q6AZqsf.p.X53SKVcrpR.ai6dwe1V2/f3smmtL04FdCfPkj0a.lS',	'/photo/resized-avatar-1745928873033-8230c842141c.jpg',	'2025-04-29 12:12:24.146539+00'),
(11,	'Гоша Эдж',	'$2b$10$LSSBZ9M89Ckrm90FwEb/POZGJXyC36Om/kXQLKydRDDeSzDlwYKda',	NULL,	'2025-04-29 16:55:51.718015+00'),
(3,	'Тест_юзер_03',	'$2b$10$1UeenTuPHUo5z.DV3iEiK.TjeooIzsomJowNS0nDtIulMvjQIUSwu',	'/photo/resized-avatar-1745834943901-6a133af2ecdf.jpg',	'2025-01-31 12:37:50.213396+00');

ALTER TABLE ONLY "public"."board_access" ADD CONSTRAINT "board_access_board_id_fkey" FOREIGN KEY (board_id) REFERENCES boards(id) NOT DEFERRABLE;
ALTER TABLE ONLY "public"."board_access" ADD CONSTRAINT "board_access_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "user"(id) NOT DEFERRABLE;

ALTER TABLE ONLY "public"."boards" ADD CONSTRAINT "boards_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES "user"(id) NOT DEFERRABLE;

ALTER TABLE ONLY "public"."connect_user" ADD CONSTRAINT "connect_user_board_id_fkey" FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE NOT DEFERRABLE;
ALTER TABLE ONLY "public"."connect_user" ADD CONSTRAINT "connect_user_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE NOT DEFERRABLE;

-- 2025-04-30 09:36:33.553684+00
