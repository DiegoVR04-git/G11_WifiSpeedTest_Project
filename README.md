# 📡 WiFi Speed Test Web App

![WiFi Speed Test](https://img.shields.io/badge/WiFi-Speed%20Test-blue?style=for-the-badge)  
![Python](https://img.shields.io/badge/Python-3.7+-green?style=for-the-badge&logo=python)  
![Flask](https://img.shields.io/badge/Flask-2.3+-red?style=for-the-badge&logo=flask)  
![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)

## Overview

A modern, Flask-based web application to test your WiFi and internet connection speed using the `speedtest-cli` library. It provides role-based dashboards tailored for Home Users, IT Administrators, and ISP Support, delivering download/upload speeds, ping, diagnostics, and shareable reports.

---

## Why this project?

Accurate and easy-to-use WiFi speed testing tools help users and IT professionals quickly diagnose internet performance issues. This app offers a simple yet powerful solution with role-based features to cater to different user needs.

---

## Demo

![WiFi Speed Test Demo](https://your-demo-link-or-gif-here)  
*(Add a screenshot or GIF showing the UI in action)*

---

## Features

- 🌐 **Internet Connectivity Test:** Basic ping to Google to check internet availability.  
- Role-based UI and API endpoints:  
  - Home User: Simple one-click speed tests.  
  - IT Administrator: Access to speed test history, diagnostics, export, and clear history.  
  - ISP Support: Generate shareable reports for customers.  
- Background speed testing (non-blocking operations).  
- In-memory history of the last 50 tests (can be replaced by a persistent database).  
- Diagnostics and report export features.

---

## Quick Start

### Prerequisites

- Python 3.7 or higher  
- `pip` package manager

### Installation and Running Locally

1. Clone the repository:

```bash
git clone https://github.com/yourusername/wifi-speed-test-webapp.git
cd wifi-speed-test-webapp

2. Create and activate a Python virtual environment:

python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
# macOS/Linux
source .venv/bin/activate

3. Install dependencies:

pip install -r requirements.txt

4. Run the app in development mode:

python app.py

5. Open your browser and go to: http://127.0.0.1:5000

---

```
## Usage Examples

Navigate through different user roles for tailored dashboards.

Run a speed test with a single click from the Home User interface.

IT Admins can view detailed test history and export reports.

ISP Support can generate customer shareable reports.

---

## Configuration

Currently stores history in memory (last 50 tests).

User roles are passed to background speed testing threads to avoid session issues.

In production, replace in-memory storage with a persistent database (e.g., SQLite, PostgreSQL).

---

## Testing

(Add instructions once tests are implemented)

---

## Deployment

Suitable for deployment on any Python-compatible web server.

Consider adding authentication and database persistence for production use.

Contributing

Contributions are welcome! Please:

Fork the repo and create your feature branch.

Follow PEP8 coding style.

Add tests for new features.

Open a pull request with a clear description of your changes.

Use GitHub issues for bug reports or feature requests.

## License

This project is licensed under the MIT License
.

Maintainers / Contact


GitHub Issues: https://github.com/yourusername/wifi-speed-test-webapp/issues

## Roadmap

Add persistent storage with SQLite/Postgres

Implement user authentication and authorization

Add unit and integration tests

Setup Continuous Integration (CI) pipeline

## Credits

Built with Python
 and Flask

Uses speedtest-cli
 for internet speed measurement

Made with ❤️ using Python and Flask.
