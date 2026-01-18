# Contributing

## Development

### Quick Start

```bash
git clone https://github.com/NeoLabHQ/nestjs-log-decorator.git
cd nestjs-log-decorator
npm install
npm run dev
# Will run build and test in watch mode
```

### Testing

```bash
npm run test
```

### Building

```bash
npm run build
```

## Commits and Releases

This project uses **semantic-release** for automated versioning and changelog generation. All commits must follow the **Conventional Commits** format.

### Commit

Instead of `git commit`, use:

```bash
git add .
npm run commit
```

Or simply

```bash
# Add all to git and commit with commitizen
npm run cz
```

This launches an interactive prompt that guides you through creating a properly formatted commit message.

### Commit Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**Types:**

- `feat` - New feature (triggers minor version bump)
- `fix` - Bug fix (triggers patch version bump)
- `docs` - Documentation changes
- `style` - Code style changes (formatting, no code change)
- `refactor` - Code refactoring
- `perf` - Performance improvements
- `test` - Adding or updating tests
- `chore` - Maintenance tasks
- `ci` - CI/CD changes

**Breaking changes:** Add `BREAKING CHANGE:` in the footer or `!` after type (e.g., `feat!:`) to trigger a major version bump.
