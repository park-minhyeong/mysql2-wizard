import { ResultSetHeader } from "mysql2";
import { repository } from "../../repository";
import { Test, testKeys } from "../interface/Test";


const repo = repository<Test, never>({
  table: "test.test",
  keys: testKeys,
  printQuery: true,
});

async function read(): Promise<Test[]> {
  return await repo.select().or({
    numbers:{
      operator: 'IN_JSON',
      value: [[12, 15]],
    }
  });
}
async function count(): Promise<number> {
  const result= await repo.select().
  or({
    numbers:{
      operator: 'IN_JSON',
      value: [[12]],
    }
  }).
  calculate([{
    fn: 'COUNT',
    alias: 'count',
  }]);
  return result.count;
}

async function create(test: Test): Promise<ResultSetHeader> {
  return await repo.insert([test]);
}
const testService = {
  read,
  count,
  create,
};

export default testService;
