import { SelectOption } from '../../../interface/Query';

const limit = <T>(options?: SelectOption<T>): string => {
	if (!options) return '';
	
	let clause = '';
	
	if (options.limit) {
		clause += ` LIMIT ${options.limit}`;
	}
	
	if (options.offset) {
		clause += ` OFFSET ${options.offset}`;
	}
	
	return clause;
}; 

export default limit;