type Row = Record<string, unknown>;

export class MockD1Database {
  private tables: Map<string, Row[]> = new Map();

  prepare(sql: string): MockPreparedStatement {
    return new MockPreparedStatement(this, sql);
  }

  private getTable(name: string): Row[] {
    if (!this.tables.has(name)) {
      this.tables.set(name, []);
    }
    return this.tables.get(name)!;
  }

  private setTable(name: string, rows: Row[]): void {
    this.tables.set(name, rows);
  }

  private parseTable(sql: string): string | null {
    const into = sql.match(/INSERT\s+INTO\s+(\w+)/i)?.[1];
    if (into) return into;
    const from = sql.match(/FROM\s+(\w+)/i)?.[1];
    if (from) return from;
    const update = sql.match(/UPDATE\s+(\w+)/i)?.[1];
    if (update) return update;
    return null;
  }

  private parseInsertColumns(sql: string): string[] | null {
    const match = sql.match(/INSERT\s+INTO\s+\w+\s*\(([^)]+)\)/i);
    if (!match) return null;
    const columns = match[1];
    if (!columns) return null;
    return columns.split(",").map((c) => c.trim());
  }

  private parseWhereColumn(sql: string): string | null {
    const match = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i);
    return match?.[1] ?? null;
  }

  insert(sql: string, bindings: unknown[]): void {
    const table = this.parseTable(sql);
    const columns = this.parseInsertColumns(sql);
    if (!table || !columns) return;

    const row: Row = {};
    columns.forEach((col, idx) => {
      row[col] = bindings[idx];
    });
    this.getTable(table).push(row);
  }

  select(sql: string, bindings: unknown[]): Row[] {
    const table = this.parseTable(sql);
    if (!table) return [];
    const rows = this.getTable(table);
    const whereCol = this.parseWhereColumn(sql);
    if (!whereCol) return rows;
    return rows.filter((r) => r[whereCol] === bindings[0]);
  }

  update(sql: string, bindings: unknown[]): void {
    const table = this.parseTable(sql);
    if (!table) return;
    const rows = this.getTable(table);
    const whereCol = this.parseWhereColumn(sql);
    if (!whereCol) return;

    const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i)?.[1];
    if (!setMatch) return;
    const columns = setMatch.split(",").map((part) => {
      const m = part.match(/(\w+)\s*=\s*\?/);
      return m?.[1] ?? null;
    }).filter(Boolean) as string[];

    const target = rows.find((r) => r[whereCol] === bindings[bindings.length - 1]);
    if (!target) return;

    columns.forEach((col, idx) => {
      target[col] = bindings[idx];
    });
  }

  delete(sql: string, bindings: unknown[]): void {
    const table = this.parseTable(sql);
    if (!table) return;

    if (/WHERE\s+claim_id\s+IN\s*\(/i.test(sql)) {
      const claimIds = this.claimIdsForSession(bindings[0]);
      this.setTable(
        table,
        this.getTable(table).filter((row) => !claimIds.has(String(row.claim_id))),
      );
      return;
    }

    if (/DELETE\s+FROM\s+answer\s+WHERE\s+research_job_id\s+IN/i.test(sql)) {
      const jobIds = this.researchJobIdsForSession(bindings[0]);
      this.setTable(
        table,
        this.getTable(table).filter((row) => !jobIds.has(String(row.research_job_id))),
      );
      return;
    }

    const whereCol = this.parseWhereColumn(sql);
    if (!whereCol) return;
    this.setTable(
      table,
      this.getTable(table).filter((row) => row[whereCol] !== bindings[0]),
    );
  }

  private researchJobIdsForSession(sessionId: unknown): Set<string> {
    return new Set(
      this.getTable("research_job")
        .filter((row) => row.session_id === sessionId)
        .map((row) => String(row.research_job_id)),
    );
  }

  private claimIdsForSession(sessionId: unknown): Set<string> {
    const jobIds = this.researchJobIdsForSession(sessionId);
    const claimIds = new Set<string>();

    for (const answer of this.getTable("answer")) {
      if (!jobIds.has(String(answer.research_job_id))) continue;
      const answerJson = typeof answer.answer_json === "string" ? answer.answer_json : "{}";
      const parsed = JSON.parse(answerJson) as { results?: { claim_id?: unknown }[] };
      for (const result of parsed.results ?? []) {
        if (typeof result.claim_id === "string") {
          claimIds.add(result.claim_id);
        }
      }
    }

    return claimIds;
  }
}

class MockPreparedStatement {
  private db: MockD1Database;
  private sql: string;
  private bindings: unknown[] = [];

  constructor(db: MockD1Database, sql: string) {
    this.db = db;
    this.sql = sql;
  }

  bind(...values: unknown[]): MockPreparedStatement {
    this.bindings = values;
    return this;
  }

  async first<T = Row>(): Promise<T | null> {
    const rows = this.db.select(this.sql, this.bindings);
    return (rows[0] as T) ?? null;
  }

  async run(): Promise<{ success: true }> {
    const sql = this.sql.trim().toUpperCase();
    if (sql.startsWith("INSERT")) {
      this.db.insert(this.sql, this.bindings);
    } else if (sql.startsWith("UPDATE")) {
      this.db.update(this.sql, this.bindings);
    } else if (sql.startsWith("DELETE")) {
      this.db.delete(this.sql, this.bindings);
    }
    return { success: true };
  }

  async all<T = Row>(): Promise<{ results: T[] }> {
    const rows = this.db.select(this.sql, this.bindings);
    return { results: rows as T[] };
  }
}
