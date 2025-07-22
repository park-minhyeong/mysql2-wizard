
import { repository } from "../../repository/index";
import { ResultSetHeader } from "../../config";
import { CompareQuery } from "../..";
import { Test, TestAutoSetKeys, TestCreate, testKeys, TestUpdate } from "../interface/Test";

interface TestJoin{
  test_id:number;
  name:string;
}

const pack = repository<Test, TestAutoSetKeys>({
  table: "test",
  keys: testKeys,
  printQuery: true,
  relations:{
    testJoins:{
      table:"test_join",
      keys:["name"],
      localKey:"id",
      foreignKey:"testId",
      type:"hasOne"
    }
  }
});

async function read(): Promise<Test[]>;
async function read(id: number): Promise<Test | undefined>;
async function read(id?: number): Promise<Test[] | Test | undefined> {
  if (!id) return pack.select().with("testJoins").orderBy([{ column: 'title', direction: 'ASC' },{ column: 'id', direction: 'DESC' }]).limit(40);
  return pack.selectOne({ id });
} 

async function create(testCreates: TestCreate[]): Promise<ResultSetHeader> {
  return pack.insert(testCreates);
}

const update = async (updates: [CompareQuery<Test>, TestUpdate][]) => {
  return pack.update(updates);
};

const delete_ = async () => {
  return pack.delete({ id:{operator:"<", value:60} });
};

const novelService = {
  read,
  create,
  update,
  delete: delete_,
};

export default novelService;
