# Contributing to prettier-plugin-apex-imo

Thank you for your interest in contributing to prettier-plugin-apex-imo! This
document provides guidelines and instructions for contributing to the project.

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to
follow. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before
participating.

## How to Contribute

There are several ways you can contribute to this project:

- **Reporting bugs**: If you find a bug, please open an issue using the bug
  report template
- **Suggesting features**: If you have an idea for a new feature, please open an
  issue using the feature request template
- **Submitting pull requests**: If you want to contribute code, please follow
  the guidelines below
- **Improving documentation**: Documentation improvements are always welcome!

## Development Setup

### Prerequisites

- Node.js >= 20
- pnpm >= 10.26.2 (see [docs/PNPM.md](docs/PNPM.md) for installation
  instructions)
- Git

### Getting Started

1. **Fork the repository** on GitHub

2. **Clone your fork** locally:

    ```bash
    git clone https://github.com/your-username/prettier-plugin-apex-imo.git
    cd prettier-plugin-apex-imo
    ```

3. **Install dependencies**:

    ```bash
    pnpm install
    ```

4. **Run the development setup**:
    ```bash
    pnpm run build
    ```

## Development Workflow

### Making Changes

1. **Create a branch** for your changes:

    ```bash
    git checkout -b your-branch-name
    ```

    Use descriptive branch names like `fix/multiline-map-formatting` or
    `feature/nested-list-support`

2. **Make your changes** and test them locally:

    ```bash
    # Run tests
    pnpm run test

    # Run tests in watch mode
    pnpm run test:watch

    # Run linting
    pnpm run lint

    # Run type checking
    pnpm run typecheck

    # Format code
    pnpm run format
    ```

3. **Ensure all checks pass**:
    - All tests pass: `pnpm run test`
    - Code is properly formatted: `pnpm run format:check`
    - No linting errors: `pnpm run lint`
    - Type checking passes: `pnpm run typecheck`
    - Build succeeds: `pnpm run build`

### Writing Tests

- Add tests for any new functionality or bug fixes
- Tests are located in the `tests/` directory
- Test fixtures (input/output examples) should be added to `tests/__fixtures__/`
- Ensure test coverage remains high

### Code Style

- Code is automatically formatted with Prettier
- ESLint is used for code quality checks
- TypeScript strict mode is enabled
- Follow existing code patterns and conventions

## Submitting Pull Requests

1. **Update your branch** with the latest changes from main:

    ```bash
    git checkout main
    git pull upstream main
    git checkout your-branch-name
    git rebase main
    ```

2. **Push your changes** to your fork:

    ```bash
    git push origin your-branch-name
    ```

3. **Create a Pull Request** on GitHub:
    - Use a clear, descriptive title
    - Fill out the pull request template completely
    - Reference any related issues
    - Ensure all CI checks pass

4. **Respond to feedback**:
    - Address any review comments
    - Make requested changes
    - Keep discussions focused and constructive

### Pull Request Checklist

Before submitting a pull request, please ensure:

- [ ] Your code follows the project's style guidelines
- [ ] You have added tests for new functionality
- [ ] All existing tests pass
- [ ] You have run `pnpm run lint` and fixed any issues
- [ ] You have run `pnpm run typecheck` and resolved any errors
- [ ] You have run `pnpm run format` to format your code
- [ ] Your commit messages are clear and descriptive
- [ ] You have updated documentation if needed

## Commit Messages

Please follow these guidelines for commit messages:

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line
- Consider starting the commit message with an applicable emoji:
    - 🐛 `:bug:` for bug fixes
    - ✨ `:sparkles:` for new features
    - 📝 `:memo:` for documentation updates
    - ♻️ `:recycle:` for refactoring
    - ✅ `:white_check_mark:` for adding tests
    - 🔧 `:wrench:` for configuration changes

## Testing

Run the test suite:

```bash
# Run all tests
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Run tests with coverage
pnpm run test:coverage

# Run tests in CI mode (with coverage)
pnpm run test:ci
```

## Project Structure

```
prettier-plugin-apex-imo/
├── src/              # Source code
│   ├── index.ts      # Main plugin entry point
│   ├── printer.ts    # Printing logic
│   ├── types.ts      # TypeScript type definitions
│   └── utils.ts      # Utility functions
├── tests/            # Test files
│   ├── __fixtures__/ # Test fixtures (input/output examples)
│   └── *.test.ts     # Test files
├── dist/             # Build output (generated)
└── docs/             # Documentation
```

## Questions?

If you have questions about contributing, please:

- Open an issue with the `question` label
- Check existing issues and discussions
- Review the project documentation

## License

By contributing to prettier-plugin-apex-imo, you agree that your contributions
will be licensed under the MIT License.
