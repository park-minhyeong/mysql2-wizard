import { repository } from "../../repository";
import { Consult, ConsultAutoSetKeys, ConsultCreate, ConsultUpdate, consultKeys, ConsultView, consultViewKeys, parseRead, ReadOption } from "@edu-tosel/interface";

const view = repository<ConsultView>({
    table: "cs.CONSULT_VIEW",
    keys: consultViewKeys,
});

const repo = repository<Consult, ConsultAutoSetKeys>({
    table: "cs.consult",
    keys: consultKeys,
});

const limit = 100;
interface ConsultReadOption extends ReadOption<ConsultView> {
    consultId?: number;
}

async function read(
    props: Pick<ConsultReadOption, "consultId">
): Promise<ConsultView | undefined>;
async function read(
    props?: Omit<ConsultReadOption, "consultId">
): Promise<ConsultView[]>;
async function read(
    props?: Partial<ConsultReadOption>
): Promise<ConsultView[] | ConsultView | undefined> {
    if (props?.consultId) {
        const consult = await view.selectOne({ consultId: props.consultId });
        if (!consult) return undefined;
        return consult;
    }
    const { page, search, pageSize, data } = parseRead(props);
    const consult = await view
        .select({ ...data })
        .or({ userName: { operator: "LIKE", value: search } })
        .or({ userEmail: { operator: "LIKE", value: search } })
        .or({ nickName: { operator: "LIKE", value: search } })
        .or({ academyName: { operator: "LIKE", value: search } })
        .orderBy([{ column: "consultId", direction: "DESC" }])
        .limit(pageSize && pageSize > 0 ? pageSize : limit)
        .offset(page ? (page - 1) * (pageSize && pageSize > 0 ? pageSize : limit) : 0);
    return consult;
}

async function count(props?: Partial<ConsultReadOption>): Promise<number> {
    const { search, data } = parseRead(props);
    const count = await view
        .select({ ...data })
        .or({ userName: { operator: "LIKE", value: search } })
        .or({ userEmail: { operator: "LIKE", value: search } })
        .or({ nickName: { operator: "LIKE", value: search } })
        .or({ academyName: { operator: "LIKE", value: search } })
        .calculate([{ fn: "COUNT", alias: "count" }]);
    return count.count;
}

async function create(props: ConsultCreate): Promise<number> {
    const result = await repo.insert([{
        ...props,
    }]);
    return result.insertId;
}

async function update(id: number, props: ConsultUpdate): Promise<boolean> {
    const result = await repo.update([[{ id }, props]]);
    return result.affectedRows > 0;
}

async function _delete(id: number): Promise<boolean> {
    const result = await repo.delete([{ id }]);
    return result.affectedRows > 0;
}

const consultAdminService = {
    read,
    count,
    create,
    update,
    delete: _delete,
};

export default consultAdminService;
