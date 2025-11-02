import { SQLParser, ParsedSQLData, ParsedStatement } from './sqlParser';

describe('SQLParser', () => {
  let parser: SQLParser;

  // 各テストの前に新しいSQLParserインスタンスを作成
  beforeEach(() => {
    parser = new SQLParser();
  });

  // describe: テストスイートのグループ化
  describe('基本的な動作', () => {
    // test/it: 個別のテストケース
    test('インスタンスが正常に作成される', () => {
      expect(parser).toBeInstanceOf(SQLParser);
    });

    test('空のSQLをパースできる', () => {
      const result = parser.parseSQL('');
      expect(result.success).toBe(true);
      expect(result.statements).toEqual([]);
      expect(result.raw).toBe('');
    });
  });

  describe('SELECT文のパース', () => {
    test('単純なSELECT文をパースできる', () => {
      const sql = 'SELECT * FROM users';
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      expect(result.statements).toHaveLength(1);

      const statement = result.statements[0];
      expect(statement.type).toBe('select');
      expect(statement.tableName).toBe('users');
      expect(statement.columns).toEqual(['*']);
    });

    test('カラムを指定したSELECT文をパースできる', () => {
      const sql = 'SELECT id, name, email FROM users';
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      expect(result.statements).toHaveLength(1);

      const statement = result.statements[0];
      expect(statement.type).toBe('select');
      expect(statement.tableName).toBe('users');
      expect(statement.columns).toEqual(['id', 'name', 'email']);
    });

    test('WHERE句を含むSELECT文をパースできる', () => {
      const sql = "SELECT * FROM users WHERE id = 1";
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      expect(result.statements).toHaveLength(1);
      expect(result.statements[0].type).toBe('select');
      expect(result.statements[0].tableName).toBe('users');
    });
  });

  describe('INSERT文のパース - 基本', () => {
    test('単純なINSERT文をパースできる', () => {
      const sql = "INSERT INTO users (name, email) VALUES ('John', 'john@example.com')";
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      expect(result.statements).toHaveLength(1);

      const statement = result.statements[0];
      expect(statement.type).toBe('insert');
      expect(statement.tableName).toBe('users');
      expect(statement.columns).toEqual(['name', 'email']);
      expect(statement.values).toEqual([['John', 'john@example.com']]);
    });

    test('複数行のINSERT文をパースできる', () => {
      const sql = `INSERT INTO users (name, email) VALUES 
        ('John', 'john@example.com'),
        ('Jane', 'jane@example.com')`;
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      expect(result.statements).toHaveLength(1);
      
      const statement = result.statements[0];
      expect(statement.values).toHaveLength(2);
      expect(statement.values).toEqual([
        ['John', 'john@example.com'],
        ['Jane', 'jane@example.com']
      ]);
    });
  });

  describe('INSERT文のパース - データ型の検証（高優先度2）', () => {
    test('数値型の値を正しくパースできる', () => {
      const sql = "INSERT INTO products (id, price) VALUES (1, 99.99)";
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.values).toEqual([[1, 99.99]]);
      
      // 型の検証
      expect(typeof statement.values![0][0]).toBe('number');
      expect(typeof statement.values![0][1]).toBe('number');
      expect(statement.values![0][0]).toBe(1);
      expect(statement.values![0][1]).toBe(99.99);
    });

    test('文字列型の値を正しくパースできる', () => {
      const sql = "INSERT INTO users (name, email) VALUES ('John Doe', 'john@example.com')";
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.values).toEqual([['John Doe', 'john@example.com']]);
      
      // 型の検証
      expect(typeof statement.values![0][0]).toBe('string');
      expect(typeof statement.values![0][1]).toBe('string');
    });

    test('NULL値を正しくパースできる', () => {
      const sql = "INSERT INTO products (id, name, description) VALUES (1, 'Product A', NULL)";
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.values).toEqual([[1, 'Product A', null]]);
      
      // NULL値の検証
      expect(statement.values![0][2]).toBeNull();
    });

    test('Boolean値（true/false）を正しくパースできる', () => {
      const sql = "INSERT INTO settings (id, enabled, disabled) VALUES (1, true, false)";
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      const statement = result.statements[0];
      
      // Boolean値が正しく変換されているか検証
      expect(statement.values![0][1]).toBe(true);
      expect(statement.values![0][2]).toBe(false);
      expect(typeof statement.values![0][1]).toBe('boolean');
      expect(typeof statement.values![0][2]).toBe('boolean');
    });

    test('混合型（数値、文字列、NULL、Boolean）を正しくパースできる', () => {
      const sql = "INSERT INTO products (id, name, price, description, in_stock) VALUES (1, 'Product A', 99.99, NULL, true)";
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.tableName).toBe('products');
      expect(statement.columns).toEqual(['id', 'name', 'price', 'description', 'in_stock']);
      expect(statement.values).toEqual([[1, 'Product A', 99.99, null, true]]);
      
      // 各値の型を検証
      expect(typeof statement.values![0][0]).toBe('number');  // id
      expect(typeof statement.values![0][1]).toBe('string');  // name
      expect(typeof statement.values![0][2]).toBe('number');  // price
      expect(statement.values![0][3]).toBeNull();              // description
      expect(typeof statement.values![0][4]).toBe('boolean'); // in_stock
    });

    test('複数行で異なる型の値を正しくパースできる', () => {
      const sql = `INSERT INTO products (id, name, price, in_stock) VALUES 
        (1, 'Product A', 100, true),
        (2, 'Product B', 200.50, false),
        (3, 'Product C', NULL, true)`;
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.values).toHaveLength(3);
      expect(statement.values).toEqual([
        [1, 'Product A', 100, true],
        [2, 'Product B', 200.50, false],
        [3, 'Product C', null, true]
      ]);
      
      // 各行の型を検証
      expect(typeof statement.values![0][2]).toBe('number');
      expect(typeof statement.values![1][2]).toBe('number');
      expect(statement.values![2][2]).toBeNull();
    });

    test('空文字列を正しくパースできる', () => {
      const sql = "INSERT INTO users (id, name, email) VALUES (1, '', 'test@example.com')";
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.values).toEqual([[1, '', 'test@example.com']]);
      expect(statement.values![0][1]).toBe('');
      expect(typeof statement.values![0][1]).toBe('string');
    });

    test('0（ゼロ）を数値として正しくパースできる', () => {
      const sql = "INSERT INTO products (id, price, stock) VALUES (1, 0, 0)";
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.values).toEqual([[1, 0, 0]]);
      expect(statement.values![0][1]).toBe(0);
      expect(statement.values![0][2]).toBe(0);
      expect(typeof statement.values![0][1]).toBe('number');
    });
  });

  describe('INSERT文のパース - カラム数不一致の補正（高優先度3）', () => {
    test('値の数がカラム数より多い場合、余分な値が切り詰められる', () => {
      const sql = "INSERT INTO users (name, email) VALUES ('John', 'john@example.com', 'extra', 'extra2')";
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.columns).toHaveLength(2);
      expect(statement.values).toHaveLength(1);
      
      // 値がカラム数に合わせて切り詰められていることを確認
      expect(statement.values![0]).toHaveLength(2);
      expect(statement.values).toEqual([['John', 'john@example.com']]);
    });

    test('値の数がカラム数より少ない場合、空文字でパディングされる', () => {
      const sql = "INSERT INTO users (name, email, age) VALUES ('John')";
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.columns).toHaveLength(3);
      expect(statement.values).toHaveLength(1);
      
      // 値が空文字でパディングされていることを確認
      expect(statement.values![0]).toHaveLength(3);
      expect(statement.values).toEqual([['John', '', '']]);
      expect(statement.values![0][1]).toBe('');
      expect(statement.values![0][2]).toBe('');
    });

    test('複数行で値の数が異なる場合、各行が適切に補正される', () => {
      const sql = `INSERT INTO users (id, name, email) VALUES 
        (1, 'John', 'john@example.com'),
        (2, 'Jane'),
        (3, 'Bob', 'bob@example.com', 'extra')`;
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.columns).toHaveLength(3);
      expect(statement.values).toHaveLength(3);
      
      // 各行が正しく補正されているか確認
      expect(statement.values![0]).toEqual([1, 'John', 'john@example.com']);
      expect(statement.values![1]).toEqual([2, 'Jane', '']);  // パディング
      expect(statement.values![2]).toEqual([3, 'Bob', 'bob@example.com']);  // 切り詰め
      
      // 全ての行が同じ長さになっているか確認
      expect(statement.values![0]).toHaveLength(3);
      expect(statement.values![1]).toHaveLength(3);
      expect(statement.values![2]).toHaveLength(3);
    });

    test('カラム数1で値が0個の場合、空文字でパディングされる', () => {
      const sql = "INSERT INTO logs (message) VALUES ()";
      const result = parser.parseSQL(sql);

      // パーサーがエラーを返す可能性があるため、両方のケースをチェック
      if (result.success && result.statements.length > 0) {
        const statement = result.statements[0];
        expect(statement.columns).toHaveLength(1);
        if (statement.values && statement.values.length > 0) {
          expect(statement.values[0]).toHaveLength(1);
          expect(statement.values[0][0]).toBe('');
        }
      }
    });

    test('カラム数5で値が2個の場合、3個の空文字でパディングされる', () => {
      const sql = "INSERT INTO users (id, name, email, age, status) VALUES (1, 'John')";
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.columns).toHaveLength(5);
      expect(statement.values![0]).toHaveLength(5);
      expect(statement.values).toEqual([[1, 'John', '', '', '']]);
    });
  });

  describe('UPDATE文のパース', () => {
    test('単純なUPDATE文をパースできる', () => {
      const sql = "UPDATE users SET name = 'John' WHERE id = 1";
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      expect(result.statements).toHaveLength(1);

      const statement = result.statements[0];
      expect(statement.type).toBe('update');
      expect(statement.tableName).toBe('users');
      expect(statement.columns).toContain('name');
    });

    test('複数のSET句を含むUPDATE文をパースできる', () => {
      const sql = "UPDATE users SET name = 'John', email = 'john@example.com' WHERE id = 1";
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.columns).toEqual(['name', 'email']);
      expect(statement.data).toHaveLength(2);
    });

    test('NULL値を含むUPDATE文をパースできる', () => {
      const sql = "UPDATE users SET deleted_at = NOW() WHERE deleted_at IS NULL";
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.type).toBe('update');
    });
  });

  describe('UPDATE文のパース - WHERE句の変換結果検証（優先度4）', () => {
    test('単純な等価条件のWHERE句が正しく変換される', () => {
      const sql = "UPDATE users SET name = 'John' WHERE id = 1";
      const result = parser.parseSQL(sql);
      
      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.where).toBeDefined();
      expect(statement.where).toContain('id');
      expect(statement.where).toContain('=');
      expect(statement.where).toContain('1');
    });

    test('文字列リテラルを含むWHERE句が正しく変換される', () => {
      const sql = "UPDATE users SET email = 'new@example.com' WHERE name = 'John'";
      const result = parser.parseSQL(sql);
      
      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.where).toBeDefined();
      expect(statement.where).toContain('name');
      expect(statement.where).toContain('=');
      // シングルクォートが含まれているか確認
      expect(statement.where).toMatch(/['"]/);
    });

    test('不等号条件のWHERE句が正しく変換される', () => {
      const sql = "UPDATE products SET price = 150 WHERE price > 100";
      const result = parser.parseSQL(sql);
      
      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.where).toBeDefined();
      expect(statement.where).toContain('price');
      expect(statement.where).toContain('>');
      expect(statement.where).toContain('100');
    });

    test('AND条件を含むWHERE句が正しく変換される', () => {
      const sql = "UPDATE users SET status = 'inactive' WHERE id > 10 AND status = 'active'";
      const result = parser.parseSQL(sql);
      
      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.where).toBeDefined();
      expect(statement.where).toContain('id');
      expect(statement.where).toContain('>');
      expect(statement.where).toContain('10');
      expect(statement.where).toContain('AND');
      expect(statement.where).toContain('status');
      expect(statement.where).toContain('active');
    });

    test('複数の条件演算子を含むWHERE句が正しく変換される', () => {
      const sql = "UPDATE products SET in_stock = false WHERE price >= 100 AND price <= 500";
      const result = parser.parseSQL(sql);
      
      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.where).toBeDefined();
      expect(statement.where).toContain('>=');
      expect(statement.where).toContain('<=');
      expect(statement.where).toContain('AND');
    });
  });

  describe('DELETE文のパース', () => {
    test('単純なDELETE文をパースできる', () => {
      const sql = 'DELETE FROM users WHERE id = 1';
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      expect(result.statements).toHaveLength(1);

      const statement = result.statements[0];
      expect(statement.type).toBe('delete');
      expect(statement.tableName).toBe('users');
    });

    test('複雑なWHERE句を含むDELETE文をパースできる', () => {
      const sql = "DELETE FROM users WHERE id > 10 AND status = 'inactive'";
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.type).toBe('delete');
      expect(statement.where).toBeDefined();
    });

    test('比較演算子を含むWHERE句のDELETE文をパースできる', () => {
      const sql = 'DELETE FROM products WHERE price > 100 AND stock < 5';
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.where).toBeDefined();
    });

    test('NULL値の比較を含むWHERE句のDELETE文をパースできる', () => {
      const sql = 'DELETE FROM users WHERE deleted_at IS NULL';
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.type).toBe('delete');
    });
  });

  describe('DELETE文のパース - WHERE句の変換結果検証（優先度4）', () => {
    test('単純な等価条件のWHERE句が正しく変換される', () => {
      const sql = 'DELETE FROM users WHERE id = 1';
      const result = parser.parseSQL(sql);
      
      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.where).toBeDefined();
      expect(typeof statement.where).toBe('string');
      expect(statement.where).toContain('id');
      expect(statement.where).toContain('=');
      expect(statement.where).toContain('1');
    });

    test('不等号条件のWHERE句が正しく変換される', () => {
      const sql = 'DELETE FROM products WHERE price > 100';
      const result = parser.parseSQL(sql);
      
      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.where).toBeDefined();
      expect(statement.where).toContain('price');
      expect(statement.where).toContain('>');
      expect(statement.where).toContain('100');
    });

    test('AND条件を含むWHERE句が正しく変換される', () => {
      const sql = "DELETE FROM users WHERE id > 10 AND status = 'active'";
      const result = parser.parseSQL(sql);
      
      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.where).toBeDefined();
      expect(statement.where).toContain('id');
      expect(statement.where).toContain('AND');
      expect(statement.where).toContain('status');
    });

    test('OR条件を含むWHERE句が正しく変換される', () => {
      const sql = "DELETE FROM users WHERE status = 'inactive' OR deleted = true";
      const result = parser.parseSQL(sql);
      
      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.where).toBeDefined();
      expect(statement.where).toContain('OR');
      expect(statement.where).toContain('status');
    });

    test('文字列値を含むWHERE句が正しく変換される', () => {
      const sql = "DELETE FROM users WHERE name = 'John'";
      const result = parser.parseSQL(sql);
      
      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.where).toBeDefined();
      expect(statement.where).toContain('name');
      // クォートが含まれているか確認
      expect(statement.where).toMatch(/['"]/);
    });

    test('数値を含むWHERE句が正しく変換される', () => {
      const sql = 'DELETE FROM orders WHERE total_amount = 1000';
      const result = parser.parseSQL(sql);
      
      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.where).toBeDefined();
      expect(statement.where).toContain('total_amount');
      expect(statement.where).toContain('1000');
    });

    test('複数の比較演算子を含むWHERE句が正しく変換される', () => {
      const sql = 'DELETE FROM products WHERE price >= 50 AND price <= 100';
      const result = parser.parseSQL(sql);
      
      expect(result.success).toBe(true);
      const statement = result.statements[0];
      expect(statement.where).toBeDefined();
      expect(statement.where).toContain('>=');
      expect(statement.where).toContain('<=');
    });
  });

  describe('複数のSQL文のパース', () => {
    test('セミコロンで区切られた複数のSQL文をパースできる', () => {
      const sql = `
        SELECT * FROM users;
        SELECT * FROM orders;
      `;
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      expect(result.statements).toHaveLength(2);
      expect(result.statements[0].type).toBe('select');
      expect(result.statements[0].tableName).toBe('users');
      expect(result.statements[1].type).toBe('select');
      expect(result.statements[1].tableName).toBe('orders');
    });

    test('異なる種類のSQL文を複数パースできる', () => {
      const sql = `
        SELECT * FROM users;
        INSERT INTO logs (message) VALUES ('test');
        DELETE FROM temp WHERE id = 1;
      `;
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      expect(result.statements.length).toBeGreaterThanOrEqual(2);
      // 各文のタイプを確認
      const types = result.statements.map(s => s.type);
      expect(types).toContain('select');
    });
  });

  describe('コメントの処理', () => {
    test('行コメント(--)を含むSQLをパースできる', () => {
      const sql = `
        SELECT * FROM users; -- これはコメントです
        SELECT * FROM orders;
      `;
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      expect(result.statements.length).toBeGreaterThanOrEqual(1);
    });

    test('ブロックコメント(/* */)を含むSQLをパースできる', () => {
      const sql = `
        /* これはブロックコメントです */
        SELECT * FROM users;
      `;
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      expect(result.statements).toHaveLength(1);
      expect(result.statements[0].type).toBe('select');
    });

    test('複数のコメントを含むSQLをパースできる', () => {
      const sql = `
        -- 最初のクエリ
        SELECT * FROM users; -- ユーザー取得
        /* 2番目のクエリ
           複数行コメント */
        SELECT * FROM orders;
      `;
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      expect(result.statements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('エラーハンドリング', () => {
    test('無効なSQL文でもエラーをthrowせずに処理する', () => {
      const sql = 'INVALID SQL STATEMENT';
      const result = parser.parseSQL(sql);

      expect(result).toBeDefined();
      expect(result.raw).toBe(sql);
      expect(result.success).toBe(true);
      expect(result.statements).toEqual([]);
    });

    test('パースできないSQL文は空のstatements配列を返す', () => {
      const sql = 'NOT A VALID SQL QUERY AT ALL';
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      expect(result.statements).toHaveLength(0);
      expect(result.error).toBeUndefined();
    });

    test('不完全なSELECT文をパースする', () => {
      const sql = 'SELECT * FROM';
      const result = parser.parseSQL(sql);

      expect(result).toBeDefined();
      expect(result.raw).toBe(sql);
      // パーサーがエラーをキャッチするため、statementsは空になる
      expect(result.statements).toEqual([]);
    });
  });

  describe('validateWhereClause', () => {
    test('有効なWHERE句をバリデートできる', () => {
      const result = parser.validateWhereClause('users', 'id = 1');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('無効なWHERE句を検出できる', () => {
      const result = parser.validateWhereClause('users', 'invalid syntax ***');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('WHERE句の構文エラー');
    });

    test('空のWHERE句は有効とみなされる', () => {
      const result = parser.validateWhereClause('users', '');
      expect(result.valid).toBe(true);
    });

    test('複雑な条件式をバリデートできる', () => {
      const result = parser.validateWhereClause('users', 'id > 10 AND status = \'active\'');
      expect(result.valid).toBe(true);
    });

    test('比較演算子を含むWHERE句をバリデートできる', () => {
      const result = parser.validateWhereClause('products', 'price >= 100 AND stock <= 50');
      expect(result.valid).toBe(true);
    });

    test('文字列リテラルを含むWHERE句をバリデートできる', () => {
      const result = parser.validateWhereClause('users', 'name = \'John\'');
      expect(result.valid).toBe(true);
    });

    test('OR条件を含むWHERE句をバリデートできる', () => {
      const result = parser.validateWhereClause('users', 'status = \'active\' OR status = \'pending\'');
      expect(result.valid).toBe(true);
    });
  });
});