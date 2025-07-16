import { ResultSetHeader } from "mysql2/promise";
import { handler } from "../handler";
import mysql2 from "mysql2/promise";
import { CompareQuery, QueryOption, CompareValue } from "../../interface/Query";
import where from "./condition/where";
import set from "./condition/set";

const queryString = <T>({ table }: QueryOption<T>) => ({
  update: mysql2.format("UPDATE ?? SET ", [table]),
});

const update = async <T>(
  updates: Array<[CompareQuery<T>, Partial<T>]>,
  option: QueryOption<T>
): Promise<ResultSetHeader> =>
  handler(async (connection) => {
    let totalAffectedRows = 0;
    for (const [query, obj] of updates) {
      const { conditions, values } = where(query, option);
      const row = option.toRow(obj as T) as Partial<T>;
      const { setConditions, setValues } = set(row, option);
      const query_ =
        queryString(option).update + setConditions + " WHERE " + conditions;
      option.printQueryIfNeeded?.(query_);
      const [result] = await connection.query<ResultSetHeader>(query_, [
        ...setValues,
        ...values,
      ]);
      totalAffectedRows += result.affectedRows;
    }
    return { affectedRows: totalAffectedRows } as ResultSetHeader;
  });

export { update };
