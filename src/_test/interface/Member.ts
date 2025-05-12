interface Member {
	id: number;
	part_id: number;
	name: string;
	code: string
}
const memberKeys = ['id', 'part_id', 'name', 'code'] as const
type MemberAutoSetKeys = "id"
interface MemberCreate extends Omit<Member, MemberAutoSetKeys> { }
interface MemberUpdate extends Partial<Omit<Member, MemberAutoSetKeys>> { }

export { memberKeys }
export type { Member, MemberCreate, MemberUpdate, MemberAutoSetKeys }