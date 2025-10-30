import { repository } from "../../repository";

export const qTypes = ["T", "I", "A", "AT", "AI", "IT", "AIT"] as const;
export type QType = (typeof qTypes)[number];


const pack = repository<any, never>({
  table: "question",
  keys: ["id"],
  printQuery: true,
});
async function read(): Promise<any[]> {
  const questions = await pack.select()
  .or({ask: { operator:"LIKE", value: undefined}})
  return questions;
}



const novelService = {
  read
};

export default novelService;
