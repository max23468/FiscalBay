# Contributing to eBay Public API Migration Skills

Thank you for your interest in contributing to this project! We welcome contributions from the community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Enhancements](#suggesting-enhancements)
- [Pull Request Process](#pull-request-process)
- [Development Setup](#development-setup)
- [Style Guidelines](#style-guidelines)

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before contributing.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include as many details as possible:

**Required Information:**
- **Skill name**: Which skill is affected (e.g., listing-management)
- **AI agent**: Which AI assistant you're using (Claude Code, Cursor, Copilot, etc.)
- **OS**: Your operating system (macOS, Windows, Linux)
- **Node.js version**: Output of `node --version`
- **Skills framework version**: Output of `npx skills --version`
- **Installation method**: How you installed (GitHub, tarball, local, etc.)
- **Expected behavior**: What you expected to happen
- **Actual behavior**: What actually happened
- **Error output**: Complete error messages or logs

**Example:**
```
**Skill**: listing-management
**AI Agent**: Claude Code
**OS**: macOS 13.5
**Node.js**: v18.16.0
**Installation**: npx skills add github:ebay/public-api-migration-skills
**Expected**: Skill should be available in Claude Code
**Actual**: Skill not found
**Error Output**: [paste error here]
```

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Clear title**: Descriptive summary of the enhancement
- **Use case**: Why is this enhancement needed?
- **Proposed solution**: How should it work?
- **Alternatives**: Other solutions you've considered
- **Impact**: Who would benefit from this?

## Pull Request Process

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then:
git clone git@github.com:YOUR-USERNAME/public-api-migration-skills.git
cd public-api-migration-skills
```

### 2. Create a Branch

```bash
# Create a descriptive branch name
git checkout -b feature/add-order-management-skill
git checkout -b fix/listing-management-examples
git checkout -b docs/improve-readme
```

### 3. Make Your Changes

- Write clear, concise content
- Follow existing documentation style
- Update examples as needed
- Test your changes with actual AI agents

### 4. Test Your Changes

```bash
# Test installation from local directory
npx skills add ./

# Verify skill structure
ls -la skills/

# Check that skills follow the correct format
cat skills/listing-management/SKILL.md
cat skills/listing-management/INDEX.md
cat skills/listing-management/INTENTS.md

# Test with your AI agent
npx skills add ./ --local
# Then restart your AI agent and test the skill
```

### 5. Commit Your Changes

Use clear, descriptive commit messages:

```bash
# Good commit messages
git commit -m "Add order-management skill"
git commit -m "Fix GraphQL examples in listing-management"
git commit -m "Update installation instructions for skills framework"

# Bad commit messages (avoid)
git commit -m "fix bug"
git commit -m "update"
git commit -m "changes"
```

### 6. Push and Create Pull Request

```bash
git push origin feature/add-order-management-skill
```

Then create a pull request on GitHub with:
- **Clear title**: Summarize the change
- **Description**: What does this PR do and why?
- **Testing**: How was this tested?
- **Related issues**: Link to any related issues

**Pull Request Template:**
```markdown
## Description
Brief description of what this PR does.

## Motivation
Why is this change needed?

## Changes
- Change 1
- Change 2
- Change 3

## Testing
How was this tested?
- [ ] Tested with Claude Code
- [ ] Tested with Cursor
- [ ] Tested installation via `npx skills add`
- [ ] Verified skill structure (SKILL.md, INDEX.md, INTENTS.md)
- [ ] Tested actual AI agent behavior with the skill

## Checklist
- [ ] Content follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or documented if unavoidable)
- [ ] Examples include no real credentials or PII
```

### 7. Code Review

- Maintainers will review your PR
- Address feedback by pushing new commits
- Once approved, a maintainer will merge your PR

## Development Setup

### Quick Start

```bash
# Clone the repository
git clone git@github.com:ebay/public-api-migration-skills.git
cd public-api-migration-skills

# Test local installation
npx skills add ./

# Verify structure
ls -la skills/

# Test with your AI agent
npx skills add ./ --local
```

### Repository Structure

```
public-api-migration-skills/
├── skills/                    # Skills directory
│   └── listing-management/    # Example skill
│       ├── SKILL.md          # Skill definition (required)
│       ├── INDEX.md          # Skill overview (required)
│       ├── INTENTS.md        # Trigger patterns (required)
│       ├── references/       # API documentation
│       │   ├── operation-mapping.md
│       │   └── operations/   # Individual operation docs
│       ├── rules/            # Migration rules
│       └── evals/            # Evaluation tests
├── README.md                 # Main documentation
├── GETTING_STARTED.md        # Installation guide
├── CONTRIBUTING.md           # This file
├── LICENSE.md               # License
└── package.json             # Package metadata
```

### Testing Your Changes

#### Test Installation

```bash
# Test global installation
npx skills add ./

# Test local installation
npx skills add ./ --local

# Verify files are copied correctly
ls -la ~/.claude/skills/listing-management/
```

#### Test Skill Structure

Every skill must have:

1. **SKILL.md** - Main skill definition with instructions
2. **INDEX.md** - Overview and skill metadata
3. **INTENTS.md** - Patterns that trigger the skill

```bash
# Verify required files exist
test -f skills/listing-management/SKILL.md && echo "✓ SKILL.md exists"
test -f skills/listing-management/INDEX.md && echo "✓ INDEX.md exists"
test -f skills/listing-management/INTENTS.md && echo "✓ INTENTS.md exists"
```

#### Test with AI Agent

1. Install skills locally: `npx skills add ./ --local`
2. Restart your AI agent completely
3. Test skill triggering with example prompts from INTENTS.md
4. Verify skill provides correct guidance

## Style Guidelines

### Markdown Style

- Use clear, concise language
- Include code examples for API operations
- Use proper markdown formatting
- Test all commands in examples
- Keep security best practices in mind (no real credentials)

### Skill Content Guidelines

When contributing new skills or updating existing ones:

1. **Accuracy**: Ensure API mappings are correct and up-to-date
2. **Completeness**: Include request/response examples
3. **Security**: Never include real credentials, tokens, or PII
4. **Clarity**: Write for external developers, not eBay employees
5. **Structure**: Follow existing skill directory structure

### Required Skill Files

#### SKILL.md
Contains the main skill instructions for the AI agent.

**Format:**
```markdown
# Skill Name

## Description
Clear description of what this skill does

## Instructions
Step-by-step guidance for the AI agent

## Examples
Practical examples with code
```

#### INDEX.md
Provides metadata and overview.

**Format:**
```markdown
---
name: skill-name
description: One-line description
tags: [tag1, tag2]
---

# Overview
Detailed overview of the skill
```

#### INTENTS.md
Defines patterns that trigger the skill.

**Format:**
```markdown
# Intents

## Pattern 1
- "user prompt example 1"
- "user prompt example 2"

## Pattern 2
- "another example prompt"
```

### Commit Message Guidelines

Format: `<type>: <subject>`

**Types:**
- `feat`: New feature or skill
- `fix`: Bug fix or correction
- `docs`: Documentation changes
- `refactor`: Content restructuring
- `test`: Adding or updating evaluation tests
- `chore`: Maintenance tasks

**Examples:**
```
feat: add order-management skill
fix: correct GraphQL query in listing examples
docs: improve installation instructions
refactor: reorganize listing-management references
test: add evaluation tests for createListing
chore: update package metadata
```

### Security Guidelines

**Never include:**
- Real OAuth tokens
- Real API keys
- Real user IDs
- Customer PII (names, emails, phone numbers)
- Production URLs with sensitive data

**Always use placeholders:**
```javascript
// Good
const token = "YOUR_EBAY_OAUTH_TOKEN";
const userId = "YOUR_USER_ID";

// Bad (never do this)
const token = "v^1.1#i^1#...actual.token...";
const userId = "12345678";
```

## Questions?

- **General questions**: Open a GitHub Discussion
- **Bug reports**: Open a GitHub Issue
- **Skills framework questions**: See [vercel-labs/skills](https://github.com/vercel-labs/skills)
- **Direct contact**: For pilot phase partners, contact your eBay technical representative

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.

## Recognition

Contributors will be recognized in our release notes and documentation. Thank you for helping make eBay API migrations easier for developers!
