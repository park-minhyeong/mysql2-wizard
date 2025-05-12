# MySQL2 Wizard

A TypeScript-based MySQL database utility package that provides an enhanced wrapper around the mysql2 library, offering simplified database operations and configuration management.

## Features

- Easy database configuration management
- Type-safe database operations
- Built-in connection pooling
- Repository pattern support
- Automatic transaction handling
- TypeScript support out of the box

## Installation

```bash
npm install mysql2-wizard
```

## Quick Start

```typescript
import { handler, repository } from 'mysql2-wizard';

// Define your interface
interface Product {
  id: number;
  name: string;
  price: number;
  created_at: Date;
}

// Define auto-generated keys
type ProductAutoSetKeys = 'id' | 'created_at';

// Create repository
const productRepo = repository<Product, ProductAutoSetKeys>({
  keys: ['id', 'name', 'price', 'created_at'],
  table: 'products'
});

// Create service
const productService = {
  async read(id?: number) {
    if (id) return productRepo.findOne({ id });
    return productRepo.find();
  },

  async create(product: Omit<Product, ProductAutoSetKeys>) {
    return productRepo.save(product);
  },

  async update(id: number, product: Partial<Omit<Product, 'id' | 'created_at'>>) {
    return productRepo.update({ id }, product);
  },

  async delete(id: number) {
    return productRepo.delete({ id });
  }
};

// Usage
async function example() {
  // Create a product
  await productService.create({
    name: 'Example Product',
    price: 29.99
  });

  // Get all products
  const products = await productService.read();

  // Get specific product
  const product = await productService.read(1);

  // Update product
  await productService.update(1, { price: 39.99 });

  // Delete product
  await productService.delete(1);
}
```

## Configuration

Create a `.env` file in your project root:

```env
DB_HOST=localhost
DB_USER=your_username
DB_PASSWORD=your_password
DB_DATABASE=your_database
DB_PORT=3306
```

## Custom Transaction Handling

Use the `handler` function when you need custom transaction logic:

```typescript
await handler(async (connection) => {
  // Custom complex operation that needs transaction
  const result = await connection.query('SELECT * FROM products WHERE price > ?', [100]);
  await connection.query('UPDATE products SET featured = ? WHERE id = ?', [true, result[0].id]);
  // Transaction automatically commits if successful
  // Automatically rolls back if there's an error
});
```

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build the project
npm run build

# Run tests
npm run test
```

## Scripts

- `npm run dev`: Start development server with hot-reload
- `npm run build`: Build the project for production
- `npm run build-publish`: Build and prepare for publishing
- `npm run upload`: Build, publish to npm, and push git tags
- `npm run test`: Run test suite

## Dependencies

- mysql2: ^3.14.1
- typescript: 5.6.3
- Other development tools and type definitions

## License

MIT License - see LICENSE file for details

## Author
[@park-minhyeong](https://github.com/park-minhyeong)

## Acknowledgments
This project was inspired by the work of [@Binghagoon](https://github.com/Binghagoon).
