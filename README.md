# [PROJECT_NAME]

This directory contains the actual project code that will be developed using the multi-agent framework.

## Project Structure

```
project/
├── README.md              # This file - project overview
├── src/                   # Source code
│   ├── components/        # Reusable components
│   ├── services/          # Business logic and API services
│   ├── utils/             # Utility functions
│   └── types/             # Type definitions
├── tests/                 # Test files
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── e2e/               # End-to-end tests
├── docs/                  # Project documentation
│   ├── api/               # API documentation
│   ├── user/              # User guides
│   └── technical/         # Technical documentation
└── config/                # Configuration files
    ├── development/       # Development environment configs
    ├── staging/           # Staging environment configs
    └── production/        # Production environment configs
```

## Getting Started

### Prerequisites
- [List required tools and versions]
- [Dependencies and system requirements]

### Installation
1. **Initialize git repository** (IMPORTANT - only in this project/ directory):
   ```bash
   git init
   git add .
   git commit -m "Initial project setup"
   ```
2. Install dependencies: `[package manager install command]`
3. Configure environment: `[environment setup]`
4. Run development server: `[start command]`

### Development Workflow

This project uses the multi-persona development framework located in the parent directory. The framework provides:

- **Persona-based development**: Specialized team personas for different aspects of development
- **Git isolation**: This project's git repository is separate from the framework template
- **Quality assurance**: Built-in quality gates and review processes
- **Documentation sync**: Automatic synchronization between code and documentation

**Important**: All git operations should be performed from this project/ directory, not the framework root.

### Available Commands

Use these commands from the parent directory to work with this project:

- `/project:assign [role] [task]` - Assign work to team roles
- `/project:status` - Check project progress
- `/project:code [feature]` - Generate code for features
- `/project:review [artifact]` - Request code/design review
- `/project:help` - See all available commands

## Project Information

- **Project Name**: [PROJECT_NAME]
- **Version**: [VERSION]
- **Technology Stack**: [TECHNOLOGIES]
- **Team**: [TEAM_MEMBERS]
- **Status**: [DEVELOPMENT_STATUS]

## Contributing

1. Work should be assigned through the multi-agent framework
2. Follow the established coding standards in `../specs/constraints.md`
3. All code must be reviewed before merging
4. Tests are required for new functionality
5. Documentation must be updated with code changes

## Documentation

- **Technical Specs**: `../specs/` directory
- **API Documentation**: `docs/api/` directory
- **User Guides**: `docs/user/` directory
- **Architecture**: `../specs/architecture.md`

## Support

- **Issue Tracking**: [ISSUE_TRACKER_URL]
- **Team Contact**: [CONTACT_INFO]
- **Documentation**: [DOCS_URL]

---

*This project is developed using the multi-agent development framework for coordinated, high-quality software development.*