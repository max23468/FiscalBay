# eBay Public API Migration Skills

AI-powered migration guidance for transitioning from eBay's traditional APIs to modern REST and GraphQL APIs.

## Why This Matters

As we evolve our platform, transitioning to modernized APIs (GraphQL and REST) is a key step toward improved performance, flexibility, and developer experience. These new Agent Skills are built to simplify that transition—helping teams quickly understand, adopt, and work with the new APIs while reducing friction during migration.

## How This Solution Helps

These **AI Skills** work with your coding assistant (Claude Code, Cursor, GitHub Copilot) to provide instant migration guidance:

- **Automated API mapping** - Ask "How do I migrate GetItem?" and get the exact modern replacement
- **Code examples with migration notes** - See side-by-side request/response examples comparing traditional SOAP vs. modern REST/GraphQL formats, along with important migration notes to accelerate adoption
- **Domain expertise** - Covers all migration paths: listings, orders, accounts, OAuth, metadata, and more
- **Best practices** - Learn migration patterns, OAuth setup, and common pitfalls

**Think of it as having an eBay API migration expert embedded in your development environment.**

## Available Skills

Each skill covers a specific API domain. Install all skills (default) or select specific ones based on your integration needs.

| Skill | Description |
|-------|-------------|
| `account-management` | User profiles, seller accounts, eBay Stores configuration, tax tables, billing preferences, and shipping discount rules |
| `authorization` | Authentication and authorization flows - token generation, refresh, and revocation (Auth'n'Auth to OAuth 2.0) |
| `communication` | Buyer-seller messaging and feedback operations |
| `listing-management` | Listing lifecycle (create, revise, relist, end, search), image uploads, and inventory management |
| `listing-metadata` | Category discovery, item specifics, product catalogs, marketplace features, and listing constraints |
| `notification` | Platform notifications, seller alerts, and event subscriptions |
| `offers-and-leads` | Best Offer negotiations (accept, counter, decline) and Classified Ad lead retrieval |
| `order-management` | Order retrieval, shipping fulfillment, tracking upload, returns, cancellations, refunds, and case management |
| `other-apis` | VeRO (intellectual property) reporting and reason code lookups |

## Quick Start Guide

### What You'll Need

1. **An AI coding assistant** supporting the skills framework:
   - [Claude Code](https://claude.ai/code) - Recommended for best results
   - [Cursor](https://cursor.sh/)
   - [GitHub Copilot](https://github.com/features/copilot)
   - Any agent supporting the [skills framework](https://github.com/vercel-labs/skills)

2. **Node.js 14 or higher** (for the `npx skills` command)
   ```bash
   node --version  # Check your version
   ```

### Installation Steps

#### Option 1: From Tarball (Pilot Partners - Until Public Release)
If eBay provided you with a `.tgz` package file:

```bash
# 1. Extract the package
tar -xzf public-api-migration-skills-1.0.0.tgz

# 2. Install the skills
npx skills add ./public-api-migration-skills

# 3. Restart your AI assistant to load the skills
```

#### Option 2: From GitHub Repository (After GA)
Once publicly available:

```bash
npx skills add github:ebay/public-api-migration-skills
```

### Installing Specific Skills (Optional)

By default, all skills are installed. To install only specific ones:

```bash
# Install single skill
npx skills add github:ebay/public-api-migration-skills --skill listing-management

# Install multiple skills
npx skills add github:ebay/public-api-migration-skills --skill listing-management --skill order-management
```

### Managing Your Installation

```bash
# Verify installation
npx skills list

# Update to latest version
npx skills update

# Remove skills
npx skills remove ebay/public-api-migration-skills
```

📖 **Framework Documentation**: For detailed CLI usage, see the [vercel-labs/skills documentation](https://github.com/vercel-labs/skills).

## Sample Prompts

Once installed, ask your AI assistant questions like these to get migration guidance:

- "How do I migrate the GetUser API to modern eBay APIs?"
- "I still use FetchToken after eBay consent. What's the OAuth replacement?"
- "I have existing integration with RelistFixedPriceItem. How do I migrate to the new APIs?"
- "What's the migration path for GeteBayDetails?"
- "How do I migrate CompleteSale to modern fulfillment APIs?"

## Troubleshooting

**Skills not working after installation?**
1. Restart your AI assistant completely (not just reload window)
2. Verify installation: `npx skills list`
3. Check Node.js version: `node --version` (must be 14+)

**AI assistant not recognizing migration questions?**
- Be specific: Mention the traditional API name (e.g., "GetItem", "AddFixedPriceItem")
- Include context: "I'm migrating from Trading API to..."
- Ask directly: "Show me the migration path for..."

## Security & Privacy

> **⚠️ Important**: These skills provide **migration guidance only**. They do not execute API calls, access your systems, or handle live data.

**Best Practices:**
- ✅ Use placeholder values for tokens, credentials, and IDs
- ❌ Never paste real API keys, OAuth tokens, or customer data
- ✅ Skills run locally in your AI assistant - no data is sent to eBay

For more guidance, see eBay's [Developer Guidelines](https://developer.ebay.com/api-docs/static/developer-guide.html).

## Support

**During Pilot (Before GA):**
- 📧 Contact your eBay partner manager for issues, feedback, or questions
- 📖 [eBay Developer Documentation](https://developer.ebay.com/docs)

**After Public Release:**
- 🐛 [Report Issues or Request Features on GitHub](https://github.com/ebay/public-api-migration-skills/issues)
- 📖 [eBay Developer Documentation](https://developer.ebay.com/docs)

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

Apache License 2.0 - see [LICENSE.md](LICENSE.md) for details.

Copyright (c) 2026 eBay Inc.
