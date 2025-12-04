# MySQL2 Wizard

A modern TypeScript-based MySQL database utility package that provides an enhanced wrapper around the mysql2 library, offering simplified database operations with elegant chainable queries.

## ✨ Features

- 🔗 **Fluent Chainable API** - Modern query building with method chaining
- 🛡️ **Type-safe operations** - Full TypeScript support with compile-time safety
- 🔄 **Auto snake_case conversion** - Seamless camelCase ↔ snake_case mapping
- 📦 **JSON handling** - Automatic JSON serialization/deserialization (MySQL & MariaDB)
- 🎯 **Complex queries** - Support for IN, LIKE, comparison operators
- 🏊 **Connection pooling** - Built-in connection pool management
- 🏗️ **Repository pattern** - Clean architecture with auto-set columns
- 💫 **Promise-like queries** - Use `await` anywhere in the chain
- 🔀 **Batch operations** - Efficient bulk insert/update operations
- 🔗 **Relations** - hasOne, hasMany, belongsTo relationships with automatic JOINs
- 🔧 **JOIN operations** - Manual JOIN support with type safety
- 📊 **Enhanced querying** - Select specific columns, pagination, ordering

## 📦 Installation

```bash
npm install mysql2-wizard
```

## 🚀 Quick Start

```typescript
import { repository } from 'mysql2-wizard';

// Define your interface
interface User {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  metadata: object | null;
  createdAt: Date;
  updatedAt: Date;
}

// Define auto-generated keys
type UserAutoSetKeys = 'id' | 'createdAt' | 'updatedAt';

// Create repository
const userRepo = repository<User, UserAutoSetKeys>({
  keys: ['id', 'name', 'email', 'isActive', 'metadata', 'createdAt', 'updatedAt'],
  table: 'users',
  printQuery: true // Optional: log SQL queries
});
```

## 🔗 Chainable Query API

### Simple Queries

```typescript
// Get all users - execute immediately
const allUsers = await userRepo.select();

// Get active users with chaining
const activeUsers = await userRepo
  .select({ isActive: true });

// Complex filtering
const results = await userRepo
  .select({ 
    isActive: true,
    id: [1, 2, 3, 4, 5] // IN clause
  });
```

### Advanced Chaining

```typescript
// Full-featured query with ordering and pagination
const users = await userRepo
  .select({ isActive: true })
  .orderBy([
    { column: 'createdAt', direction: 'DESC' },
    { column: 'name', direction: 'ASC' }
  ])
  .limit(10)
  .offset(20);

// You can await at any point in the chain!
const orderedUsers = await userRepo
  .select({ email: { operator: 'LIKE', value: '%@gmail.com' } })
  .orderBy([{ column: 'name', direction: 'ASC' }]);

// Execute method for explicit execution
const explicitUsers = await userRepo
  .select({ isActive: true })
  .orderBy([{ column: 'name', direction: 'ASC' }])
  .execute();

// JOIN operations
const usersWithProfiles = await userRepo
  .select({ isActive: true })
  .join('user_profiles', 'id', 'userId', 'LEFT')
  .select(['id', 'name', 'email', 'bio'])
  .execute();

// Multiple JOINs
const complexQuery = await userRepo
  .select({ isActive: true })
  .join('user_profiles', 'id', 'userId', 'LEFT')
  .join('user_roles', 'id', 'userId', 'INNER')
  .select(['id', 'name', 'email', 'bio', 'role_name'])
  .orderBy([{ column: 'name', direction: 'ASC' }])
  .limit(10);
```

## 🎯 Complex Query Conditions

### Comparison Operators

```typescript
// Various comparison operators
const users = await userRepo.select({
  id: { operator: '>', value: 100 },           // id > 100
  name: { operator: 'LIKE', value: '%john%' }, // name LIKE '%john%'
  isActive: true,                              // is_active = true
  createdAt: { operator: '>=', value: new Date('2024-01-01') }
});
```

### IN Clauses

```typescript
// Multiple ways to use IN
const users = await userRepo.select({
  id: [1, 2, 3, 4],                           // Direct array
  status: { operator: 'IN', value: ['active', 'pending'] } // Explicit IN
});
```

## 📦 CRUD Operations

### Create (Insert)

```typescript
// Single insert
const result = await userRepo.insert([{
  name: 'John Doe',
  email: 'john@example.com',
  isActive: true,
  metadata: { preferences: { theme: 'dark' } } // JSON auto-serialized
}]);

// Bulk insert
const bulkResult = await userRepo.insert([
  { name: 'Alice', email: 'alice@example.com', isActive: true, metadata: null },
  { name: 'Bob', email: 'bob@example.com', isActive: false, metadata: { role: 'admin' } }
]);
```

### Read (Select)

```typescript
// Find one user
const user = await userRepo.selectOne({ email: 'john@example.com' });

// Complex search with pagination
const searchResults = await userRepo
  .select({ 
    name: { operator: 'LIKE', value: '%john%' },
    isActive: true 
  })
  .orderBy([{ column: 'createdAt', direction: 'DESC' }])
  .limit(5);

// SelectOne with chaining
const singleUser = await userRepo
  .selectOne({ email: 'john@example.com' })
  .select(['id', 'name', 'email'])
  .execute();
```

### Update

```typescript
// Batch updates
const updateResult = await userRepo.update([
  [{ id: 1 }, { name: 'Updated Name' }],
  [{ id: 2 }, { isActive: false }],
  [{ email: 'old@email.com' }, { email: 'new@email.com' }]
]);
```

### Delete

```typescript
// Delete with conditions
const deleteResult = await userRepo.delete([
  { isActive: false },
  { createdAt: { operator: '<', value: new Date('2023-01-01') } }
]);

// Delete by ID list
const bulkDelete = await userRepo.delete([
  { id: 1 },
  { id: 2 },
  { id: 3 },
  { id: 4 },
  { id: 5 }
]);
```

## 🔧 Advanced Features

### JSON Data Handling

```typescript
interface Product {
  id: number;
  name: string;
  specifications: object;      // Auto JSON handling
  tags: string[];             // Auto JSON array handling
  ask: object;                // Any field with JSON content
}

const product = await productRepo.insert([{
  name: 'Laptop',
  specifications: {           // Automatically serialized to JSON string
    cpu: 'Intel i7',
    ram: '16GB',
    storage: '512GB SSD'
  },
  tags: ['electronics', 'computers'], // Automatically serialized
  ask: { a: 'asdf' }          // Any JSON object
}]);

// Retrieved data is automatically deserialized back to objects
const retrieved = await productRepo.selectOne({ id: product.insertId });
console.log(retrieved.specifications.cpu); // 'Intel i7'
console.log(retrieved.ask.a); // 'asdf'

// Supports both MySQL and MariaDB JSON formats
// MySQL: {"a":"asdf"}
// MariaDB: "{\"a\":\"asdf\"}"
```

### Relations (Enhanced)

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Post {
  id: number;
  title: string;
  content: string;
  userId: number;
  createdAt: Date;
  updatedAt: Date;
}

// Repository with relations
const userRepo = repository<User, 'id' | 'createdAt' | 'updatedAt'>({
  table: 'users',
  keys: ['id', 'name', 'email', 'isActive', 'createdAt', 'updatedAt'],
  relations: {
    posts: {
      table: 'posts',
      localKey: 'id',
      foreignKey: 'userId',
      type: 'hasMany',
      keys: ['id', 'title', 'content', 'userId', 'createdAt', 'updatedAt']
    },
    profile: {
      table: 'user_profiles',
      localKey: 'id',
      foreignKey: 'userId',
      type: 'hasOne',
      keys: ['id', 'userId', 'bio', 'avatar']
    }
  }
});

// Query with relations
const userWithPosts = await userRepo
  .selectOne({ id: 1 })
  .with('posts')
  .with('profile')
  .execute();

console.log(userWithPosts);
// {
//   id: 1,
//   name: 'John Doe',
//   email: 'john@example.com',
//   isActive: true,
//   posts: [
//     { id: 1, title: 'First Post', content: 'Hello World', userId: 1 },
//     { id: 2, title: 'Second Post', content: 'Another post', userId: 1 }
//   ],
//   profile: { id: 1, userId: 1, bio: 'Software Developer', avatar: 'avatar.jpg' }
// }
```

### Custom Service Layer

```typescript
const userService = {
  async getActiveUsers(page = 1, limit = 10) {
    return userRepo
      .select({ isActive: true })
      .orderBy([{ column: 'createdAt', direction: 'DESC' }])
      .limit(limit)
      .offset((page - 1) * limit);
  },

  async searchUsers(query: string) {
    return userRepo
      .select({
        name: { operator: 'LIKE', value: `%${query}%` }
      })
      .orderBy([{ column: 'name', direction: 'ASC' }]);
  },

  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) {
    return userRepo.insert([userData]);
  },

  async deactivateOldUsers(beforeDate: Date) {
    return userRepo.update([
      [
        { 
          isActive: true,
          createdAt: { operator: '<', value: beforeDate }
        },
        { isActive: false }
      ]
    ]);
  }
};
```

## ⚙️ Configuration

Create a `.env` file in your project root:

```env
DB_HOST=localhost
DB_USER=your_username
DB_PASSWORD=your_password
DB_DATABASE=your_database
DB_PORT=3306
DB_CONNECTION_LIMIT=10
DB_QUEUE_LIMIT=0
DB_WAIT_FOR_CONNECTIONS=true
DB_MULTIPLE_STATEMENTS=false
DB_DEBUG=false
CASTED_BOOLEAN=true
CASTED_DECIMAL_AS_NUMBER=true
DB_CONNECTION_RETRY_COUNT=3
DB_CONNECTION_RETRY_DELAY=1000
DB_ENABLE_KEEP_ALIVE=true
DB_IDLE_TIMEOUT=60000
DB_ENABLE_RECONNECT=true
```

설명:
- `CASTED_BOOLEAN`: TINYINT(1)을 boolean으로 캐스팅합니다.
- `CASTED_DECIMAL_AS_NUMBER`(기본값: true): DECIMAL/NEWDECIMAL/FLOAT/DOUBLE 결과를 숫자 타입으로 캐스팅합니다. 정밀도가 중요한 금액/빅넘버 컬럼에서는 `false`로 비활성화를 권장합니다.
- `DB_CONNECTION_RETRY_COUNT`(기본값: 3): "Too many connections" 또는 "Connection lost" 에러 발생 시 재시도 횟수입니다.
- `DB_CONNECTION_RETRY_DELAY`(기본값: 1000): 재시도 간 대기 시간(밀리초)입니다. 지수 백오프 방식으로 증가합니다 (1초, 2초, 4초...).
- `DB_ENABLE_KEEP_ALIVE`(기본값: true): Keep-alive 패킷으로 DB 연결을 유지합니다. DB의 `wait_timeout`보다 짧게 설정된 경우 연결이 끊기는 것을 방지합니다.
- `DB_IDLE_TIMEOUT`(기본값: 60000): Pool에서 idle 커넥션을 정리하는 시간(밀리초)입니다. DB의 `wait_timeout`보다 짧게 설정하는 것을 권장합니다 (예: DB가 300초면 60초).
- `DB_ENABLE_RECONNECT`(기본값: true): 연결이 끊겼을 때 자동으로 재연결을 시도합니다.

## 🔄 Custom Transaction Handling

```typescript
import { handler } from 'mysql2-wizard';

// Complex transaction with manual control
await handler(async (connection) => {
  // Multiple operations in single transaction
  await connection.query('UPDATE accounts SET balance = balance - ? WHERE id = ?', [100, 1]);
  await connection.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [100, 2]);
  await connection.query('INSERT INTO transactions (from_id, to_id, amount) VALUES (?, ?, ?)', [1, 2, 100]);
  
  // Transaction automatically commits if successful
  // Automatically rolls back if there's an error
}, {
  useTransaction: true,
  throwError: true,
  printSqlError: true
});
```

## 📝 Generated SQL Examples

```sql
-- Simple select
SELECT * FROM `users` WHERE `is_active` = ?

-- Complex query with chaining
SELECT * FROM `users` 
WHERE `name` LIKE ? AND `is_active` = ? AND `id` IN (?, ?, ?) 
ORDER BY `created_at` DESC, `name` ASC 
LIMIT 10 OFFSET 20

-- Bulk insert
INSERT INTO `users` (`name`, `email`, `is_active`, `metadata`, `created_at`, `updated_at`) 
VALUES (?, ?, ?, ?, DEFAULT, DEFAULT), (?, ?, ?, ?, DEFAULT, DEFAULT)

-- Batch update
UPDATE `users` SET `name` = ? WHERE `id` = ?
UPDATE `users` SET `is_active` = ? WHERE `email` = ?
```

## 🎨 TypeScript Integration

```typescript
// Full type safety and auto-completion
interface BlogPost {
  id: number;
  title: string;
  content: string;
  authorId: number;
  tags: string[];
  publishedAt: Date | null;
  createdAt: Date;
}

type PostAutoSetKeys = 'id' | 'createdAt';

const postRepo = repository<BlogPost, PostAutoSetKeys>({
  keys: ['id', 'title', 'content', 'authorId', 'tags', 'publishedAt', 'createdAt'],
  table: 'blog_posts'
});

// TypeScript ensures type safety
const posts: BlogPost[] = await postRepo
  .select({ 
    authorId: 123,
    publishedAt: { operator: '!=', value: null }
  })
  .orderBy([{ column: 'publishedAt', direction: 'DESC' }]); // ✅ Type-safe

// This would cause TypeScript error:
// .orderBy([{ column: 'invalidColumn', direction: 'DESC' }]); // ❌ Error
```

## 🚀 Development

```bash
# Install dependencies
npm install

# Run development server with hot-reload
npm run dev

# Build the project
npm run build

# Build and publish
npm run build-publish
npm run upload
```

## 📊 Performance Features

- **Connection Pooling**: Automatic connection pool management
- **Batch Operations**: Efficient bulk insert/update operations  
- **Prepared Statements**: SQL injection protection with prepared statements
- **Query Optimization**: Automatic snake_case conversion happens only once
- **Memory Efficient**: Streaming support for large datasets

## 🔗 Comparison with Other ORMs

| Feature | MySQL2 Wizard | TypeORM | Prisma | Sequelize |
|---------|---------------|---------|--------|-----------|
| Chainable API | ✅ | ❌ | ❌ | ❌ |
| Zero Dependencies | ✅ | ❌ | ❌ | ❌ |
| Auto snake_case | ✅ | ❌ | ✅ | ❌ |
| JSON Auto-handling | ✅ | ❌ | ❌ | ❌ |
| Promise-like Queries | ✅ | ❌ | ❌ | ❌ |
| TypeScript First | ✅ | ✅ | ✅ | ❌ |

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 👨‍💻 Author

[@park-minhyeong](https://github.com/park-minhyeong)

## 🙏 Acknowledgments

This project was inspired by the work of [@Binghagoon](https://github.com/Binghagoon).

---

⭐ **Star this repository if you find it useful!** ⭐
