# ChillTrack - Transport Tracking Application

## Overview

ChillTrack is a comprehensive consignment tracking application designed for an Australian transport company, specifically built to manage temperature-controlled freight deliveries. The application provides real-time tracking capabilities, analytics insights, and data import functionality to monitor shipments across different temperature zones including Dry, Chiller (0–4°C), Freezer (-20°C), Wine (14°C), Confectionery (15–20°C), and Pharma (2–8°C).

The system serves as a customer-facing portal where users can authenticate and view their specific consignments, with comprehensive administrative tools for data management and analytics. The application integrates with the Axylog API to synchronize real-time delivery data and provides a modern, responsive interface for tracking shipments across Australia.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript for type safety and modern development
- **Styling**: TailwindCSS with custom CSS variables for consistent theming
- **UI Components**: Radix UI components with shadcn/ui for accessibility and consistency
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Form Management**: React Hook Form with Zod validation for robust form handling

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Database ORM**: Drizzle ORM with PostgreSQL for type-safe database operations
- **Authentication**: JWT-based authentication with bcrypt for password hashing
- **API Structure**: RESTful API design with role-based access control
- **File Processing**: XLSX library for Excel file parsing and CSV processing capabilities
- **Data Storage**: PostgreSQL database with connection pooling via Neon serverless

### Database Schema Design
- **Users Table**: Supports role-based access (admin, manager, supervisor, driver, viewer) with department-based filtering
- **Consignments Table**: Comprehensive tracking data with events stored as JSON for flexibility
- **Dashboards Table**: Custom dashboard configurations stored as JSON layouts
- **Data Sync Logs**: Tracking of external API synchronization history

### Authentication & Authorization
- **JWT Token System**: Secure token-based authentication with automatic expiration
- **Role-Based Permissions**: Granular permission system controlling access to features based on user roles
- **Department Filtering**: Users can be restricted to view only their department's consignments
- **Demo Credentials**: Built-in demo account (demo@chill.com.au/demo123) for testing

### Data Import & Synchronization
- **Excel/CSV Import**: Support for both file formats with intelligent column mapping
- **Axylog API Integration**: Real-time synchronization with external logistics API
- **Field Mapping System**: Flexible mapping between import files and database schema
- **Batch Processing**: Efficient handling of large data imports with progress tracking

### Analytics & Reporting
- **Real-time Dashboards**: Live data visualization with charts and metrics
- **Custom Dashboard Builder**: Users can create personalized dashboard layouts
- **Temperature Zone Analytics**: Specialized reporting for temperature-controlled freight
- **Geographic Analysis**: Location-based delivery insights and performance metrics
- **Export Functionality**: Data export in CSV and Excel formats

## External Dependencies

### Core Infrastructure
- **Neon Database**: Serverless PostgreSQL hosting with WebSocket support for real-time connections
- **Vite**: Modern build tool for fast development and optimized production builds
- **TypeScript**: Type safety across the entire application stack

### Third-Party APIs
- **Axylog API**: Primary integration for real-time consignment data synchronization
  - Authentication endpoint: `https://api.axylog.com/authentication/service`
  - Deliveries endpoint: `https://api.axylog.com/Deliveries?v=2`
  - Supports filtering by date ranges, trip numbers, and delivery states

### UI & Visualization Libraries
- **Radix UI**: Accessible, unstyled UI components for consistent user experience
- **TailwindCSS**: Utility-first CSS framework for rapid styling
- **Lucide Icons**: Comprehensive icon library for consistent visual elements
- **shadcn/ui**: Pre-built component library built on Radix UI

### File Processing & Data Handling
- **XLSX Library**: Excel file reading and writing capabilities
- **React Hook Form**: Form state management with validation
- **Zod**: Runtime type validation and schema definition
- **date-fns**: Date manipulation and formatting utilities

### Development & Build Tools
- **ESBuild**: Fast JavaScript bundler for server-side code
- **Drizzle Kit**: Database migration and schema management
- **TanStack Query**: Server state management with caching and synchronization
- **Wouter**: Lightweight routing library for React applications

### Authentication & Security
- **jsonwebtoken**: JWT token generation and verification
- **bcryptjs**: Password hashing and verification
- **connect-pg-simple**: PostgreSQL session store for Express

The application is designed for scalability and maintainability, with clear separation of concerns between the frontend interface, backend API, and data persistence layers. The modular architecture allows for easy extension of features and integration with additional external services.