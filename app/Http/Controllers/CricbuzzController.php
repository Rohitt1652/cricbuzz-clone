<?php

namespace App\Http\Controllers;

use App\Models\CricbuzzMatch;
use App\Models\CricbuzzScorecard;
use App\Models\CricbuzzPlayer;
use App\Models\CricbuzzSeries;
use App\Services\CricbuzzApiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CricbuzzController extends Controller
{
    protected CricbuzzApiService $cricbuzzService;

    public function __construct(CricbuzzApiService $cricbuzzService)
    {
        $this->cricbuzzService = $cricbuzzService;
    }

    /**
     * Display the Cricbuzz Dashboard / Scorecard app.
     */
    public function index()
    {
        return view('cricbuzz');
    }

    /**
     * One-Click Sync endpoint: Syncs live data from RapidAPI to database.
     */
    public function syncUpcoming(Request $request): JsonResponse
    {
        $result = $this->cricbuzzService->syncUpcomingMatches();
        return response()->json($result);
    }

    /**
     * Sync scorecard for a specific match.
     */
    public function syncScorecard(int $matchId): JsonResponse
    {
        $scorecardData = $this->cricbuzzService->fetchScorecardFromApi($matchId);
        if (empty($scorecardData)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Could not fetch scorecard for match ' . $matchId
            ], 404);
        }

        $record = $this->cricbuzzService->syncScorecardData($matchId, $scorecardData);

        return response()->json([
            'status' => 'success',
            'message' => 'Scorecard synced successfully',
            'data' => $record
        ]);
    }

    /**
     * Endpoint to sync scorecards for all completed matches.
     */
    public function syncCompletedScorecards(Request $request): JsonResponse
    {
        $limit = (int) $request->input('limit', 10);
        $result = $this->cricbuzzService->syncCompletedScorecards($limit);
        return response()->json($result);
    }

    /**
     * API: Get completed matches and their scorecard status from database.
     */
    public function getCompletedMatches(): JsonResponse
    {
        $matches = CricbuzzMatch::where(function ($q) {
                $q->whereIn('state', ['Complete', 'Finished', 'Result'])
                  ->orWhere('status', 'LIKE', '%won%')
                  ->orWhere('status', 'LIKE', '%drawn%')
                  ->orWhere('status', 'LIKE', '%tied%');
            })
            ->with('scorecard')
            ->orderBy('start_date', 'desc')
            ->get();

        return response()->json([
            'status' => 'success',
            'count' => $matches->count(),
            'matches' => $matches
        ]);
    }

    /**
     * API: Get upcoming matches stored in database (or auto-sync if database is empty).
     */
    public function getUpcoming(): JsonResponse
    {
        $nowMs = (int) round(microtime(true) * 1000);

        $fetchUpcomingQuery = function () use ($nowMs) {
            return CricbuzzMatch::where(function ($q) {
                    $q->whereIn('state', ['Preview', 'Upcoming', 'Scheduled'])
                      ->orWhereNull('state');
                })
                ->whereNotIn('state', ['Complete', 'Finished', 'Result', 'In Progress', 'Live', 'Lunch', 'Tea', 'Stumps', 'Innings Break', 'Delayed', 'Rain', 'Drinks'])
                ->where(function ($q) {
                    $q->where('status', 'NOT LIKE', '%won%')
                      ->where('status', 'NOT LIKE', '%drawn%')
                      ->where('status', 'NOT LIKE', '%tied%')
                      ->where('status', 'NOT LIKE', '%abandon%')
                      ->where('status', 'NOT LIKE', '%no result%')
                      ->orWhereNull('status');
                })
                ->where(function ($q) use ($nowMs) {
                    // Match must be scheduled within the last 4 hours (today) or in the future
                    $q->where('start_date', '>=', $nowMs - (4 * 3600 * 1000))
                      ->orWhereNull('start_date');
                })
                ->orderBy('start_date', 'asc');
        };

        $matches = $fetchUpcomingQuery()->get();

        if ($matches->isEmpty()) {
            // Auto-sync on first request if empty
            $this->cricbuzzService->syncUpcomingMatches();
            $matches = $fetchUpcomingQuery()->get();
        }

        // Group by match_type to match Cricbuzz JSON structure
        $grouped = $matches->groupBy('match_type');
        $typeMatches = [];

        foreach ($grouped as $matchType => $items) {
            $seriesGrouped = $items->groupBy('series_name');
            $seriesMatches = [];

            foreach ($seriesGrouped as $seriesName => $seriesList) {
                $seriesMatches[] = [
                    'seriesAdWrapper' => [
                        'seriesId' => $seriesList->first()->series_id,
                        'seriesName' => $seriesName,
                        'matches' => $seriesList->map(function ($m) {
                            return [
                                'matchInfo' => [
                                    'matchId' => $m->match_id,
                                    'seriesId' => $m->series_id,
                                    'seriesName' => $m->series_name,
                                    'matchDesc' => $m->match_desc,
                                    'matchFormat' => $m->match_format,
                                    'startDate' => (string) $m->start_date,
                                    'endDate' => (string) $m->end_date,
                                    'state' => $m->state,
                                    'status' => $m->status,
                                    'team1' => [
                                        'teamId' => $m->team1_id,
                                        'teamName' => $m->team1_name,
                                        'teamSName' => $m->team1_sname,
                                        'imageId' => $m->team1_image_id,
                                    ],
                                    'team2' => [
                                        'teamId' => $m->team2_id,
                                        'teamName' => $m->team2_name,
                                        'teamSName' => $m->team2_sname,
                                        'imageId' => $m->team2_image_id,
                                    ],
                                    'venueInfo' => [
                                        'id' => $m->venue_id,
                                        'ground' => $m->venue_ground,
                                        'city' => $m->venue_city,
                                        'timezone' => $m->venue_timezone,
                                    ],
                                    'hideScoreStatus' => $m->status,
                                ]
                            ];
                        })->values()
                    ]
                ];
            }

            $typeMatches[] = [
                'matchType' => $matchType,
                'seriesMatches' => $seriesMatches
            ];
        }

        return response()->json([
            'typeMatches' => $typeMatches,
            'filters' => [
                'matchType' => array_keys($grouped->toArray())
            ],
            'totalMatches' => $matches->count(),
            'source' => 'Database (Synced via RapidAPI)'
        ]);
    }

    /**
     * API: Get scorecard JSON for a match.
     */
    public function getScorecard(?int $matchId = null): JsonResponse
    {
        $matchId = $matchId ?? 40381;
        $scorecard = CricbuzzScorecard::where('match_id', $matchId)->first();

        if (!$scorecard) {
            // Auto fetch and sync
            $data = $this->cricbuzzService->fetchScorecardFromApi($matchId);
            if (!empty($data)) {
                $scorecard = $this->cricbuzzService->syncScorecardData($matchId, $data);
            }
        }

        if ($scorecard) {
            return response()->json($scorecard->scorecard_data);
        }

        return response()->json(['error' => 'Scorecard not found'], 404);
    }

    /**
     * API: Get all synced players & stats.
     */
    public function getPlayers(): JsonResponse
    {
        $players = CricbuzzPlayer::orderBy('name')->get();
        return response()->json($players);
    }

    /**
     * API: One-Click Sync endpoint for upcoming tournaments & series.
     */
    public function syncSeries(Request $request): JsonResponse
    {
        $result = $this->cricbuzzService->syncUpcomingSeries();
        return response()->json($result);
    }

    /**
     * API: Get upcoming tournaments & series stored in database (auto-sync if empty).
     */
    public function getSeries(Request $request): JsonResponse
    {
        $category = $request->query('category');
        $search = $request->query('search');

        $count = CricbuzzSeries::count();
        if ($count === 0) {
            // Auto-sync if database is empty
            $this->cricbuzzService->syncUpcomingSeries();
        }

        $allSeries = CricbuzzSeries::orderBy('start_date', 'asc')->get();

        // Refresh match counts for series based on current cricbuzz_matches
        $matchCounts = CricbuzzMatch::selectRaw('series_id, COUNT(*) as count')
            ->whereNotNull('series_id')
            ->groupBy('series_id')
            ->pluck('count', 'series_id');

        foreach ($allSeries as $s) {
            $currentCount = $matchCounts[$s->series_id] ?? 0;
            if ($s->match_count !== $currentCount) {
                $s->match_count = $currentCount;
                $s->save();
            }
        }

        $filtered = $allSeries;
        if (!empty($category) && strtolower($category) !== 'all') {
            $filtered = $filtered->filter(function ($item) use ($category) {
                return strtolower($item->category) === strtolower($category);
            })->values();
        }

        if (!empty($search)) {
            $sLower = strtolower(trim($search));
            $filtered = $filtered->filter(function ($item) use ($sLower) {
                return str_contains(strtolower($item->name), $sLower) ||
                       str_contains(strtolower($item->category), $sLower) ||
                       str_contains(strtolower($item->month_group ?? ''), $sLower);
            })->values();
        }

        // Categorized grouping
        $groupedByCategory = $allSeries->groupBy('category');
        $groupedByMonth = $allSeries->groupBy('month_group');

        $stats = [
            'total' => $allSeries->count(),
            'international' => $allSeries->where('category', 'International')->count(),
            'league' => $allSeries->where('category', 'League')->count(),
            'domestic' => $allSeries->where('category', 'Domestic')->count(),
            'women' => $allSeries->where('category', 'Women')->count(),
            'with_matches' => $allSeries->where('match_count', '>', 0)->count(),
        ];

        return response()->json([
            'status' => 'success',
            'stats' => $stats,
            'count' => $filtered->count(),
            'series' => $filtered,
            'categories' => array_keys($groupedByCategory->toArray()),
            'months' => array_keys($groupedByMonth->toArray()),
            'source' => 'Database (Synced via RapidAPI)'
        ]);
    }

    /**
     * API: Get match fixtures for a specific series/tournament (Database-first).
     */
    public function getSeriesMatches(Request $request, int $seriesId): JsonResponse
    {
        $series = CricbuzzSeries::where('series_id', $seriesId)->first();

        // 1. Database-first: check matches already in local MySQL database
        $matches = CricbuzzMatch::where('series_id', $seriesId)
            ->with('scorecard')
            ->orderBy('start_date', 'asc')
            ->get();

        $source = 'Database';
        $apiData = null;

        // 2. Only hit external RapidAPI if:
        //    a) Database currently has 0 matches for this tournament, OR
        //    b) The client explicitly passes ?refresh=1
        if (($matches->isEmpty() || $request->boolean('refresh')) && !empty(config('services.cricbuzz.key', env('CRICBUZZ_API_KEY')))) {
            $apiData = $this->cricbuzzService->fetchSeriesMatchesFromApi($seriesId);
            $matches = CricbuzzMatch::where('series_id', $seriesId)
                ->with('scorecard')
                ->orderBy('start_date', 'asc')
                ->get();
            $source = 'RapidAPI (Synced to Database)';
        }

        return response()->json([
            'status' => 'success',
            'series' => $series,
            'matches_count' => $matches->count(),
            'matches' => $matches,
            'source' => $source,
            'api_details' => $apiData
        ]);
    }
}
