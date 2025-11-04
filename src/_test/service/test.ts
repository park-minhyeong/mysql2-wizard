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
interface Token{
  id: number;
  token: string;
  createdAt: Date;
  expiredAt: Date;
}
const userRepo=repository<Token>({
  table: "sso.access_token",
  keys: ["id", "createdAt", "expiredAt", "token"],
  printQuery: true,
});

async function readToken(accessToken: string): Promise<Token[]> {
  const tokens = await userRepo.select({token:accessToken})
  return tokens;
}


const novelService = {
  read,
  readToken,
};

export default novelService;
