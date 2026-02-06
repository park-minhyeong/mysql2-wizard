import { ResultSetHeader } from "mysql2/promise";
import { handler } from "../handler";
import mysql2 from "mysql2/promise";
import { CompareQuery, QueryOption, CompareValue } from "../../interface/Query";
import { Connection } from "../../interface/Repository";
import where from "./condition/where";
import set from "./condition/set";

const queryString = <T>({ table }: QueryOption<T>) => ({
  update: mysql2.format("UPDATE ?? SET ", [table]),
});

const update = async <T>(
  updates: Array<[CompareQuery<T>, Partial<T>]>,
  option: QueryOption<T>,
  connection?: Connection
): Promise<ResultSetHeader> => {
  const executeUpdate = async (conn: Connection): Promise<ResultSetHeader> => {
    let totalAffectedRows = 0;
    for (const [query, obj] of updates) {
      const { conditions, values } = where(query, option);
      const row = option.toRow(obj as T) as Partial<T>;
      const { setConditions, setValues } = set(row, option);
      const query_ =
        queryString(option).update + setConditions + " WHERE " + conditions;
      option.printQueryIfNeeded?.(query_);
      const [result] = await conn.query<ResultSetHeader>(query_, [
        ...setValues,
        ...values,
      ]);
      totalAffectedRows += result.affectedRows;
    }
    return { affectedRows: totalAffectedRows } as ResultSetHeader;
  };

  if (connection) {
    // 트랜잭션 내에서 실행 (handler 없이 직접 connection 사용)
    return executeUpdate(connection);
  } else {
    // 기존 동작: handler 사용 (하위 호환성)
    return handler(async (connection) => {
      return executeUpdate(connection);
    });
  }
};

export { update };
