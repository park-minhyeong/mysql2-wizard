// Novel
const novelKeys = [
  "id",
  "promptId",
  "name",
  "summary",
  "thumbnail",
  "isValid",
  "createdAt",
  "updatedAt",
] as const;
const novelAutoSetKeys = ["id", "createdAt", "updatedAt"] as const;
type NovelAutoSetKeys = (typeof novelAutoSetKeys)[number];

interface Novel {
  id: number;
  promptId: number;
  name: string;
  summary: string;
  thumbnail: string | null;
  isValid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface NovelCreate extends Omit<Novel, NovelAutoSetKeys> {}
interface NovelUpdate extends Partial<NovelCreate> {}

export type { Novel, NovelAutoSetKeys, NovelCreate, NovelUpdate };
export { novelKeys, novelAutoSetKeys };

export const novelTagMapKeys = ["tag", "novelId"] as const;

export interface NovelTagMap {
  tag: string;
  novelId: number;
}
