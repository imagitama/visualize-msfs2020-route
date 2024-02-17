import { Database } from "sql.js";

let db: Database;

const init = async (data: ArrayLike<number> | Buffer | null | undefined) => {
  console.debug(`initializing db...`);

  // assumes loaded from CDN
  const SQL = await window.initSqlJs({
    // @ts-ignore
    locateFile: () => window.WASM_URL,
  });

  const db = new SQL.Database(data);

  console.debug(`done!`, db);

  return db;
};

export const killDb = () => {
  if (!db) {
    return;
  }
  console.debug(`closing db...`);
  db.close();
  console.debug("closed!");
};

export const readSqliteFile = async (file: File) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async function (event) {
      try {
        if (
          !event.target ||
          !event.target.result ||
          typeof event.target.result === "string"
        ) {
          throw new Error("Invalid load");
        }

        console.debug(`loaded file`, event.target.result);

        const data = new Uint8Array(event.target.result);

        db = await init(data);

        console.debug("db", db);

        const tableInfo = await query(
          `SELECT * FROM sqlite_schema WHERE type='table'`
        );

        console.debug("tables", tableInfo);

        resolve(db);
      } catch (err) {
        reject(err);
      }
    };

    reader.readAsArrayBuffer(file);
  });
};

type Row = { [columnName: string]: any };

export const query = async <TSingleRow = void>(
  queryStr: string
): Promise<TSingleRow[]> => {
  if (!db) {
    throw new Error("No db");
  }

  // NOTE: returns { columns: string[], values: any[] } not an array of objects
  const execResults = db.exec(queryStr);

  if (!Array.isArray(execResults) || execResults.length !== 1) {
    throw new Error(`Query ${queryStr} did not return single result`);
  }

  const columnNames = execResults[0].columns;
  const rows = execResults[0].values;

  const results = rows.map((rowColValues) =>
    rowColValues.reduce<Row>(
      (row, columnValue, i) => ({
        ...row,
        [columnNames[i]]: columnValue,
      }),
      {}
    )
  );

  return results as TSingleRow[];
};
