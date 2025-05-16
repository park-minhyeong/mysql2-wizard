import { novelChapterKeys, NovelChapter, NovelChapterAutoSetKeys, NovelChapterCreate, NovelChapterUpdate } from "../interface/NovelChapter";
import { repository } from "../../repository/index";
import { ResultSetHeader } from "../../config";
const pack = repository<NovelChapter, NovelChapterAutoSetKeys>({
	keys: novelChapterKeys,
	table: "ohrora.novel_chapter",
	printQuery: true, 
})
async function read(): Promise<NovelChapter[]>;
async function read(id: number): Promise<NovelChapter | undefined>;
async function read(id?: number): Promise<NovelChapter[] | NovelChapter | undefined> {
	if (id) return pack.findOne({ id });
	return pack.find();
}
async function readByNovelId(novelId: number): Promise<NovelChapter[] | NovelChapter | undefined> {
	return pack.find({ novelId });
}
async function create(novelChapterCreate: NovelChapterCreate): Promise<ResultSetHeader> {
	return pack.save(novelChapterCreate);
}
async function update(id: number, novelChapterUpdate: NovelChapterUpdate): Promise<ResultSetHeader> {
	return pack.update({ id }, novelChapterUpdate);
}
async function delete_(id: number): Promise<ResultSetHeader> {
	return pack.delete({ id });
}
const novelChapterService = { read, readByNovelId, create, update, delete: delete_ };
export default novelChapterService


 
