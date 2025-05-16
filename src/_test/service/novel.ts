
import { Novel, NovelAutoSetKeys, NovelCreate, novelKeys, NovelUpdate } from "../interface/Novel";
import { repository } from "../../repository/index";
import { ResultSetHeader } from "../../config";

const pack = repository<Novel, NovelAutoSetKeys>({
  table: 'novel',
  keys: novelKeys,
  printQuery: true,	
});

async function read(): Promise<Novel[]>;
async function read(id: number): Promise<Novel | undefined>;
async function read(id?: number): Promise<Novel[] | Novel | undefined> {
	if (!id) return pack.find();
	return pack.findOne({ id });
}


async function create(novelCreate: NovelCreate): Promise<ResultSetHeader>;
async function create(novelCreate: NovelCreate[]):Promise<ResultSetHeader>;
async function create(novelCreate: NovelCreate | NovelCreate[]):Promise<ResultSetHeader> {
	if(novelCreate instanceof Array) return pack.saveMany(novelCreate);
	return pack.save(novelCreate);
};

const update = async (id: number, novelUpdate: NovelUpdate) => {
	return pack.update({ id }, novelUpdate);
};
const delete_ = async (id: number) => {
	return pack.delete({ id });
}


const novelService = {
	read,
	create,
	update, 
	delete: delete_,
};

export default novelService;
