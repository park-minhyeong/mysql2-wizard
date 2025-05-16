interface NovelChapter {
	id: number;
	novelId: number;
	title: string;
	text: string;
	createdAt: Date;
	updatedAt: Date;
}
const novelChapterKeys = ['id', 'novelId', 'title', 'text', 'createdAt', 'updatedAt'] as const
type NovelChapterAutoSetKeys = "id" | "createdAt" | "updatedAt";
interface NovelChapterCreate extends Omit<NovelChapter, NovelChapterAutoSetKeys> { }
interface NovelChapterUpdate extends Partial<NovelChapterCreate> { }

export { novelChapterKeys }
export type { 
	NovelChapter,
	NovelChapterCreate,
	NovelChapterUpdate,
	NovelChapterAutoSetKeys,
}