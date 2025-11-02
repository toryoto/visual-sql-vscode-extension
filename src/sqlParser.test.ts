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
    });

    test('カラムを指定したSELECT文をパースできる', () => {
      const sql = 'SELECT id, name, email FROM users';
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      expect(result.statements).toHaveLength(1);

      const statement = result.statements[0];
      expect(statement.type).toBe('select');
      expect(statement.tableName).toBe('users');
      expect(statement.columns).toBeDefined();
      expect(statement.columns?.length).toBeGreaterThan(0);
    });

    test('WHERE句を含むSELECT文をパースできる', () => {
      const sql = "SELECT * FROM users WHERE id = 1";
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      expect(result.statements).toHaveLength(1);
      expect(result.statements[0].type).toBe('select');
    });
  });

  describe('INSERT文のパース', () => {
    test('単純なINSERT文をパースできる', () => {
      const sql = "INSERT INTO users (name, email) VALUES ('John', 'john@example.com')";
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      expect(result.statements).toHaveLength(1);

      const statement = result.statements[0];
      expect(statement.type).toBe('insert');
      expect(statement.tableName).toBe('users');
      expect(statement.columns).toContain('name');
      expect(statement.columns).toContain('email');
      expect(statement.values).toBeDefined();
    });

    test('複数行のINSERT文をパースできる', () => {
      const sql = `INSERT INTO users (name, email) VALUES 
        ('John', 'john@example.com'),
        ('Jane', 'jane@example.com')`;
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      expect(result.statements).toHaveLength(1);
      expect(result.statements[0].values?.length).toBeGreaterThanOrEqual(1);
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
  });

  describe('複数のSQL文のパース', () => {
    test('セミコロンで区切られた複数のSQL文をパースできる', () => {
      const sql = `
        SELECT * FROM users;
        SELECT * FROM orders;
      `;
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
      expect(result.statements.length).toBeGreaterThanOrEqual(1);
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
    });

    test('ブロックコメント(/* */)を含むSQLをパースできる', () => {
      const sql = `
        /* これはブロックコメントです */
        SELECT * FROM users;
      `;
      const result = parser.parseSQL(sql);

      expect(result.success).toBe(true);
    });
  });

  describe('エラーハンドリング', () => {
    test('無効なSQL文でもエラーをthrowせずに処理する', () => {
      const sql = 'INVALID SQL STATEMENT';
      const result = parser.parseSQL(sql);

      // parseSQLはエラーをthrowしない
      // parseStatementが内部でtry-catchしているため、エラー時はnullを返す
      // そのため、無効なSQLでもsuccess: trueでstatements: []（空配列）が返される
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
    });

    test('空のWHERE句は有効とみなされる', () => {
      const result = parser.validateWhereClause('users', '');
      expect(result.valid).toBe(true);
    });
  });
});

