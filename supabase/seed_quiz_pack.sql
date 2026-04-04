-- Seed one sample quiz pack: 8 rounds x 5 questions + picture round (5 questions).
-- Run after migration: psql $DATABASE_URL -f supabase/seed_quiz_pack.sql
-- Or via Supabase SQL Editor (paste this file).
-- Requires quiz_questions without `answer` column and table quiz_answers (see migrations).

-- Use fixed UUIDs so seed is idempotent (delete then insert).
DELETE FROM quiz_questions WHERE quiz_round_id IN (SELECT id FROM quiz_rounds WHERE quiz_pack_id = 'a0000000-0000-4000-8000-000000000001');
DELETE FROM quiz_rounds WHERE quiz_pack_id = 'a0000000-0000-4000-8000-000000000001';
DELETE FROM quiz_packs WHERE id = 'a0000000-0000-4000-8000-000000000001';

INSERT INTO quiz_packs (id, name) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Sample Quiz Pack');

INSERT INTO quiz_rounds (id, quiz_pack_id, round_number, title) VALUES
  ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 1, 'Round 1: General Knowledge'),
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 2, 'Round 2: Science'),
  ('a0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 3, 'Round 3: History'),
  ('a0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 4, 'Round 4: Geography'),
  ('a0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 5, 'Round 5: Sport'),
  ('a0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 6, 'Round 6: Music'),
  ('a0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001', 7, 'Round 7: Film & TV'),
  ('a0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001', 8, 'Round 8: Literature'),
  ('a0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000001', 9, 'Picture Round');

CREATE TEMP TABLE _seed_pack_q (
  round_id uuid,
  n int,
  q text,
  hn text,
  ans text
);

INSERT INTO _seed_pack_q VALUES
  ('a0000000-0000-4000-8000-000000000002', 1, 'What is the capital of France?', NULL, 'Paris'),
  ('a0000000-0000-4000-8000-000000000002', 2, 'How many continents are there?', 'Accept 7 or 5–7', 'Seven'),
  ('a0000000-0000-4000-8000-000000000002', 3, 'What year did the First World War begin?', NULL, '1914'),
  ('a0000000-0000-4000-8000-000000000002', 4, 'Which planet is known as the Red Planet?', NULL, 'Mars'),
  ('a0000000-0000-4000-8000-000000000002', 5, 'What is the largest ocean on Earth?', NULL, 'Pacific'),
  ('a0000000-0000-4000-8000-000000000003', 1, 'What is the chemical symbol for gold?', NULL, 'Au'),
  ('a0000000-0000-4000-8000-000000000003', 2, 'What is the hardest natural substance on Earth?', NULL, 'Diamond'),
  ('a0000000-0000-4000-8000-000000000003', 3, 'How many bones are in the adult human body?', 'Approx', '206'),
  ('a0000000-0000-4000-8000-000000000003', 4, 'What gas do plants absorb from the air?', NULL, 'Carbon dioxide'),
  ('a0000000-0000-4000-8000-000000000003', 5, 'What is the speed of light in km/s (approximately)?', 'Accept 300,000', '300,000'),
  ('a0000000-0000-4000-8000-000000000004', 1, 'Who was the first man on the Moon?', NULL, 'Neil Armstrong'),
  ('a0000000-0000-4000-8000-000000000004', 2, 'In which year did the Berlin Wall fall?', NULL, '1989'),
  ('a0000000-0000-4000-8000-000000000004', 3, 'Which ancient wonder was in Babylon?', NULL, 'Hanging Gardens'),
  ('a0000000-0000-4000-8000-000000000004', 4, 'Who wrote the Declaration of Independence?', NULL, 'Thomas Jefferson'),
  ('a0000000-0000-4000-8000-000000000004', 5, 'What was the name of the ship that sank in 1912?', NULL, 'Titanic'),
  ('a0000000-0000-4000-8000-000000000005', 1, 'What is the longest river in the world?', 'Nile or Amazon accepted', 'Nile'),
  ('a0000000-0000-4000-8000-000000000005', 2, 'Which country has the most islands?', NULL, 'Sweden'),
  ('a0000000-0000-4000-8000-000000000005', 3, 'What is the capital of Japan?', NULL, 'Tokyo'),
  ('a0000000-0000-4000-8000-000000000005', 4, 'Which desert is the largest in the world?', NULL, 'Antarctica'),
  ('a0000000-0000-4000-8000-000000000005', 5, 'What is the smallest country by area?', NULL, 'Vatican City'),
  ('a0000000-0000-4000-8000-000000000006', 1, 'How many players are in a football team on the pitch?', NULL, '11'),
  ('a0000000-0000-4000-8000-000000000006', 2, 'In which country did the Olympic Games originate?', NULL, 'Greece'),
  ('a0000000-0000-4000-8000-000000000006', 3, 'What colour is the centre of the Olympic flag?', NULL, 'None / White'),
  ('a0000000-0000-4000-8000-000000000006', 4, 'Which country has won the most FIFA World Cups?', NULL, 'Brazil'),
  ('a0000000-0000-4000-8000-000000000006', 5, 'What is the length of a marathon in miles (approx)?', NULL, '26.2'),
  ('a0000000-0000-4000-8000-000000000007', 1, 'Who sang "Bohemian Rhapsody"?', NULL, 'Queen'),
  ('a0000000-0000-4000-8000-000000000007', 2, 'How many strings does a standard guitar have?', NULL, 'Six'),
  ('a0000000-0000-4000-8000-000000000007', 3, 'Which band had a hit with "Yellow Submarine"?', NULL, 'The Beatles'),
  ('a0000000-0000-4000-8000-000000000007', 4, 'What is the name of the lead singer of U2?', NULL, 'Bono'),
  ('a0000000-0000-4000-8000-000000000007', 5, 'In which decade did disco become popular?', NULL, '1970s'),
  ('a0000000-0000-4000-8000-000000000008', 1, 'Who directed "Jurassic Park"?', NULL, 'Steven Spielberg'),
  ('a0000000-0000-4000-8000-000000000008', 2, 'Which actor played Jack in Titanic?', NULL, 'Leonardo DiCaprio'),
  ('a0000000-0000-4000-8000-000000000008', 3, 'What is the name of the wizard in The Lord of the Rings?', NULL, 'Gandalf'),
  ('a0000000-0000-4000-8000-000000000008', 4, 'Which TV series features the Red Keep?', NULL, 'Game of Thrones'),
  ('a0000000-0000-4000-8000-000000000008', 5, 'Who played the Joker in The Dark Knight?', NULL, 'Heath Ledger'),
  ('a0000000-0000-4000-8000-000000000009', 1, 'Who wrote "1984"?', NULL, 'George Orwell'),
  ('a0000000-0000-4000-8000-000000000009', 2, 'What is the first book in the Harry Potter series?', NULL, 'Harry Potter and the Philosopher''s Stone'),
  ('a0000000-0000-4000-8000-000000000009', 3, 'Who wrote "Pride and Prejudice"?', NULL, 'Jane Austen'),
  ('a0000000-0000-4000-8000-000000000009', 4, 'Which Shakespeare play has "To be or not to be"?', NULL, 'Hamlet'),
  ('a0000000-0000-4000-8000-000000000009', 5, 'Who wrote "The Great Gatsby"?', NULL, 'F. Scott Fitzgerald'),
  ('a0000000-0000-4000-8000-00000000000a', 1, 'Picture 1: Name this landmark.', 'Show image to teams', 'Eiffel Tower'),
  ('a0000000-0000-4000-8000-00000000000a', 2, 'Picture 2: Name this celebrity.', 'Show image', 'Answer P2'),
  ('a0000000-0000-4000-8000-00000000000a', 3, 'Picture 3: Which country is this flag from?', 'Show image', 'Answer P3'),
  ('a0000000-0000-4000-8000-00000000000a', 4, 'Picture 4: Name this film poster.', 'Show image', 'Answer P4'),
  ('a0000000-0000-4000-8000-00000000000a', 5, 'Picture 5: Name this logo.', 'Show image', 'Answer P5');

INSERT INTO quiz_questions (quiz_round_id, question_number, question_text, host_notes)
SELECT round_id, n, q, hn FROM _seed_pack_q;

INSERT INTO quiz_answers (question_id, answer)
SELECT qs.id, s.ans
FROM _seed_pack_q s
JOIN quiz_questions qs ON qs.quiz_round_id = s.round_id AND qs.question_number = s.n;
