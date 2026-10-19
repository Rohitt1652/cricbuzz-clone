<?php

namespace App\Services;

use App\Models\CricbuzzMatch;
use App\Models\CricbuzzScorecard;
use App\Models\CricbuzzPlayer;
use App\Models\CricbuzzSeries;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class CricbuzzApiService
{
    protected string $apiKey;
    protected string $apiHost;
    protected string $baseUrl;

    public function __construct()
    {
        $this->apiKey = config('services.cricbuzz.key', env('CRICBUZZ_API_KEY', ''));
        $this->apiHost = config('services.cricbuzz.host', env('CRICBUZZ_API_HOST', 'cricbuzz-cricket.p.rapidapi.com'));
        $this->baseUrl = 'https://' . $this->apiHost;
    }

    /**
     * Fetch upcoming matches from RapidAPI (or local fallback).
     */
    public function fetchUpcomingMatchesFromApi(): array
    {
        try {
            $response = Http::withoutVerifying()->withHeaders([
                'x-rapidapi-key' => $this->apiKey,
                'x-rapidapi-host' => $this->apiHost,
            ])->timeout(15)->get("{$this->baseUrl}/matches/v1/upcoming");

            if ($response->successful()) {
                return $response->json() ?? [];
            }

            // Fallback endpoint if /matches/v1/upcoming returns non-200
            $altResponse = Http::withoutVerifying()->withHeaders([
                'x-rapidapi-key' => $this->apiKey,
                'x-rapidapi-host' => $this->apiHost,
            ])->timeout(15)->get("{$this->baseUrl}/matches/upcoming");

            if ($altResponse->successful()) {
                return $altResponse->json() ?? [];
            }

            Log::error('RapidAPI Cricbuzz upcoming matches returned non-200 status', [
                'status' => $response->status(),
                'body' => $response->body()
            ]);
        } catch (\Throwable $e) {
            Log::error('RapidAPI Cricbuzz fetch failed', ['error' => $e->getMessage()]);
        }

        return [];
    }

    /**
     * Fetch scorecard for a match from RapidAPI directly.
     */
    public function fetchScorecardFromApi(int $matchId): array
    {
        try {
            // Cricbuzz RapidAPI scorecard endpoint: /mcenter/v1/{id}/hscard
            $response = Http::withoutVerifying()->withHeaders([
                'x-rapidapi-key' => $this->apiKey,
                'x-rapidapi-host' => $this->apiHost,
            ])->timeout(15)->get("{$this->baseUrl}/mcenter/v1/{$matchId}/hscard");

            if ($response->successful()) {
                $data = $response->json() ?? [];
                if (!empty($data)) {
                    return $data;
                }
            }

            // Fallback endpoint: /mcenter/v1/{id}/scrcard
            $altResponse = Http::withoutVerifying()->withHeaders([
                'x-rapidapi-key' => $this->apiKey,
                'x-rapidapi-host' => $this->apiHost,
            ])->timeout(15)->get("{$this->baseUrl}/mcenter/v1/{$matchId}/scrcard");

            if ($altResponse->successful()) {
                return $altResponse->json() ?? [];
            }

            Log::error("RapidAPI Cricbuzz scorecard returned non-200 status for match {$matchId}", [
                'status' => $response->status(),
                'body' => $response->body()
            ]);
        } catch (\Throwable $e) {
            Log::error("RapidAPI Cricbuzz scorecard fetch failed for match {$matchId}", ['error' => $e->getMessage()]);
        }

        return [];
    }

    /**
     * Fetch live matches from RapidAPI.
     */
    public function fetchLiveMatchesFromApi(): array
    {
        try {
            $response = Http::withoutVerifying()->withHeaders([
                'x-rapidapi-key' => $this->apiKey,
                'x-rapidapi-host' => $this->apiHost,
            ])->timeout(15)->get("{$this->baseUrl}/matches/v1/live");

            if ($response->successful()) {
                return $response->json() ?? [];
            }
        } catch (\Throwable $e) {
            Log::error('RapidAPI Cricbuzz live matches fetch failed', ['error' => $e->getMessage()]);
        }
        return [];
    }

    /**
     * Fetch recent matches from RapidAPI.
     */
    public function fetchRecentMatchesFromApi(): array
    {
        try {
            $response = Http::withoutVerifying()->withHeaders([
                'x-rapidapi-key' => $this->apiKey,
                'x-rapidapi-host' => $this->apiHost,
            ])->timeout(15)->get("{$this->baseUrl}/matches/v1/recent");

            if ($response->successful()) {
                return $response->json() ?? [];
            }
        } catch (\Throwable $e) {
            Log::error('RapidAPI Cricbuzz recent matches fetch failed', ['error' => $e->getMessage()]);
        }
        return [];
    }

    /**
     * One-Click Sync: Fetch upcoming, live, and recent matches and save/update in database.
     */
    public function syncUpcomingMatches(): array
    {
        $syncedCount = 0;

        $upcomingPayload = $this->fetchUpcomingMatchesFromApi();
        $livePayload     = $this->fetchLiveMatchesFromApi();
        $recentPayload   = $this->fetchRecentMatchesFromApi();

        $this->processMatchPayload($upcomingPayload, $syncedCount);
        $this->processMatchPayload($livePayload, $syncedCount);
        $this->processMatchPayload($recentPayload, $syncedCount);

        // Also sync scorecards for completed matches automatically
        $scorecardsResult = $this->syncCompletedScorecards(5);

        // Also sync upcoming tournaments and series
        $seriesResult = $this->syncUpcomingSeries();

        // Also fetch upcoming match fixtures for featured upcoming tournaments so schedule is fully populated
        $featuredSeries = CricbuzzSeries::whereIn('category', ['International', 'League', 'Women', 'Domestic'])
            ->orderBy('start_date', 'asc')
            ->take(8)
            ->get();

        foreach ($featuredSeries as $fs) {
            $this->fetchSeriesMatchesFromApi($fs->series_id);
        }

        return [
            'status' => 'success',
            'synced_count' => $syncedCount,
            'synced_scorecards' => $scorecardsResult['synced_scorecards_count'] ?? 0,
            'synced_series_count' => $seriesResult['synced_series_count'] ?? 0,
            'message' => "Successfully synced {$syncedCount} matches, " . ($scorecardsResult['synced_scorecards_count'] ?? 0) . " scorecards & " . ($seriesResult['synced_series_count'] ?? 0) . " tournaments/series into MySQL database."
        ];
    }

    /**
     * Sync scorecards for completed/recent matches stored in database.
     */
    public function syncCompletedScorecards(int $limit = 10): array
    {
        $completedMatches = CricbuzzMatch::whereIn('state', ['Complete', 'Finished', 'Result'])
            ->orWhere('status', 'LIKE', '%won%')
            ->orWhere('status', 'LIKE', '%drawn%')
            ->orWhere('status', 'LIKE', '%tied%')
            ->take($limit)
            ->get();

        $syncedCount = 0;
        $failedCount = 0;

        foreach ($completedMatches as $match) {
            $scorecardData = $this->fetchScorecardFromApi($match->match_id);
            if (!empty($scorecardData)) {
                $this->syncScorecardData($match->match_id, $scorecardData);
                $syncedCount++;
            } else {
                $failedCount++;
            }
        }

        return [
            'status' => 'success',
            'synced_scorecards_count' => $syncedCount,
            'failed_count' => $failedCount,
            'message' => "Synced {$syncedCount} completed match scorecards and their player stats into MySQL."
        ];
    }

    /**
     * Process and insert/update match records from Cricbuzz payload.
     */
    protected function processMatchPayload(array $data, int &$syncedCount): void
    {
        if (empty($data['typeMatches'])) {
            return;
        }

        foreach ($data['typeMatches'] as $typeGroup) {
            $matchType = $typeGroup['matchType'] ?? 'Other';
            $seriesMatches = $typeGroup['seriesMatches'] ?? [];

            foreach ($seriesMatches as $seriesObj) {
                if (!isset($seriesObj['seriesAdWrapper']['matches'])) {
                    continue;
                }

                $seriesName = $seriesObj['seriesAdWrapper']['seriesName'] ?? '';
                $seriesId = $seriesObj['seriesAdWrapper']['seriesId'] ?? null;

                foreach ($seriesObj['seriesAdWrapper']['matches'] as $matchItem) {
                    $info = $matchItem['matchInfo'] ?? null;
                    if (!$info || empty($info['matchId'])) {
                        continue;
                    }

                    CricbuzzMatch::updateOrCreate(
                        ['match_id' => $info['matchId']],
                        [
                            'series_id' => $info['seriesId'] ?? $seriesId,
                            'series_name' => $info['seriesName'] ?? $seriesName,
                            'match_desc' => $info['matchDesc'] ?? '',
                            'match_format' => $info['matchFormat'] ?? 'T20',
                            'match_type' => $matchType,
                            'start_date' => $info['startDate'] ?? null,
                            'end_date' => $info['endDate'] ?? null,
                            'state' => $info['state'] ?? 'Preview',
                            'status' => $info['status'] ?? $info['hideScoreStatus'] ?? 'Upcoming',
                            'team1_id' => $info['team1']['teamId'] ?? null,
                            'team1_name' => $info['team1']['teamName'] ?? '',
                            'team1_sname' => $info['team1']['teamSName'] ?? '',
                            'team1_image_id' => $info['team1']['imageId'] ?? null,
                            'team2_id' => $info['team2']['teamId'] ?? null,
                            'team2_name' => $info['team2']['teamName'] ?? '',
                            'team2_sname' => $info['team2']['teamSName'] ?? '',
                            'team2_image_id' => $info['team2']['imageId'] ?? null,
                            'venue_id' => $info['venueInfo']['id'] ?? null,
                            'venue_ground' => $info['venueInfo']['ground'] ?? '',
                            'venue_city' => $info['venueInfo']['city'] ?? '',
                            'venue_timezone' => $info['venueInfo']['timezone'] ?? '',
                            'raw_json' => $info,
                        ]
                    );

                    $syncedCount++;
                }
            }
        }
    }

    /**
     * Store/sync scorecard data and player stats for a match.
     */
    public function syncScorecardData(int $matchId, array $scorecardData): CricbuzzScorecard
    {
        $status = $scorecardData['status'] ?? '';
        $isComplete = $scorecardData['ismatchcomplete'] ?? false;

        $record = CricbuzzScorecard::updateOrCreate(
            ['match_id' => $matchId],
            [
                'status' => $status,
                'is_match_complete' => $isComplete,
                'scorecard_data' => $scorecardData,
            ]
        );

        // Extract and sync players from scorecard batsmen & bowlers
        if (!empty($scorecardData['scorecard'])) {
            foreach ($scorecardData['scorecard'] as $inn) {
                $teamName = $inn['batteamname'] ?? '';
                
                // Batsmen
                foreach ($inn['batsman'] ?? [] as $b) {
                    if (!empty($b['id']) && !empty($b['name'])) {
                        CricbuzzPlayer::updateOrCreate(
                            ['player_id' => $b['id']],
                            [
                                'name' => $b['name'],
                                'team_name' => $teamName,
                                'role' => 'Batsman',
                                'stats_data' => $b,
                            ]
                        );
                    }
                }

                // Bowlers
                foreach ($inn['bowler'] ?? [] as $bw) {
                    if (!empty($bw['id']) && !empty($bw['name'])) {
                        CricbuzzPlayer::updateOrCreate(
                            ['player_id' => $bw['id']],
                            [
                                'name' => $bw['name'],
                                'team_name' => $teamName,
                                'role' => 'Bowler',
                                'stats_data' => $bw,
                            ]
                        );
                    }
                }
            }
        }

        return $record;
    }

    /**
     * Fetch series list for a specific category from RapidAPI (or local fallback).
     * Supported categories: 'international', 'league', 'domestic', 'women'.
     */
    public function fetchSeriesFromApi(string $category = 'international'): array
    {
        $cat = strtolower(trim($category));
        try {
            $response = Http::withoutVerifying()->withHeaders([
                'x-rapidapi-key' => $this->apiKey,
                'x-rapidapi-host' => $this->apiHost,
            ])->timeout(15)->get("{$this->baseUrl}/series/v1/{$cat}");

            if ($response->successful()) {
                $data = $response->json();
                if (!empty($data['seriesMapProto'])) {
                    return $data;
                }
            }
        } catch (\Throwable $e) {
            Log::warning("RapidAPI fetchSeriesFromApi failed for {$cat}: " . $e->getMessage());
        }

        // Local fallback to series.json
        $localFile = base_path('series.json');
        if (file_exists($localFile)) {
            $fallback = json_decode(file_get_contents($localFile), true);
            if (!empty($fallback[$cat])) {
                return $fallback[$cat];
            }
        }

        return [];
    }

    /**
     * Fetch all upcoming series across International, League, Domestic, and Women categories.
     */
    public function fetchAllSeriesFromApi(): array
    {
        $categories = ['international', 'league', 'domestic', 'women'];
        $results = [];

        foreach ($categories as $cat) {
            $results[$cat] = $this->fetchSeriesFromApi($cat);
        }

        return $results;
    }

    /**
     * Sync all upcoming series/tournaments into MySQL cricbuzz_series table.
     */
    public function syncUpcomingSeries(): array
    {
        $categories = ['international', 'league', 'domestic', 'women'];
        $syncedCount = 0;
        $categoryBreakdown = [];

        foreach ($categories as $cat) {
            $categoryName = ucfirst($cat);
            $payload = $this->fetchSeriesFromApi($cat);
            $catCount = 0;

            if (!empty($payload['seriesMapProto'])) {
                foreach ($payload['seriesMapProto'] as $group) {
                    $monthGroup = $group['date'] ?? null;
                    $seriesList = $group['series'] ?? [];

                    foreach ($seriesList as $item) {
                        if (empty($item['id']) || empty($item['name'])) {
                            continue;
                        }

                        $seriesId = (int) $item['id'];
                        $matchCount = CricbuzzMatch::where('series_id', $seriesId)->count();

                        CricbuzzSeries::updateOrCreate(
                            ['series_id' => $seriesId],
                            [
                                'name' => $item['name'],
                                'category' => $categoryName,
                                'month_group' => $monthGroup,
                                'start_date' => isset($item['startDt']) ? (int) $item['startDt'] : null,
                                'end_date' => isset($item['endDt']) ? (int) $item['endDt'] : null,
                                'match_count' => $matchCount,
                                'raw_json' => $item,
                            ]
                        );

                        $syncedCount++;
                        $catCount++;
                    }
                }
            }

            $categoryBreakdown[$categoryName] = $catCount;
        }

        return [
            'status' => 'success',
            'synced_series_count' => $syncedCount,
            'categories' => $categoryBreakdown,
            'message' => "Successfully synced {$syncedCount} tournaments and series into MySQL database."
        ];
    }

    /**
     * Fetch match schedule for a specific series/tournament.
     */
    public function fetchSeriesMatchesFromApi(int $seriesId): array
    {
        try {
            $response = Http::withoutVerifying()->withHeaders([
                'x-rapidapi-key' => $this->apiKey,
                'x-rapidapi-host' => $this->apiHost,
            ])->timeout(15)->get("{$this->baseUrl}/series/v1/{$seriesId}");

            if ($response->successful()) {
                $data = $response->json() ?? [];
                if (!empty($data['matchDetails'])) {
                    // Sync matches into database if not already present
                    $synced = 0;
                    foreach ($data['matchDetails'] as $detailGroup) {
                        $matchesList = $detailGroup['matchDetailsMap']['match'] ?? [];
                        foreach ($matchesList as $mItem) {
                            $info = $mItem['matchInfo'] ?? null;
                            if (!$info || empty($info['matchId'])) {
                                continue;
                            }

                            $seriesRecord = CricbuzzSeries::where('series_id', $seriesId)->first();
                            $matchCategory = $seriesRecord ? ($seriesRecord->category ?? 'International') : 'International';

                            CricbuzzMatch::updateOrCreate(
                                ['match_id' => $info['matchId']],
                                [
                                    'series_id' => $info['seriesId'] ?? $seriesId,
                                    'series_name' => !empty($info['seriesName']) ? $info['seriesName'] : ($seriesRecord->name ?? ''),
                                    'match_desc' => $info['matchDesc'] ?? '',
                                    'match_format' => $info['matchFormat'] ?? 'T20',
                                    'match_type' => $matchCategory,
                                    'start_date' => $info['startDate'] ?? null,
                                    'end_date' => $info['endDate'] ?? null,
                                    'state' => $info['state'] ?? 'Preview',
                                    'status' => $info['status'] ?? $info['hideScoreStatus'] ?? 'Upcoming',
                                    'team1_id' => $info['team1']['teamId'] ?? null,
                                    'team1_name' => $info['team1']['teamName'] ?? '',
                                    'team1_sname' => $info['team1']['teamSName'] ?? '',
                                    'team1_image_id' => $info['team1']['imageId'] ?? null,
                                    'team2_id' => $info['team2']['teamId'] ?? null,
                                    'team2_name' => $info['team2']['teamName'] ?? '',
                                    'team2_sname' => $info['team2']['teamSName'] ?? '',
                                    'team2_image_id' => $info['team2']['imageId'] ?? null,
                                    'venue_id' => $info['venueInfo']['id'] ?? null,
                                    'venue_ground' => $info['venueInfo']['ground'] ?? '',
                                    'venue_city' => $info['venueInfo']['city'] ?? '',
                                    'venue_timezone' => $info['venueInfo']['timezone'] ?? '',
                                    'raw_json' => $info,
                                ]
                            );
                            $synced++;
                        }
                    }

                    // Update match count on series record
                    $totalInDb = CricbuzzMatch::where('series_id', $seriesId)->count();
                    CricbuzzSeries::where('series_id', $seriesId)->update(['match_count' => $totalInDb]);

                    return $data;
                }
            }
        } catch (\Throwable $e) {
            Log::warning("RapidAPI fetchSeriesMatchesFromApi failed for series {$seriesId}: " . $e->getMessage());
        }

        // Return matches from database as fallback
        $dbMatches = CricbuzzMatch::where('series_id', $seriesId)->get();
        return [
            'seriesId' => $seriesId,
            'matches' => $dbMatches,
            'source' => 'Database'
        ];
    }
}
