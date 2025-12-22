import { createTypeGuard } from 'type-wizard';
import { Test, TestCreate, TestUpdate } from './Test';

export const isTestCreate = createTypeGuard<TestCreate>({
  text: {type:'string'},
  number: {type:'number'},
  date: {type:'date'},
  numbers: {type:'array', of: {type:'number'}},
});