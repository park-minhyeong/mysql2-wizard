import { ResultSetHeader } from "mysql2/promise";
import { handler } from "../handler";
import mysql2 from "mysql2/promise";
import { CompareQuery, QueryOption } from "../../interface/Query";
import { Connection } from "../../interface/Repository";
import where from "./condition/where";
import set from "./condition/set";

/** 단일 UPDATE 문과 바인딩 값 (SET 값 → WHERE 값 순). */
export const buildUpdateQuery = <T>(
	query: CompareQuery<T>,
	obj: Partial<T>,
	option: QueryOption<T>
): { sql: string; params: unknown[] } => {
	const { conditions, values } = where(query, option);
	const row = option.toRow(obj);
	const { setConditions, setValues } = set(row, option);
	const sql = mysql2.format("UPDATE ?? SET ", [option.table]) + setConditions + " WHERE " + conditions;
	return { sql, params: [...setValues, ...values] };
};

const update = async <T>(
  updates: Array<[CompareQuery<T>, Partial<T>]>,
  option: QueryOption<T>,
  connection?: Connection
): Promise<ResultSetHeader> => {
  const executeUpdate = async (conn: Connection): Promise<ResultSetHeader> => {
    let totalAffectedRows = 0;
    for (const [query, obj] of updates) {
      const { sql, params } = buildUpdateQuery(query, obj, option);
      option.printQueryIfNeeded?.(sql);
      const [result] = await conn.query<ResultSetHeader>(sql, params);
      totalAffectedRows += result.affectedRows;
    }
    return { affectedRows: totalAffectedRows } as ResultSetHeader; // 합산 결과만 의미 있음
  };

  // connection이 제공되면 트랜잭션 내에서 직접 실행, 없으면 handler 사용 (하위 호환성)
  return connection ? executeUpdate(connection) : handler(executeUpdate);
};

export { update };
