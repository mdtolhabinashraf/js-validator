# Contributing to js-validator

Thank you for your interest in contributing! We welcome bug reports, feature
requests, and pull requests. This guide explains the basic workflow and quick
commands to get started.

## Getting started

1. Fork the repository and create a branch for your work.
2. Make sure you have Node.js installed (12+ recommended) and install deps:

```bash
npm install
```

3. Run the tests locally while developing:

```bash
npm run test:watch
```

4. Build the project before publishing or running non-dev scripts:

```bash
npm run build
```

## Pull request checklist

- Ensure tests pass and add unit tests for new behaviors (Vitest is used).
- Keep changes focused and small; prefer small PRs that are easy to review.
- Provide a clear PR description explaining the motivation and the
  implementation details.
- Update or add documentation if you introduce new public API or change
  behavior.

## Coding style

- Follow existing TypeScript style (the project uses `tsc` for compilation).
- Keep functions small and well-documented.

## Tests

The repo uses `vitest`. Run tests with:

```bash
npm run test
```

Add unit tests under the `tests/` folder.

## Reporting issues

Open issues at: https://github.com/mdtolhabinashraf/js-validator/issues

## License

By contributing you agree that your contributions will be licensed under the
project's MIT license.
