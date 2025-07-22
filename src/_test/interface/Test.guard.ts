import { createTypeGuard } from 'type-wizard';
import { Test, TestCreate, TestUpdate } from './Test';

export const isTestCreate = createTypeGuard<TestCreate>({
  title: {type:'string'},
  content: {type:'string', nullable: true},
  snakeCase: {type:'string'},
  isValid: {type:'boolean'},
  isPublic: {type:'boolean'},
  json: {type:'object', of: ()=>true , nullable: true},
  jsonArray: {type:'array', of: ()=>true, nullable: true},
  enumType: {type:'string', enum: ['A', 'B', 'C']},
});