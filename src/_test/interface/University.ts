type UniversityCountry = "US" | "KR"
interface University {
	id: number;
	name: string;
	country: UniversityCountry;
}
type UniversityAutoSetKeys = "id" | "createdAt" | "updatedAt"
interface UniversityCreate extends Omit<University, UniversityAutoSetKeys> { }
interface UniversityUpdate extends Partial<Omit<University, UniversityAutoSetKeys>> { }

export type {
	University,
	UniversityCreate,
	UniversityUpdate,
}