<?php

use App\Http\Controllers\CricbuzzController;
use Illuminate\Support\Facades\Route;

Route::get('/', [CricbuzzController::class, 'index']);

// Sync Endpoints
Route::match(['get', 'post'], '/api/cricbuzz/sync-upcoming', [CricbuzzController::class, 'syncUpcoming']);
Route::match(['get', 'post'], '/api/cricbuzz/sync-series', [CricbuzzController::class, 'syncSeries']);
Route::match(['get', 'post'], '/api/cricbuzz/sync-scorecards', [CricbuzzController::class, 'syncCompletedScorecards']);
Route::match(['get', 'post'], '/api/cricbuzz/sync-scorecard/{matchId}', [CricbuzzController::class, 'syncScorecard']);

// Dynamic Data API Endpoints
Route::get('/api/cricbuzz/upcoming', [CricbuzzController::class, 'getUpcoming']);
Route::get('/api/cricbuzz/series', [CricbuzzController::class, 'getSeries']);
Route::get('/api/cricbuzz/series/{seriesId}/matches', [CricbuzzController::class, 'getSeriesMatches']);
Route::get('/api/cricbuzz/completed', [CricbuzzController::class, 'getCompletedMatches']);
Route::get('/api/cricbuzz/scorecard/{matchId?}', [CricbuzzController::class, 'getScorecard']);
Route::get('/api/cricbuzz/players', [CricbuzzController::class, 'getPlayers']);

