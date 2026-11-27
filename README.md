# Branch Master

A full-stack Branch Management System built using React, TypeScript, Spring Boot Microservices, Spring Cloud, and MySQL.

Branch Master provides a centralized platform to manage organizational branches, maintain branch records, monitor operational activity, and visualize branch-related analytics.

## Live Application

**Frontend:** https://branch-frontend-k43l.onrender.com/

**Backend API Gateway:** https://api-gateway-y4zq.onrender.com/

**GitHub Repository:** https://github.com/Keshav3929/branch-microservices

## Features

- JWT-based authentication and role-based access.
- Branch creation, updating, searching, filtering, and deletion.
- Organization, region, country, state, city, and branch-type dropdown management.
- Server-side pagination, sorting, and filtering.
- Branch history and audit information.
- Excel template generation and Excel file validation.
- Bulk branch import with row-level validation.
- Dashboard with branch analytics and graphical visualizations.
- Branch counts and creation trends.
- Notification management.
- Email notifications for supported branch operations.
- Centralized exception handling and validation.
-  User registration and account creation.
- JWT-based authentication and role-based access.

## Technology Stack

### Frontend
- React
- TypeScript
- Vite
- Material UI
- Redux Toolkit
- Axios
- Material React Table
- React Hook Form
- Yup
- AmCharts, Recharts, and ApexCharts

### Backend
- Java 21
- Spring Boot
- Spring Cloud
- Spring Cloud Gateway
- Spring Cloud Config
- Netflix Eureka
- Spring Security
- JWT
- Spring Data JPA
- Hibernate
- Gradle

### Database and Supporting Technologies
- MySQL / TiDB Cloud
- Redis / Valkey
- Apache POI for Excel processing

### Deployment and Version Control
- Render
- GitHub

## Architecture

The application follows a microservices architecture. The React frontend communicates with backend services through the API Gateway.


                    React Frontend
                          |
                          |
                     API Gateway
                          |
          +---------------+---------------+
          |               |               |
     User Service    Branch Service   Master Service
          |               |               |
          |               |               |
     OAuth Service   Common Service     MySQL
          
          Eureka Server
          Config Server


### Backend Services

| Service | Responsibility |
|---|---|
| API Gateway | Central entry point and request routing |
| Eureka Server | Service registration and discovery |
| Config Server | Centralized application configuration |
| User Service | User management and authentication-related APIs |
| OAuth Service | JWT/token-related functionality |
| Branch Service | Branch management, analytics, history, and notifications |
| Master Service | Organization and location dropdown data |
| Common Service | Shared Excel template and validation APIs |

## Accessing the Application

1. Open the [Branch Master Live Application](https://branch-frontend-k43l.onrender.com/).
2. **New users:** Register using the registration page and create an account.
3. **Existing users:** Log in using your registered credentials.
4. After successful authentication, explore the available features according to your assigned role:
   - Branch management
   - Dashboard analytics
   - Excel template generation and bulk import
   - Branch history and audit information
   - Notifications

The frontend communicates with the deployed backend through the API Gateway.

**Note:** The application is hosted on Render. If a service has been idle, its first request may take some time while the service starts.

## Deployment

The application frontend and API Gateway are deployed on Render.

| Component | Deployment URL |
|---|---|
| Frontend | https://branch-frontend-k43l.onrender.com/ |
| API Gateway | https://api-gateway-y4zq.onrender.com/ |

Backend microservices use centralized configuration and service discovery as part of the application architecture.

Production credentials and environment-specific configuration are maintained outside the source code.

## Security

- JWT-based authentication.
- Role-based authorization.
- Protected backend endpoints.
- Externalized environment-specific secrets.
- Centralized API Gateway routing.

Production credentials, API keys, and tokens are not included in the public repository.

## Future Enhancements

- Expanded automated unit and integration test coverage.
- Improved monitoring and observability.
- Further optimization of analytics and reporting.
- Additional automated deployment checks.

## Author

**Keshav Kumar**

B.Tech – Computer Science and Engineering

GitHub: https://github.com/Keshav3929

## License

This project is intended for educational and demonstration purposes unless a separate license is provided.
