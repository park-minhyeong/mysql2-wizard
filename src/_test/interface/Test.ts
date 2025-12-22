export const testKeys = ['id', 'text', 'number', 'numbers', 'date'] as const
export interface Test {
  id: number;
	text: string;
	number: number;
	numbers:number[];
	date: Date;
}

export type TestCreate = Omit<Test, TestAutoSetKeys>;
export type TestUpdate = Partial<TestCreate>;
export type TestAutoSetKeys = "id"