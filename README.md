# 🏏 Cricbuzz Clone — Live Cricket Scores, Analytics & Schedule

<p align="center">
  <img src="https://img.shields.io/badge/Laravel-12.x-FF2D20?style=for-the-badge&logo=laravel&logoColor=white" alt="Laravel 12">
  <img src="https://img.shields.io/badge/PHP-8.2+-777BB4?style=for-the-badge&logo=php&logoColor=white" alt="PHP 8.2">
  <img src="https://img.shields.io/badge/MySQL-8.0+-4479A1?style=for-the-badge&logo=mysql&logoColor=white" alt="MySQL">
  <img src="https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/RapidAPI-Cricbuzz-0055FF?style=for-the-badge&logo=rapidapi&logoColor=white" alt="RapidAPI">
  <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License MIT">
</p>

A feature-rich, modern cricket web application built with **Laravel 12**, **MySQL**, and **Vanilla JavaScript**. It provides live match scorecards, dynamic charts & analytics, upcoming fixtures with countdown timers, tournament schedules, and completed match archives — all synced dynamically from the **Cricbuzz RapidAPI**.

---

## ✨ Key Features

- 🏏 **Live Match Scorecards:**
  - Full innings breakdown (batting, bowling, fall of wickets, extras).
  - Detailed batsman stats: runs, balls, 4s, 6s, and strike rate.
  - Detailed bowler stats: overs, maidens, runs conceded, wickets, and economy rate.
  - Interactive player profiles and scorecard switcher.

- 📊 **Match Analytics & Visual Charts:**
  - Interactive run comparison chart between competing teams (Chart.js).
  - Boundary distribution analysis (4s vs 6s vs Dot Balls).
  - Real-time run rate tracker and phase-wise match momentum.

- 📅 **Upcoming Fixtures & Schedule:**
  - Filter by category: **All**, **International**, **League**, **Domestic**, and **Women**.
  - Filter by format: **TEST**, **ODI**, and **T20**.
  - Live countdown indicator (`Starts in X days` or `Starts in X hrs`).
  - Search matches by team name, venue, or tournament name.
  - Automatic filtering to ensure only genuine, future fixtures are shown.

- 🏆 **Tournaments & Series Hub:**
  - Browse featured series categorized by International, League, Domestic, and Women's tournaments.
  - Grouped chronologically by month.
  - Interactive **Tournament Match Schedule modal** showing full fixture lists for any selected series.

- 🏁 **Completed Matches Archive:**
  - Comprehensive listing of recently finished games with match results (won by runs/wickets, drawn, tied).
  - One-click navigation directly to the detailed scorecard.

- 🔄 **One-Click RapidAPI Sync:**
  - Background database synchronization for matches, scorecards, series, and player stats directly into MySQL.
  - Intelligent caching and database-first architecture to minimize API quota consumption.

- 🌗 **Dark & Light Mode:**
  - Sleek glassmorphism dark theme with vibrant accents and contrast.
  - Quick toggle to light theme with preferences saved to `localStorage`.

- 📱 **Fully Responsive Design:**
  - Custom Vanilla CSS grid and flexbox layout optimized for mobile screens, tablets, and wide monitors.

---

## 🛠️ Tech Stack

- **Backend:** Laravel 12, PHP 8.2+
- **Database:** MySQL (Eloquent ORM, Schema Migrations)
- **Frontend:** Vanilla JavaScript (ES6+), Vanilla CSS (Custom tokens & glassmorphism), Chart.js, FontAwesome 6
- **Data Source:** RapidAPI Cricbuzz Cricket API (`cricbuzz-cricket.p.rapidapi.com`)

---

## 🚀 Getting Started

Follow these instructions to set up the project locally on your machine.

### Prerequisites

Ensure you have the following installed:
- [PHP >= 8.2](https://www.php.net/)
- [Composer](https://getcomposer.org/)
- [MySQL](https://www.mysql.com/) or [XAMPP](https://www.apachefriends.org/)
- [Git](https://git-scm.com/)

---

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Rohitt1652/cricbuzz-clone.git
   cd cricbuzz-clone
   ```

2. **Install PHP dependencies:**
   ```bash
   composer install
   ```

3. **Set up Environment Variables:**
   ```bash
   copy .env.example .env
   ```

4. **Configure your Database & RapidAPI in `.env`:**
   Open `.env` and set your MySQL and Cricbuzz RapidAPI credentials:
   ```env
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=cricbuzz_apis
   DB_USERNAME=root
   DB_PASSWORD=

   CRICBUZZ_API_KEY=your_rapidapi_cricbuzz_key_here
   CRICBUZZ_API_HOST=cricbuzz-cricket.p.rapidapi.com
   ```

5. **Generate Application Key:**
   ```bash
   php artisan key:generate
   ```

6. **Run Database Migrations:**
   ```bash
   php artisan migrate
   ```

7. **Start the Development Server:**
   ```bash
   php artisan serve --port=1000
   ```

8. **Open in Browser:**
   Visit: [http://127.0.0.1:1000](http://127.0.0.1:1000)

---

## 📡 API Endpoints

The project exposes clean RESTful endpoints:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Main Cricbuzz dashboard & web interface |
| `GET` | `/api/cricbuzz/upcoming` | Get all upcoming matches grouped by type & series |
| `GET` | `/api/cricbuzz/completed` | Get all completed matches with results and winners |
| `GET` | `/api/cricbuzz/series` | Get all upcoming tournaments & series with category filters |
| `GET` | `/api/cricbuzz/series/{seriesId}/matches` | Get match fixtures for a specific tournament |
| `GET` | `/api/cricbuzz/scorecard/{matchId?}` | Get detailed scorecard JSON for a match |
| `GET` | `/api/cricbuzz/players` | Get synced players database & statistics |
| `POST/GET` | `/api/cricbuzz/sync-upcoming` | Trigger one-click sync for live and upcoming matches |
| `POST/GET` | `/api/cricbuzz/sync-series` | Trigger one-click sync for upcoming tournaments/series |
| `POST/GET` | `/api/cricbuzz/sync-scorecards` | Batch sync scorecards for recent completed matches |

---

## 🗄️ Database Architecture

The application uses 4 core Eloquent models:
- **`CricbuzzMatch`**: Stores match details, formats, team names, venue coordinates, status, and start timestamps.
- **`CricbuzzSeries`**: Stores tournaments, series categories (International, League, Domestic, Women), and month groupings.
- **`CricbuzzScorecard`**: Stores complete JSON scorecards, innings statistics, and match result statuses.
- **`CricbuzzPlayer`**: Stores player names, teams, roles (Batsman/Bowler), and career/match performances.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check the [issues page](https://github.com/Rohitt1652/cricbuzz-clone/issues).

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Developed by <a href="https://github.com/Rohitt1652">Rohit</a> with ❤️
</p>
