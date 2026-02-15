# Frontend Documentation Overview

## Project Structure

This document provides a comprehensive overview of the frontend application built with React, TypeScript, Vite, and Tailwind CSS.

**Frontend Root Directory:** `src/`

## Quick Navigation

- [Frontend Structure](FRONTEND_STRUCTURE.md) - Directory layout and file organization
- [Components Guide](FRONTEND_COMPONENTS.md) - Component inventory and documentation
- [Pages Reference](FRONTEND_PAGES.md) - Page-level components and routing
- [Architecture & Context](FRONTEND_ARCHITECTURE.md) - State management and patterns
- [Styling & Configuration](FRONTEND_STYLING.md) - Tailwind CSS and UI setup
- [Frontend Setup Guide](FRONTEND_SETUP.md) - Installation and running instructions

## Key Technologies

- **React** - UI framework
- **TypeScript** - Type-safe development
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing (implied from page structure)

## Folder Overview

```
src/
├── components/        # Reusable UI components
├── pages/            # Page-level components
├── context/          # React Context API providers
├── data/             # Mock data and fixtures
├── types/            # TypeScript type definitions
├── utils/            # Utility functions
├── App.tsx           # Root component
├── main.tsx          # Entry point
├── index.css         # Global styles
└── vite-env.d.ts     # Vite environment types
```

## Configuration Files

- `vite.config.ts` - Vite build configuration
- `tsconfig.json` - TypeScript compiler options
- `tailwind.config.js` - Tailwind CSS theme configuration
- `postcss.config.js` - PostCSS plugins configuration
- `package.json` - Dependencies and npm scripts

## Getting Started

Refer to [FRONTEND_SETUP.md](FRONTEND_SETUP.md) for installation and development instructions.
