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

const testEscapedJson = async () => {
  // 이스케이프된 JSON 문자열 테스트
  const testData = await pack.insert([{
    title: 'Test Escaped JSON',
    content: 'Testing escaped JSON string parsing',
    snakeCase: 'test_escaped',
    isValid: true,
    isPublic: false,
    json: { test: 'data' },
    jsonArray: [{ item: 1 }, { item: 2 }],
    enumType: 'A',
    ask: { a: 'asdf' },  // JSON 객체
    askType: 'test',
    difficulty: 1,
    accuracy: 1,
    createdUserId: 1,
    progress: 'activating'
  }]);
  
  // 조회해서 JSON이 파싱되었는지 확인
  const retrieved = await pack.selectOne({ id: testData.insertId });
  console.log('=== Escaped JSON Test Results ===');
  console.log('ask field:', retrieved?.ask, 'type:', typeof retrieved?.ask);
  console.log('json field:', retrieved?.json, 'type:', typeof retrieved?.json);
  
  return retrieved;
};

const novelService = {
  read,
  create,
  update,
  delete: delete_,
  testEscapedJson,
};

export default novelService;
