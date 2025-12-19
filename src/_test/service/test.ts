import { ResultSetHeader } from "mysql2";
import { repository } from "../../repository";
import { Test, testKeys } from "../interface/Test";


const repo = repository<Test, never>({
  table: "test.test",
  keys: testKeys,
  printQuery: true,
});

async function read(): Promise<Test[]> {
  return await repo.select();
}

async function create(test: Test): Promise<ResultSetHeader> {
  return await repo.insert([test]);
}
const testService = {
  read,
  create,
};

export default testService;
