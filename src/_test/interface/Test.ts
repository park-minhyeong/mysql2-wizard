export const testKeys = ['id', 'title', 'content', 'snakeCase', 'isValid', 'isPublic', 'json', 'jsonArray', 'enumType', 'createdAt', 'updatedAt'] as const
export interface Test {
  id: number;
  title: string;
	content: string | null;
	snakeCase: string;
	isValid: boolean;
	isPublic: boolean;
	json: object | null;
	jsonArray: object[] | null;
	enumType: 'A' | 'B' | 'C';
	createdAt: Date;
	updatedAt: Date;
}

export type TestCreate = Omit<Test, TestAutoSetKeys>;
export type TestUpdate = Partial<TestCreate>;
export type TestAutoSetKeys = "id" | "createdAt" | "updatedAt"