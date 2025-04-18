# Deckonomics

## Prisma Database Schema

### Set

A `Set` maps to a `Group` from the TCGCSV and TCGplayer API

### Card

A `Card` is a combined entity that has both product and sales information for a Card.

### CardSales

TBD

## Scripts

### Prisma Scripts
- `prisma:generate`: Generates Prisma client based on your schema.
- `prisma:studio`: Start Prisma Studio and opens in the browser.
- `prisma:push`: Push the Prisma schema state to the database
- `prisma:validate`: Validate the Prisma schema.
- `prisma:format`: Format the Prisma schema

### Lint/Format Scripts
- `format`: Runs Prettier to format all TypeScript and JSON files for consistent code style
- `lint`: Runs ESLint to check for code style and potential errors in TypeScript files
- `lint:fix`: Runs ESLint and automatically fixes fixable issues in TypeScript files

## Build Scripts
- `build`: Compiles TypeScript code to JavaScript using the TypeScript compiler (tsc)

## Run Scripts
- `start`: Generates Prisma client and runs the application using tsx

