
import { Novel, NovelAutoSetKeys, NovelCreate, novelKeys, NovelUpdate } from "../interface/Novel";
import { repository } from "../../repository/index";

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
 
const create = async (novelCreate: NovelCreate) => {
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
