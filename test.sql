-- テスト用SQLファイル
-- INSERT文の例
INSERT INTO users (name, email, age) VALUES 
('田中太郎', 'tanaka@example.com', 30),
('佐藤花子', 'sato@example.com', 25),
('鈴木一郎', 'suzuki@example.com', 35);

-- UPDATE文の例
UPDATE users 
SET age = 31, email = 'tanaka_new@example.com' 
WHERE name = '田中太郎';

-- SELECT文の例
SELECT name, email, age 
FROM users 
WHERE age > 25;
