import { repository } from "../../repository/index";
import { ResultSetHeader } from "../../config";
import { CompareQuery } from "../..";
import {
  Test,
  TestAutoSetKeys,
  TestCreate,
  testKeys,
  TestUpdate,
} from "../interface/Test";

interface TestJoin {
  test_id: number;
  name: string;
}

const pack = repository<Test, TestAutoSetKeys>({
  table: "test",
  keys: testKeys,
  printQuery: true,
  // relations: {
  //   testJoins: {
  //     table: "test_join",
  //     keys: ["testId", "title"],
  //     localKey: "id",
  //     foreignKey: "testId",
  //     type: "hasOne"
  //   }
  // }
});

async function read(): Promise<Test[]>;
async function read(id: number): Promise<Test | undefined>;
async function read(id?: number): Promise<Test[] | Test | undefined> {
  if (!id) return pack.select().limit(40);
  return pack.selectOne({ id });
}

async function create(testCreates: TestCreate[]): Promise<ResultSetHeader> {
  return pack.insert(testCreates);
}

const update = async (updates: [CompareQuery<Test>, TestUpdate][]) => {
  return pack.update(updates);
};

const delete_ = async () => {
  return pack.delete([{ id: 75 }, { id: 76 }]);
};

const testUndefinedWhere = async () => {
  // undefined 값이 포함된 WHERE 조건 테스트
  console.log("=== Testing undefined WHERE condition ===");
  
  // undefined 값이 포함된 쿼리
  const result = await pack.select({ 
    isValid: undefined,  // undefined 값
    isPublic: true       // 실제 값
  }).limit(5);
  
  console.log("Result count:", result.length);
  return result;
};


const novelService = {
  read,
  create,
  update,
  delete: delete_,
  testUndefinedWhere,
};

export default novelService;
