import { repository } from "../../repository/index";
import { ResultSetHeader } from "../../config";
import { CompareQuery } from "../..";
import { ExtendedResultSetHeader } from "../../repository/query/insert";
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

async function create(testCreates: TestCreate[]): Promise<ExtendedResultSetHeader> {
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

const testBulkInsert = async () => {
  // bulk insert 테스트 - insertIds 확인
  console.log("=== Testing bulk insert with insertIds ===");
  
  const testData: TestCreate[] = [
    {
      title: "Bulk Test 1",
      content: "Content 1",
      snakeCase: "snake_case_1",
      isValid: true,
      isPublic: false,
      json: { test: "data1" },
      jsonArray: [{ item: 1 }],
      enumType: "A"
    },
    {
      title: "Bulk Test 2", 
      content: "Content 2",
      snakeCase: "snake_case_2",
      isValid: false,
      isPublic: true,
      json: { test: "data2" },
      jsonArray: [{ item: 2 }],
      enumType: "B"
    },
    {
      title: "Bulk Test 3",
      content: "Content 3", 
      snakeCase: "snake_case_3",
      isValid: true,
      isPublic: true,
      json: { test: "data3" },
      jsonArray: [{ item: 3 }],
      enumType: "C"
    }
  ];
  
  const result = await pack.insert(testData);
  
  console.log("Insert result:", {
    affectedRows: result.affectedRows,
    insertId: result.insertId,
    insertIds: result.insertIds  // 모든 삽입된 ID들
  });
  
  return result;
};


const novelService = {
  read,
  create,
  update,
  delete: delete_,
  testUndefinedWhere,
  testBulkInsert,
};

export default novelService;
